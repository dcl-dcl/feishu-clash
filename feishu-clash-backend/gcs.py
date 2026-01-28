import base64
import binascii
import logging
import os

from google.cloud import storage
from google.cloud.storage import Blob, Bucket
from google.oauth2.service_account import Credentials

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GCS:
    def __init__(self, sa_key_path=None):
        """
        初始化 GCS 客户端。
        :param sa_key_path: (Optional) Service Account JSON 文件的路径。
                                如果不传，则使用 ADC (Application Default Credentials)。
        """
        if sa_key_path and os.path.exists(sa_key_path):
            logger.info(f"使用 Service Account 文件鉴权: {sa_key_path}")
            credentials = Credentials.from_service_account_file(sa_key_path)
            self.storage_client = storage.Client(credentials=credentials)
        else:
            logger.info("使用 ADC (Application Default Credentials) 鉴权")
            credentials = None
            # 如果不传 credentials，库会自动查找环境变量或云端元数据
            self.storage_client = storage.Client()

    def get_blob(self, bucket_name, destination_blob_name) -> Blob:
        bucket: Bucket = self.storage_client.bucket(bucket_name)
        return bucket.blob(destination_blob_name)

    def generate_signed_url(self, bucket_name, blob_name, expiration=60 * 24 * 7):
        """
        生成签名 URL
        """
        try:
            blob = self.get_blob(bucket_name, blob_name)
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method="GET",
                response_disposition=f'attachment; filename="{os.path.basename(blob_name)}"',
            )
            logger.info(f"Generated signed URL for {blob_name}")
            return signed_url
        except Exception as e:
            logger.error(f"生成签名 URL 失败: {e}")
            raise e

    def upload_base64_image(self, data: bytes | str, bucket_name: str, object_name: str,
                            mime_type: str = "image/jpeg") -> str:
        """
        上传图片数据到 GCS。
        :param data: 图片数据。可以是 Base64 字符串，也可以是原始 bytes。
        :param bucket_name: GCS 存储桶名称。
        :param object_name: 上传到 GCS 的对象路径。
        :param mime_type: 图片 MIME 类型，默认 "image/jpeg"。
        :return: 图片的签名 URL。
        """
        try:
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(object_name)

            image_data = None

            # 处理不同类型的数据
            if isinstance(data, str):
                # 如果是字符串，检查是否为 Base64
                if data.startswith('data:'):
                    # 移除 data:image/...;base64, 前缀
                    data = data.split(',', 1)[1]

                # 尝试解码 Base64
                try:
                    # 验证是否为有效的 Base64
                    if len(data) % 4 == 0:  # Base64 长度应为 4 的倍数
                        image_data = base64.b64decode(data, validate=True)
                    else:
                        # 如果不是有效的 Base64，当作普通字符串处理（但图片不应是普通字符串）
                        raise ValueError("Invalid Base64 data")
                except (binascii.Error, ValueError):
                    logger.error("提供的字符串不是有效的 Base64 编码")
                    raise ValueError("Invalid Base64 encoded string")

            elif isinstance(data, bytes):
                # 如果是字节，直接使用
                image_data = data
            else:
                raise TypeError(f"Unsupported data type: {type(data)}")

            if image_data is None:
                raise ValueError("Failed to process image data")

            logger.info(
                f"正在上传到 GCS: gs://{bucket_name}/{object_name} (Type: {mime_type}, Size: {len(image_data)} bytes)")

            # 上传数据
            blob.upload_from_string(image_data, content_type=mime_type)

            # 生成并返回签名 URL
            # return self.generate_signed_url(bucket_name, object_name)
            return f"https://storage.googleapis.com/{bucket_name}/{object_name}"
        except Exception as e:
            logger.error(f"GCS 上传图片失败: {e}")
            raise e

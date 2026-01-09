import os
import uvicorn
import logging
import uuid
import binascii
import base64
import asyncio
import concurrent.futures
from typing import Optional, List, Tuple

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.cloud import storage
from google.cloud.storage import Blob, Bucket
from google.oauth2.service_account import Credentials
import requests
from retrying import retry

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "eyeweb-wb-20251211")
LOCATION = os.environ.get("LOCATION", "global")
BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "feishu-clash-bucket")
API_KEY = os.environ.get("API_KEY", "sk-5eW9L2pR8xK3mN7qB4vD1cF6gH8jM2nQ4tY7wZ0")

SA_FILE_PATH = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "SA.json")
if os.path.exists(SA_FILE_PATH):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = SA_FILE_PATH

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# 1. 初始化 GenAI Client (Vertex AI 模式)
client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION,
)


# 中间件鉴权
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # 允许健康检查等接口跳过鉴权
    if request.url.path == "/api/health":
        return await call_next(request)

    api_key = request.headers.get("x-api-key", "")
    if api_key != API_KEY:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API Key"})

    response = await call_next(request)
    return response


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
            return self.generate_signed_url(bucket_name, object_name)
            # return f"https://storage.googleapis.com/{bucket_name}/{object_name}"
        except Exception as e:
            logger.error(f"GCS 上传图片失败: {e}")
            raise e


gcs_client = GCS()


async def download_url(url: str) -> Tuple[bytes, str]:
    """
    下载图片并返回二进制数据和 MIME 类型
    """
    try:
        # 使用同步 requests，但放在线程池中避免阻塞
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            resp = await loop.run_in_executor(pool, lambda: requests.get(url, timeout=10))

        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")

        # 确保 content_type 是有效的 MIME 类型
        if ';' in content_type:
            content_type = content_type.split(';')[0].strip()

        return resp.content, content_type
    except requests.exceptions.Timeout:
        logger.error(f"下载图片超时: {url}")
        raise HTTPException(status_code=408, detail="图片下载超时")
    except requests.exceptions.RequestException as e:
        logger.error(f"下载图片失败: {e}")
        raise HTTPException(status_code=400, detail=f"图片下载失败: {str(e)}")
    except Exception as e:
        logger.error(f"下载图片发生未知错误: {e}")
        raise HTTPException(status_code=500, detail=f"图片下载发生未知错误: {str(e)}")


# 图片生成请求模型
class ImageGenRequest(BaseModel):
    model: str = "gemini-3-pro-image-preview"
    prompt: str
    image_urls: Optional[List[str]] = None
    aspect_ratio: str = "1:1"
    image_size: str = "1K"
    folder: str = "feishu-nano-banana-results"


def retry_if_error(exception):
    is_retry = False
    if not isinstance(exception, HTTPException):
        return is_retry
    if exception.status_code == 429:
        is_retry = True
    if "no image" in exception.detail:
        is_retry = True
    return is_retry


@retry(
    stop_max_attempt_number=3,
    retry_on_exception=retry_if_error,
    wait_exponential_multiplier=1000,
    wait_exponential_max=10000,
)
async def _generate_image(request: ImageGenRequest, download_url_func):
    """
    调用 Gemini API 生成图片
    """
    # 1. 准备 Prompt 内容
    parts = [types.Part.from_text(text=request.prompt)]

    # 2. 如果有图片 URL，并发下载
    if request.image_urls:
        download_tasks = []
        for url in request.image_urls:
            download_tasks.append(download_url_func(url))

        # 并发下载所有图片
        downloaded_images = await asyncio.gather(*download_tasks, return_exceptions=True)

        for i, result in enumerate(downloaded_images):
            if isinstance(result, Exception):
                logger.error(f"下载图片 {request.image_urls[i]} 失败: {result}")
                raise HTTPException(status_code=400, detail=f"图片下载失败: {str(result)}")

            image_bytes, mime_type = result
            parts.append(
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            )

    content = types.Content(parts=parts, role="user")

    # 3. 调用 Google GenAI SDK 生成图片
    try:
        response_stream = client.models.generate_content_stream(
            model=request.model,
            contents=[content],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                safety_settings=[types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="OFF"
                ), types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="OFF"
                ), types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="OFF"
                ), types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="OFF"
                )],
                image_config=types.ImageConfig(
                    aspect_ratio=request.aspect_ratio,
                    image_size=request.image_size,
                ),
            )
        )
    except Exception as e:
        error_msg = str(e)
        logger.error(f"调用 Gemini API 失败: {error_msg}")
        if "429" in error_msg:
            raise HTTPException(status_code=429, detail=f"API调用频率受限: {error_msg}")
        raise

    # 4. 解析结果
    generated_images = []

    try:
        # 处理流式响应
        for chunk in response_stream:
            if not chunk.candidates:
                continue
            candidate = chunk.candidates[0]
            if not candidate.content or not candidate.content.parts:
                continue

            for part in candidate.content.parts:
                # 检查是否包含内联图片数据
                if part.inline_data:
                    mime_type = part.inline_data.mime_type
                    binary_data = part.inline_data.data  # 这里拿到的是 raw bytes
                    generated_images.append({
                        "mime_type": mime_type,
                        "data": binary_data
                    })

        if not generated_images:
            raise Exception("模型未返回任何图像数据")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"解析 API 响应失败: {e}")
        raise HTTPException(status_code=500, detail=f"解析响应失败: {str(e)}")

    if not generated_images:
        raise HTTPException(status_code=500, detail="Model no image generated")

    return generated_images[0]



@app.post("/api/generate-image")
async def generate_image(request: ImageGenRequest):
    """
    调用 Vertex AI 生成图片，上传 GCS，返回飞书可用 URL
    """
    logger.info(
        f"Processing request: model={request.model}, prompt_length={len(request.prompt)},"
        f" image_urls_count={len(request.image_urls) if request.image_urls else 0}")

    try:
        image = await _generate_image(request, download_url)
        # 5. 上传到 GCS
        # 从 MIME 类型获取文件扩展名
        mime_to_ext = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif"
        }
        mime_type = image["mime_type"]
        extension = mime_to_ext.get(mime_type, ".png")

        filename = os.path.join(request.folder, f"{uuid.uuid4().hex}{extension}")

        signed_url = gcs_client.upload_base64_image(
            image["data"],
            bucket_name=BUCKET_NAME,
            object_name=filename,
            mime_type=mime_type,
        )
        # 6. 构造返回结果
        result = {
            "status": "success",
            "image_url": signed_url,
            "filename": filename,
            "model_used": request.model,
            "mime_type": mime_type
        }
        logger.info(f"Image generated: {result}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=(os.environ.get("ENV", "local") == "local"))

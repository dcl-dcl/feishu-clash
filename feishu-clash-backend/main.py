import asyncio
import concurrent.futures
import logging
import os
import uuid
from typing import List, Optional, Tuple

import requests
import uvicorn
from config import configs
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from gcs import GCS
from google import genai
from google.genai import types
from pydantic import BaseModel
from retrying import retry

PROJECT_ID = configs.GOOGLE_CLOUD_PROJECT
LOCATION = configs.GOOGLE_CLOUD_LOCATION
BUCKET_NAME = configs.GOOGLE_CLOUD_GCS_BUCKET
API_KEY = configs.API_KEY
SA_FILE_PATH = configs.GOOGLE_APPLICATION_CREDENTIALS

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
                                                                                                                                                                                                                                                                                                                                                                                                                                             
app = FastAPI()

# 1. 初始化 GenAI Client (Vertex AI 模式)
client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

# gcs_client = GCS(sa_key_path=SA_FILE_PATH)
gcs_client = None
# 中间件鉴权
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # 允许健康检查等接口跳过鉴权
    if request.url.path == "/api/health":
        return await call_next(request)

    api_key = request.headers.get("x-api-key", "")
    if api_key != API_KEY:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API Key"})
    try:
        response = await call_next(request)
        return response
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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

# 文本生成请求模型
class TextGenRequest(BaseModel):
    model: str = "gemini-3-pro-preview"
    prompt: str
    image_urls: Optional[List[str]] = None
    thinking_level: str = "LOW"

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
    if "no image" in str(exception):
        is_retry = True
    return is_retry

async def _prepare_content(prompt: str, image_urls: List[str] = None):
    # 1. 准备 Prompt 内容
    parts = [types.Part.from_text(text=prompt)]
    if not image_urls:
        return types.Content(parts=parts, role="user")
    # 2. 如果有图片 URL，并发下载
    download_tasks = []
    for url in image_urls:
        download_tasks.append(download_url(url))

    # 并发下载所有图片
    downloaded_images = await asyncio.gather(*download_tasks, return_exceptions=True)

    for i, result in enumerate(downloaded_images):
        if isinstance(result, Exception):
            logger.error(f"下载图片 {image_urls[i]} 失败: {result}")
            raise HTTPException(status_code=400, detail=f"图片下载失败: {str(result)}")

        image_bytes, mime_type = result
        parts.append(
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        )

    return types.Content(parts=parts, role="user")


@retry(
    stop_max_attempt_number=3,
    retry_on_exception=retry_if_error,
    wait_exponential_multiplier=1000,
    wait_exponential_max=10000,
)
async def _generate_image(request: ImageGenRequest):
    """
    调用 Gemini API 生成图片
    """
    content = await _prepare_content(request.prompt, request.image_urls)
    # 调用 Google GenAI SDK 生成图片
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
            raise HTTPException(status_code=500, detail="Model no image generated")

    except Exception as e:
        logger.error(f"解析 API 响应失败: {e}")
        raise HTTPException(status_code=500, detail=f"解析响应失败: {str(e)}")

    return generated_images[0]


async def _generate_text(request: TextGenRequest):
    content = await _prepare_content(request.prompt, request.image_urls)
    if 'gemini-3' in request.model and request.thinking_level:
        thinking_config = types.ThinkingConfig(
            thinking_level=request.thinking_level or "LOW"
        )
    else:
        thinking_config = None
    try:
        response_stream = client.models.generate_content_stream(
            model=request.model,
            contents=[content],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT"],
                thinking_config=thinking_config
            )
        )
        text = ''
        for chunk in response_stream:
            text += chunk.text
        return text.strip()

    except Exception as e:
        logger.info(e)
        raise HTTPException(status_code=500, detail=f"模型生图失败，错误原因：{e}"[:100])


@app.post("/api/generate-image")
async def generate_image(request: ImageGenRequest):
    """
    调用 Nano Banana 生成图片，上传 GCS，返回飞书可用 URL
    """
    logger.info(f"Processing request: {request.model_dump()}")
    image = await _generate_image(request)
    # 上传到 GCS
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
    # 构造返回结果
    result = {
        "status": "success",
        "image_url": signed_url,
        "filename": filename,
        "model_used": request.model,
        "mime_type": mime_type
    }
    logger.info(f"Image generated: {result}")
    return result


@app.post("/api/generate-text")
async def generate_text(request: TextGenRequest):
    """
    调用 gemini 生成文本
    """
    logger.info(f"Processing request: {request.model_dump()}")
    text = await _generate_text(request)
    return {"text": text}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=(os.environ.get("ENV", "local") == "local"))

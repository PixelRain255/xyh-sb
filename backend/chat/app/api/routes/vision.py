from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from ...schemas.vision import VisionAnalyzeResponse
from ...services.vision_service import vision_analyze_upload, vision_stream_events

router = APIRouter(tags=["vision"])


@router.post("/vision/analyze", response_model=VisionAnalyzeResponse)
async def vision_analyze(
    message: str = Form(""),
    prompt: str = Form(""),
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
) -> VisionAnalyzeResponse:
    final_message = (message or prompt or "请提取图片中的金融关键信息并结构化输出。").strip()
    upload = image or file
    if upload is None:
        raise HTTPException(status_code=422, detail="missing upload file field: expected 'image' or 'file'")

    reply = await vision_analyze_upload(message=final_message, image=upload)
    return VisionAnalyzeResponse(reply=reply)


@router.post("/vision/analyze/stream")
async def vision_analyze_stream(
    message: str = Form(""),
    prompt: str = Form(""),
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
):
    final_message = (message or prompt or "请提取图片中的金融关键信息并结构化输出。").strip()
    upload = image or file
    if upload is None:
        raise HTTPException(status_code=422, detail="missing upload file field: expected 'image' or 'file'")

    raw_bytes = await upload.read()
    content_type = (upload.content_type or "").lower().strip()
    if content_type.startswith("image/"):
        mime = content_type
    else:
        name = (upload.filename or "").lower()
        if name.endswith(".png"):
            mime = "image/png"
        elif name.endswith(".jpg") or name.endswith(".jpeg"):
            mime = "image/jpeg"
        elif name.endswith(".webp"):
            mime = "image/webp"
        elif name.endswith(".gif"):
            mime = "image/gif"
        else:
            mime = "image/png"

    return StreamingResponse(
        vision_stream_events(final_message, raw_bytes, mime),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

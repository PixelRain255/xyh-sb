from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ...schemas.chat import ChatRequest, ChatResponse
from ...services.chat_service import chat_once, chat_stream_events

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    reply = await chat_once(req.message)
    return ChatResponse(reply=reply)


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    return StreamingResponse(
        chat_stream_events(req.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

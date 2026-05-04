from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.app.models.schemas import ChatRequest, ChatResponse
from backend.app.services.chat_service import stream_chat
from backend.app.services.agent_service import run_chat

router = APIRouter()


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream agent execution via Server-Sent Events."""
    return StreamingResponse(
        stream_chat(req.message, req.source_filter),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Non-streaming chat endpoint."""
    return await run_chat(req.message)

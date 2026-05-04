import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.core.config import settings
from backend.app.core.logging import setup_logging, logger
from backend.app.models.schemas import HealthResponse
from backend.app.api import chat, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
    logger.info("AI Research Assistant started", llm=settings.LLM_MODE, qdrant=settings.QDRANT_MODE)
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="AI Research Assistant",
    description="Agentic RAG + Web Search API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(upload.router, prefix="/api", tags=["upload"])


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        qdrant_mode=settings.QDRANT_MODE,
        llm_mode=settings.LLM_MODE,
    )

from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    message:       str        = Field(..., min_length=1, max_length=4096)
    session_id:    Optional[str]       = None
    source_filter: list[str]           = []


class SourceItem(BaseModel):
    name:        str
    source_type: str
    url:         Optional[str] = None
    count:       int           = 0


class SourceChunk(BaseModel):
    text:  str
    page:  Optional[int] = None
    chunk: int           = 0


class Source(BaseModel):
    title: str
    url: Optional[str] = None
    snippet: str
    source_type: str  # "pdf" | "web"


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source] = []
    session_id: Optional[str] = None


class IngestResponse(BaseModel):
    status: str
    filename: str
    chunks: int


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    qdrant_mode: str
    llm_mode: str

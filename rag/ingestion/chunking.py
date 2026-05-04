from langchain.text_splitter import RecursiveCharacterTextSplitter


_splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_documents(docs: list[dict]) -> list[dict]:
    """Split documents into smaller chunks, preserving metadata."""
    chunks = []
    for doc in docs:
        splits = _splitter.split_text(doc["text"])
        for i, split in enumerate(splits):
            chunks.append({
                "text": split,
                "metadata": {**doc["metadata"], "chunk": i},
            })
    return chunks

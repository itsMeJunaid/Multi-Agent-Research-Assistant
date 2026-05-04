from rag.ingestion.chunking import chunk_documents


def test_chunk_documents():
    docs = [{"text": "Hello world. " * 100, "metadata": {"source": "test.pdf", "source_type": "pdf"}}]
    chunks = chunk_documents(docs)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk["text"]) <= 600
        assert chunk["metadata"]["source"] == "test.pdf"

import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse


async def load_url(url: str) -> list[dict]:
    """Fetch a URL and extract clean text from the page."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    title = soup.title.string.strip() if soup.title else urlparse(url).netloc

    return [{
        "text": text,
        "metadata": {
            "source": title,
            "url": url,
            "source_type": "web",
        },
    }]

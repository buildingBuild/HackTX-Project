import os

import httpx
from dotenv import load_dotenv
from schemas import LowSeverityResources, Resource


load_dotenv()


async def get_low_severity_resources(
    issue: str,
    vehicle_model: str,
) -> LowSeverityResources:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://serpapi.com/search.json",
            params={
                "api_key": os.environ["SERPAPI_KEY"],
                "engine": "google",
                "q": f"{vehicle_model} {issue} troubleshooting repair guide",
            },
        )
        response.raise_for_status()

    results = response.json()
    articles = [
        Resource.model_validate(item)
        for item in results.get("organic_results", [])[:5]
        if item.get("link")
    ]
    videos = [
        Resource.model_validate(item)
        for item in results.get("inline_videos", [])[:5]
        if item.get("link")
    ]
    return LowSeverityResources(articles=articles, videos=videos)

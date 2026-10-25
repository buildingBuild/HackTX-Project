import os

import httpx
from dotenv import load_dotenv
from schemas import PartListing, PartSearchResult


load_dotenv()


async def search_parts(
    parts: list[str],
    car_model: str,
) -> list[PartSearchResult]:
    """Search Google Shopping for parts identified by the diagnostic agent."""
    api_key = os.environ["SERPAPI_KEY"]
    results_per_part = int(os.environ["SERP_RESULTS_PER_PART"])
    searches: list[PartSearchResult] = []

    async with httpx.AsyncClient(timeout=15) as client:
        for part in dict.fromkeys(part.strip() for part in parts if part.strip()):
            response = await client.get(
                "https://serpapi.com/search.json",
                params={
                    "api_key": api_key,
                    "engine": "google_shopping",
                    "q": f"{car_model.strip()} {part} replacement part",
                },
            )
            response.raise_for_status()
            payload = response.json()
            if error_message := payload.get("error"):
                raise RuntimeError(str(error_message))

            raw_results = [
                *payload.get("inline_shopping_results", []),
                *payload.get("shopping_results", []),
            ]
            listings = [
                PartListing.model_validate(result)
                for result in raw_results[:results_per_part]
            ]
            searches.append(PartSearchResult(part=part, listings=listings))

    return searches

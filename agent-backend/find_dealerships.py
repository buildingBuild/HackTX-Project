import os

import httpx
from dotenv import load_dotenv
from schemas import DealershipResources, Dealership  # Adjust schema names as needed


load_dotenv()


async def get_dealerships(
    location: str,
    vehicle_model: str = "Toyota",
) -> DealershipResources:
    """Retrieves nearby automotive dealerships using SerpAPI's Google Maps engine.

    Args:
        location: City, state, or zip code (e.g., 'Austin, TX' or '78701').
        vehicle_model: The brand or model of the vehicle (defaults to 'Toyota').
    """
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://serpapi.com/search.json",
            params={
                "api_key": os.environ["SERPAPI_KEY"],
                "engine": "google_maps",
                "q": f"{vehicle_model} dealership",
                "location": location,
                "hl": "en",
            },
        )
        response.raise_for_status()

    results = response.json()
    
    # SerpAPI Google Maps returns place listings under "local_results"
    dealerships = [
        Dealership.model_validate(item)
        for item in results.get("local_results", [])[:5]
        if item.get("title")
    ]
    
    return DealershipResources(dealerships=dealerships)

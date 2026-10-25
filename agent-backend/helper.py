import json
import os

import httpx
from dotenv import load_dotenv
from schemas import (
    InteractionSetup,
    PartListing,
    PartSearchResult,
    RecommendationResult,
)


load_dotenv()


def get_device_schematics(obd_data: dict[str, object]) -> str:
    """Format OBD scanner data as context for the diagnostic agent."""
    return json.dumps(obd_data, indent=2, default=str)


def get_insurance_information(insurance_data: dict[str, object]) -> str:
    """Format insurance data as context for the diagnostic agent."""
    return json.dumps(insurance_data, indent=2, default=str)


def get_customer_information(customer_data: dict[str, object]) -> str:
    """Format customer data as context for the diagnostic agent."""
    return json.dumps(customer_data, indent=2, default=str)


async def handle_low_severity(
    customer_data: dict[str, object],
    vehicle_data: dict[str, object],
    diagnostic_data: dict[str, object],
) -> None:
    """Placeholder for the low-severity flow."""


async def give_recommendations(
    diagnostic_context: str,
    customer_context: str,
    insurance_context: str,
) -> RecommendationResult:
    """Generate high-severity recommendations with the Snowflake agent."""
    base_url = os.environ["SNOWFLAKE_BASE_URL"].rstrip("/")
    database = os.environ["SNOWFLAKE_DATABASE"]
    schema = os.environ["SNOWFLAKE_SCHEMA"]
    agent = os.environ["SNOWFLAKE_AGENT"]

    prompt = (
        f"Customer information:\n{customer_context}\n\n"
        f"OBD and diagnostic information:\n{diagnostic_context}\n\n"
        f"Insurance policy:\n{insurance_context}\n\n"
        "Analyze this high-severity case."
    )

    async with httpx.AsyncClient(timeout=310) as client:
        response = await client.post(
            f"{base_url}/api/v2/databases/{database}/schemas/{schema}/agents/{agent}:run",
            headers={
                "Authorization": f"Bearer {os.environ['SNOWFLAKE_PAT']}",
                "X-Snowflake-Authorization-Token-Type": (
                    "PROGRAMMATIC_ACCESS_TOKEN"
                ),
                "X-Snowflake-Role": os.environ["SNOWFLAKE_ROLE"],
                "Accept": "application/json",
            },
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": prompt}],
                    }
                ],
                "stream": False,
            },
        )
        if response.is_error:
            raise RuntimeError(
                f"Snowflake agent request failed ({response.status_code}): "
                f"{response.text}"
            )

    content = response.json().get("content", [])
    answer = next(
        (item["text"] for item in reversed(content) if item.get("type") == "text"),
        None,
    )
    if answer is None:
        raise RuntimeError("Snowflake agent returned no text response")

    answer = answer.strip()
    if answer.startswith("```"):
        answer = answer.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    return RecommendationResult.model_validate_json(answer)


def give_interaction(
    vehicle_model: str,
    recommendations: RecommendationResult,
) -> InteractionSetup:
    """Build the 3D vehicle configuration consumed by the frontend."""
    raise NotImplementedError("Connect the frontend 3D model setup here")


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

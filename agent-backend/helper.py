import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from schemas import (
    CustomerInformation,
    InsuranceLevel,
    PartListing,
    PartSearchResult,
    RecommendationResult,
)


load_dotenv()

CUSTOMERS_FILE = Path(__file__).resolve().parents[1] / "data" / "mock_customer.json"
INSURANCE_FILE = Path(__file__).resolve().parents[1] / "data" / "insurance_policy.md"


def get_device_schematics(obd_data: dict[str, object]) -> str:
    return json.dumps(obd_data, indent=2, default=str)


def get_insurance_information(insurance_level: InsuranceLevel) -> str:
    policy = INSURANCE_FILE.read_text()
    heading = f"## {insurance_level.title()}"
    start = policy.index(heading)
    end = policy.find("\n## ", start + len(heading))

    return policy[start:end].strip() if end != -1 else policy[start:].strip()


def get_customer_information(customer_id: str) -> CustomerInformation:
    customers = json.loads(CUSTOMERS_FILE.read_text())
    customer = next(
        (customer for customer in customers if customer["id"] == customer_id),
        None,
    )
    if customer is None:
        raise ValueError(f"Customer '{customer_id}' was not found")

    return CustomerInformation.model_validate(customer)


async def handle_low_severity(
    customer_id: str,
    diagnostic_data: dict[str, object],
) -> None:
    pass


async def give_recommendations(
    diagnostic_context: str,
    customer_context: str,
    insurance_context: str,
) -> RecommendationResult:
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


async def search_parts(
    parts: list[str],
    car_model: str,
) -> list[PartSearchResult]:
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

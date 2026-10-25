import asyncio
import json
from pathlib import Path

from helper import (
    get_customer_information,
    get_device_schematics,
    get_insurance_information,
    give_recommendations,
)


async def main() -> None:
    data_dir = Path(__file__).resolve().parents[1] / "data"
    customers = json.loads((data_dir / "mock_customer.json").read_text())
    customer = next(item for item in customers if item["name"] == "Alex Rivera")

    diagnosis = {
        "vehicle": {
            "year": 2019,
            "make": "Honda",
            "model": "Civic",
            "trim": "EX",
        },
        "code": "P0730",
        "description": customer["issue"]["description"],
        "symptoms": [
            "Transmission slips between gears",
            "Vehicle hesitates during acceleration",
        ],
        "confirmed_diagnosis": "Internal transmission failure",
        "estimated_repair_cost": 4200,
        "currency": "USD",
        "maintenance_findings": "No evidence of neglect or missed maintenance",
    }

    result = await give_recommendations(
        diagnostic_context=get_device_schematics(diagnosis),
        customer_context=get_customer_information(customer["id"]).model_dump_json(
            indent=2
        ),
        insurance_context=get_insurance_information(customer["insurance_level"]),
    )
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())

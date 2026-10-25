import asyncio

from low_severity_resources import get_low_severity_resources


async def main() -> None:
    resources = await get_low_severity_resources(
        issue="Low system voltage detected and the battery fails to hold a charge.",
        vehicle_model="2016 Toyota Corolla LE",
    )
    print(resources.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())

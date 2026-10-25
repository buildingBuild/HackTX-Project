import asyncio
import json
import sys

from helper import search_parts


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(
            'Usage: python test_search_parts.py "CAR MODEL" "PART" ["PART" ...]'
        )

    results = asyncio.run(
        search_parts(
            car_model=sys.argv[1],
            parts=sys.argv[2:],
        )
    )
    print(json.dumps([result.model_dump() for result in results], indent=2))

import os
import json
from serpAPI import get_toyota_vehicle_guidance

def test_get_toyota_vehicle_guidance(issue: str, model: str):
    api_key = os.getenv("SERPAPI_KEY")
    assert api_key is not None, "TEST FAILED: SERPAPI_KEY environment variable is missing."

    test_issue = "Burned-out headlight or taillight bulbs"
    test_model = "Camry"

    print(f"Running test query for Toyota {test_model} - '{test_issue}'...\n")

    response = get_toyota_vehicle_guidance(issue=test_issue, model=test_model)

    # 1. Verify it's a valid response object/container (checking for dict-like behavior or attributes)
    assert response is not None, "TEST FAILED: Response is None."
    print(f"✅ API Response received successfully! (Type: {type(response)})")

    # 2. Convert to a standard dictionary if it has a conversion method or representation
    # The serpapi client object often supports direct dictionary conversion or key access
    if hasattr(response, "as_dict"):
        response_dict = response.as_dict()
    else:
        # Fallback to standard dict conversion if supported
        try:
            response_dict = dict(response)
        except (TypeError, ValueError):
            response_dict = {"raw_response": str(response)}

    print("\n--- Response Keys Preview ---")
    print(list(response_dict.keys()) if isinstance(response_dict, dict) else "Non-dict response structure")
    print(response_dict['text_blocks'])

if __name__ == "__main__":
    test_get_toyota_vehicle_guidance()

## Run locally

```bash
cd agent-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
fastapi dev main.py
```

The API runs at <http://127.0.0.1:8000>. Interactive docs are available at
<http://127.0.0.1:8000/docs>.

Endpoints:

- `GET /` — basic server response
- `GET /health` — health check

Give OBD scanner data to the diagnostic agent as context:

```python
from helper import get_device_schematics

mock_obd_data = {
    "vehicle": "2019 Honda Civic",
    "diagnostic_codes": [
        {"code": "P0301", "description": "Cylinder 1 misfire detected"}
    ],
    "live_data": {"engine_rpm": 780, "coolant_temp_f": 194},
}

agent_context = get_device_schematics(mock_obd_data)
```

Insurance data can be added to the agent context in the same way:

```python
from helper import get_insurance_information

insurance_context = get_insurance_information(
    {
        "provider": "Example Insurance",
        "policy_number": "AUTO-12345",
        "deductible": 500,
        "coverage": ["collision", "comprehensive"],
    }
)
```

The agent can call the SERP integration directly after producing its diagnosis:

```python
from helper import search_parts

results = await search_parts(
    parts=["front bumper cover", "driver-side headlight"],
    car_model="2019 Honda Civic",
)
```

Test it:

```bash
cd agent-backend

SERP_RESULTS_PER_PART=5 python test_search_parts.py \
  "2019 Honda Civic" \
  "front bumper cover" \
  "driver-side headlight"
```

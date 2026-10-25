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

Load the relevant section of the mock insurance policy by plan level:

```python
from helper import get_insurance_information

insurance_context = get_insurance_information("gold")
```

Run the published Snowflake agent with the mock high-severity case:

```bash
cd agent-backend
python test_snowflake_agent.py
```

Snowflake connection settings are loaded from the repository root `.env`. Copy the
non-secret configuration names from `.env.example` and keep `SNOWFLAKE_PAT` private.

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

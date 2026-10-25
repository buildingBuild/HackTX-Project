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

# Land Cruiser diagnostic studio

The `pranit-features` interface centers the supplied Land Cruiser model in a red, black and white workspace. Connection, scan, findings, repair level and itemized costs appear around the same model. This is a simulated OBD / extended-module flow, not live dongle or camera diagnosis.

## Run

From the repository root:

```sh
cd frontend
npm ci
PORT=3002 npm run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api` to the selected `PORT`. If the default frontend port is occupied, Vite chooses the next free port. `npm run build` checks TypeScript and creates `dist`; `npm test` runs the backend, integration-contract and model-animation checks.

## Credentials and existing integrations

Place keys in the repository root `.env`, using `.env.example` as the variable-name reference. The Node server loads them automatically; ignored credentials are never committed or exposed as `VITE_` variables. `HEADS_UP_ENV_FILE` can select a different local file. A worktree can reuse its main checkout's ignored `.env`. Process environment values take priority.

- `SERPAPI_KEY` (or `SERPAPI_API_KEY`) enables manufacturer-reference and Google Shopping searches. `SERP_RESULTS_PER_PART` limits returned listings.
- `SNOWFLAKE_BASE_URL`, `SNOWFLAKE_PAT`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `SNOWFLAKE_AGENT` and `SNOWFLAKE_ROLE` connect the same Cortex agent used by `agent-backend/helper.py`. The frontend never receives these values.
- Level 1's optional `google_ai_mode` guidance adapts Advaith's `serpAPI.py` on `Advaith_serp_api`, including its generated-text extraction. Generated guidance and retrieved references are labeled separately.
- The existing Python FastAPI service, customer data and main-branch diagnostic-bay app remain available. This interface runs through the Node service in `frontend/demo/agent-backend`, so it does not require a second Python process. It calls the configured Cortex agent directly with the existing authentication scheme.

Reference retrieval does not guarantee that a complete, matching workshop manual is available. The agent receives retrieved snippets and candidate listings, must acknowledge missing applicability, and cannot override app severity. Provider errors retain explicitly labeled demo costs and retry controls.

## Three routes

1. **Level 1: guided maintenance.** The routine-care fixture has no stored powertrain code. A service reminder leads to a manual oil-level check. The hood opens once, revealing the original engine scan. Five steps use model-anchored arrows, text, browser speech and confirmations. Guided AR is available on compatible Android WebXR browsers over HTTPS; other devices retain the 3D walkthrough.
2. **Level 2: technician diagnosis.** A simulated P0442 / steady check-engine case produces a diagnostic path, manufacturer references, an agent brief, candidate part listings and a planning range. A code alone never confirms which part to replace.
3. **Level 3: urgent assessment and coverage review.** A simulated P0300 / flashing-light case, or reported safety concern, prioritizes professional assistance. Owner-maintenance guidance is unavailable. The protection tab uses the supplied Toyota extract with page links, verified official contact / claim instructions, and an exportable inquiry draft.

A scan fixture represents a generic petrol powertrain, not verified LC300 factory telemetry. Diesel variants can use the routine-care walkthrough but cannot use the petrol fault fixtures. Repair levels are application rules, not standardized OBD severity levels.

## Cost and coverage boundaries

Part searches exclude other named vehicle models, unrecognized package quantities, used items, installments, unsafe links and non-USD prices. A listing must explicitly reference LC300 / Land Cruiser 300 before entering the live part range. Exact engine, VIN, part number, year and package fitment remain unverified. If matching prices are unavailable, the relevant row retains its demo range. Quantities multiply individual part prices; parts, labor, diagnostic and towing lines reconcile in integer cents.

Labor hours / rate, diagnostic allowances and towing remain planning assumptions. Candidate parts require confirmation by diagnosis; the total is before tax/shipping and is not a quote or cost cap. The oil-level walkthrough assumes no replacement part or oil top-up. Changing vehicle or labor settings clears the previous result.

The uploaded 32-page Toyota extract is an unofficial summary, not an active policy. VSA and maintenance products are distinct from auto insurance; GAP is for an eligible total-loss finance deficiency. Severity never establishes enrollment, claim eligibility or approval. The claim inquiry is unsent and explicitly marks the scan as simulated. Real submission needs the customer's agreement, VIN, actual diagnosis, itemized estimate and required authorization through the provider's secure channel. The contact button opens the official phone channel; no automated call or claim submission is made.

## Model provenance

`public/models/land-cruiser-300-animated.glb` derives from the supplied `Land_Cruiser_300_Open_Hood_Engine.glb`. It combines an LC300 body with an HDJ100 engine scan. `scripts/animate-land-cruiser.py` adds a 2.4-second `HoodOpen` animation to the four hood meshes; the final pose matches the supplied open hood. The source file is not altered. Arrows indicate general training areas, not verified component locations or automatic alignment to a real car.

## Routes

- `GET /api/diagnostics/config`: scenarios, module labels, claim references and credential-presence flags only.
- `POST /api/diagnostics/scan`: validated demo configuration; severity, findings and baseline estimate.
- `POST /api/diagnostics/research`: manufacturer search, candidate part ranges, optional AI guidance and Snowflake brief. Only non-identifying vehicle / issue information is sent to search / agent providers.

The original profile, insurance, comparison and chat routes are preserved. Session scan data resets on reload. Reports and inquiry drafts can be downloaded locally.

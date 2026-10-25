# Heads Up frontend

Imported from `PranitPrasanna/HackTX-Project` commit `684cb0f` (latest fork main at import). All app code and build configuration live in this folder. The original repository backend and insurance-data folders are separate from the bundled demo.

A working synthetic Toyota-owner service planning demo. Predict an inspection window, compare transparent payment illustrations, and prepare a service handoff. No credentials or external APIs are required.

## Run

Use Node.js 22+ and npm. This import also passed its build and tests with the locally installed Node.js 18.20.8.

```sh
cd frontend
npm ci
npm run dev
```

Vite serves the frontend on port 5173 and proxies `/api` to the backend on port 3001. Run the npm commands from `frontend/`. For a single-server production build:

```sh
npm run build
npm start
```

The production server serves the app and API on port 3001. `npm test` runs the decision-engine tests; `npm run build` includes strict TypeScript checking.

If port 3001 is already in use, run `PORT=3002 npm run dev`; both the demo API and Vite proxy use that port. Vite chooses another frontend port if 5173 is occupied and prints its URL.

## Demo flow

- Start with Maria. Review the estimated brake inspection and choose a payment option.
- Use **Adjust scenario** to change mileage, monthly budget, or the hypothetical service estimate. Recommendations and installment totals update through the API.
- Toggle safety symptoms to route to professional assessment.
- Switch to James for eligible routine-care coverage, or Aisha for a budget shortfall scenario.
- Use **Plan my service** to prepare a demo handoff. No appointment, credit application, or notification is actually sent. The dealer finder links to Toyota's public website.

## Architecture

The code in `demo/` is the fork’s synthetic API and source data, bundled so this frontend runs independently. Integrating the original repository’s backend requires mapping its endpoints to the frontend’s `/api` contract; no live backend integration is included in this transfer.

- `main.tsx`, `Insurance.tsx`, styles and assets: responsive React/TypeScript dashboard, local fonts, vehicle illustration, scenario controls and service handoff.
- `demo/agent-backend/engine.ts`: deterministic mileage rules, integer-cent payment schedules, eligibility, and templated explanations.
- `demo/agent-backend/server.ts`: Express JSON API and production static hosting.
- `/api/profiles`, `/api/dealers`, `/api/health`: GET endpoints.
- `/api/evaluate`: POST `{ id, mileage, budget, estimate?, symptoms }`. `estimate` is integer cents; `budget` is dollars. Invalid inputs return 400.

## Data boundaries

All demo people, vehicle histories, service prices, inspection timing, financing terms, and local service centers are synthetic. The Insurance section separately uses the supplied Toyota document and user-entered quote amounts. Missing service records do not prove wear. No sensor data, diagnostics, SerpApi, LLM, lender, or booking provider is connected. The service plan covers only the modeled routine service; wear items are excluded. Timing is an illustrative rule, not a diagnosis. The actual service and cost require inspection. Safety symptoms override financing recommendations.

The installment illustration adds a $24 fixed fee to the estimate and divides the result into six payments, distributing cents so the schedule reconciles exactly. It is not a real offer or approval. Inspection fees, if applicable, are separate. Business outcomes are not measured or claimed. This independent demo is not affiliated with Toyota.

## Insurance section

The **Insurance** navigation opens a seven-product Toyota Financial Services guide, with exclusions, eligibility notes, unresolved source differences, page references, and access to the unchanged uploaded PDF. These protection products are distinct from primary auto insurance. GEICO, Progressive, and State Farm are available as U.S. insurer candidates, with official links and explicitly unverified policy details.

Enter two or three quotes to annualize premiums and compare selected coverage limits. Defaults contain no invented prices. Different or unknown limits, or missing same-risk confirmation, prevent ranking. Changing inputs clears previous comparison results. Entries last only while the Insurance page is mounted. No real quote retrieval or purchase is integrated.

- `GET /api/insurance`: catalog and supported comparison coverage levels.
- `GET /api/insurance/source/toyota`: original PDF.
- `POST /api/insurance/compare`: `{quotes: [{providerId, premiumCents, termMonths, coverage}], sameRiskConfirmed}`. Supports distinct GEICO, Progressive, and State Farm entries; terms 1/6/12 months; coverage `standard`, `higher`, or `unknown`. Invalid requests return 400.
- `demo/insurance-data/README.md`: source provenance and verification limits.

The Insurance section works without external network requests. Live first-party verification requires network access to the linked insurer domains.

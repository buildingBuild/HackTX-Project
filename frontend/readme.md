# Heads Up repair workspace

A React/TypeScript frontend organized around repair severity and the support a driver needs. The demo assumes Toyota insurance for cost planning; no policy or claim is verified.

## Run

From the repository root:

```sh
cd frontend
npm ci
npm run dev
```

The existing development script starts Vite and the existing demo service. If port 3001 is occupied, use `PORT=3002 npm run dev`. Vite prints the frontend URL. Build with `npm run build`.

## Repair journey

- **Level 1 — Do it yourself / SerpApi:** the existing SerpApi integration will supply DIY guidance results when connected later. The current checklist is a frontend example with session-only completion tracking.
- **Level 2 — Agent assistance / Snowflake:** the existing Snowflake integration will supply repair information when connected later. The current UI previews the results area and prepares a repair brief without fetching data or submitting requests.
- **Level 3 — Insurance and costs:** a professional-repair example, assumed Toyota insurance, editable repair estimate, deductible, eligible percentage, and payout limit. Estimated insurer and personal shares reconcile to the total. A separate insurance-review brief can be prepared.

The report dialog adds notes to an example repair. Severity is selected from frontend examples, not diagnosed from those notes. Prepared briefs can be reviewed and copied from **Prepared requests**. All notes, checklist progress, and briefs reset on a page reload.

The Toyota protection PDF is an existing reference about separate protection products. It does not prove that a driver has an auto insurance policy or that a repair is covered.

## Frontend files

- `RepairApp.tsx`: workspace navigation, vehicle selection, repair examples, notes, and prepared briefs.
- `RepairPanels.tsx`: DIY checklist, agent handoff preview, insurance forecast, and policy-review UI.
- `repair-data.ts`: frontend example cases and the illustrative cost calculation.
- `repairs.css`: responsive repair workspace styling.
- `ChatAssistant.tsx`: the existing headset chat UI and streamed responses, with navigation mapped into the repair workspace.

This repair redesign changes frontend files only. Existing backend files, routes, schemas, data sources, and WebSocket behavior are unchanged. The UI reuses the existing vehicle-profile endpoint, protection-reference link, and chat transport. No new agent or insurer connection is implemented.

SerpApi and Snowflake are existing project integrations, not new implementations requested here. Their frontend views are marked as awaiting integration. No new fetching mechanism, API client, SDK, route, credential handling, or replacement data source is added for either level.

## Verify

```sh
npm run build
node --import tsx --test repair-data.test.ts
```

The frontend tests check forecast reconciliation, deductibles, exclusions, payout limits, invalid input, and consistency of the example repair breakdowns.

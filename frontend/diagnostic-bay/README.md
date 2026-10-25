# Drivn — frontend

The web app for Drivn by Team Navonic. A technician picks a customer, the app connects to the car's OBD port (simulated), and the diagnosis is shown around an interactive 3D model of the car.

Built with Next.js 15, React 19, Three.js and React Three Fiber.

## Run it

You need **Node.js 20** (or 18.18+) and the **agent backend** running.

The app lives in `frontend/diagnostic-bay`. Running `npm` from the repo root or from `frontend/` will not work.

**1. Start the backend** (from the repo root, in its own terminal):

```bash
cd agent-backend
uvicorn main:app --reload --port 8000
```

**2. Start the frontend** (in a second terminal, from the repo root):

```bash
cd frontend/diagnostic-bay
npm install
npm run dev
```

Open **http://localhost:3000**.

The frontend calls the backend at `http://localhost:8000` by default. If your backend runs somewhere else, create `frontend/diagnostic-bay/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Restart `npm run dev` after changing it.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload on port 3000 |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |

## How the app flows

1. **Pick a customer** — the list loads from `GET /customers/{id}` (c01–c07).
2. **Connect OBD** — a simulated "waiting → connecting → connected" screen runs for about five seconds.
3. **On connect**, two requests start at the same time and don't wait on each other:
   - `POST /diagnostic-sessions` — the diagnosis
   - `GET /3d-visualization/{id}` — the car model
4. **The workspace** shows the 3D car while the diagnosis runs. The affected part is highlighted in yellow.
   - **Low severity** — helpful videos and articles (from SerpAPI). Nav shows Home and Scan only.
   - **High severity** — safety warning, coverage, repair cost, deductible, insurance payment, what the customer pays, and next steps. Nav adds Policy, Claim and Nearby.
5. **Autofill insurance claim** → review → **File demo claim**. Filing is a demo only (nothing is sent to an insurer) and returns a mock claim number.
6. **After filing**, `GET /service-locations?location=<customer city>` loads nearby Toyota service locations with directions.

Click **API** in the left nav to see every request with its status and timing.

## 3D car models

Every customer drives a Toyota sedan, so they all use `public/models/camry.glb`, recoloured per customer. If `/3d-visualization/{id}` returns a `model_url`, that model is used instead. If no model is available, a built-in shape is drawn in code.

See `public/models/README.md` to add another model.

## Project structure

```
frontend/diagnostic-bay/
  app/            page entry, layout, global styles (globals.css)
  components/
    App.tsx         switches between the three screens
    Screens.tsx     customer select + OBD connecting screens
    Workspace.tsx   nav rail, top bar, 3D stage, HUD
    Panels.tsx      right-hand panel: diagnosis, insurance, claim, nearby
    ClaimDialog.tsx autofilled claim review and filing
    CarCanvas.tsx   Three.js scene (lighting, floor, camera, part picking)
    ApiLog.tsx      request log popover
  lib/
    api.ts          all backend calls + mapping responses into UI data
    useBay.ts       app state and the order things happen in
    car.ts          built-in car geometry and .glb part mapping
  public/models/  3D car files
```

## Troubleshooting

- **"Could not load customers"** — the backend isn't running, or it's on a different port. Check `http://localhost:8000/health`.
- **Diagnostic failed** — the backend returned an error (often a missing `SERPAPI_KEY` or Snowflake credentials in the backend's `.env`). The 3D car still loads.
- **Car doesn't appear** — check the browser console for WebGL errors; the rest of the app still works.

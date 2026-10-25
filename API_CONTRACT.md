# API Contract

## Frontend behavior

1. Start with a simple screen where the user enters or selects a customer ID.
2. Move to a dedicated **Waiting for OBD device** screen. It has a soft white
   background and animated blue radio waves similar to a location or wireless
   signal. It progresses through waiting, connecting, and connected states.
3. Keep the simulated OBD connection visible for about five seconds. Do not build
   real OBD pairing behavior for the demo.
4. As soon as the simulated connection succeeds, automatically call
   `POST /diagnostic-sessions` with the customer ID and relevant mock OBD data.
5. Move into one main workspace with a left navigation bar and the customer's car
   centered as the primary visual.
6. Load the 3D car through its separate visualization API while the diagnostic
   request runs. These requests must run independently so one does not block the
   other.
7. Render a vehicle model that matches the customer's car as closely as possible.
   It must be a Three.js-compatible interactive model that the user can rotate and
   inspect.
8. Touching or selecting a visible car part can highlight it in yellow. When the
   backend identifies a weak or affected part, that part stays highlighted in
   yellow automatically.
9. Keep the car visible while the diagnostic and insurance agent are working.
   Show a polished loading state instead of navigating to a blank page.
10. The visual direction should feel modern and cinematic, inspired by the focused
    vehicle presentation in GTA V's Los Santos Customs, while keeping the UI clean
    and centered on the user's actual car.
11. Use the returned severity to choose the next interface automatically. The
    user never selects the severity.
12. For low severity, show the returned helpful videos and articles in a panel
    beside or below the vehicle without removing the 3D model.
13. For high severity, show the safety warning, insurance coverage, deductible,
    estimated repair cost, customer cost, insurance payment, and recommended next
    steps around the same vehicle workspace.
14. Include a **File insurance claim** button for the high-severity flow. For the
    demo, this is a frontend-only action that briefly shows a filing state and
    then confirms that the claim was filed.
15. After the claim confirmation, call the location route and show
    nearby repair facilities, dealerships, or towing providers where the vehicle
    can be taken.

The user does not manually choose severity. The frontend does not calculate
insurance costs. A failed visualization or location request must not remove a
completed diagnostic result.

## Routes

### `GET /health`

Status: Implemented

Returns the backend status.

```json
{ "status": "ok" }
```

### `GET /customers/{customer_id}`

Status: Implemented

Returns the customer used to prepare the diagnostic workspace after an ID is
entered.

Each customer includes:

- `id`
- `name`
- `description`
- `insurance_level`
- `vehicle_model`
- `mileage`
- `location`

The frontend shows a customer loading state until this request finishes.

### `POST /diagnostic-sessions`

Status: Implemented

Starts the diagnostic flow.

```json
{
  "customer_id": "c05"
}
```

The frontend may also include real OBD data:

```json
{
  "customer_id": "c05",
  "diagnostic": {
    "issue_code": "P0730",
    "vehicle_model": "2019 Toyota Corolla SE",
    "mileage": 91876
  }
}
```

While waiting, the frontend shows:

1. Reading vehicle information
2. Evaluating issue severity
3. Preparing recommendations

Low-severity responses contain:

- `severity: "low"`
- `resources.articles`
- `resources.videos`

The frontend displays article and video cards and does not show insurance costs.

High-severity responses contain:

- `severity: "high"`
- `recommendations.summary`
- `recommendations.urgency`
- `recommendations.safe_to_drive`
- `recommendations.coverage_status`
- `recommendations.coverage_explanation`
- `recommendations.cost`
- `recommendations.recommendations`
- `recommendations.required_parts`

The frontend displays the safety warning first, followed by coverage, costs, and
next steps.

### `GET /3d-visualization/{customer_id}`

Status: Scaffolded

Loads the vehicle visualization on the same page as the diagnostic flow. The
frontend starts this request when the customer is selected instead of waiting for
the diagnostic request.

Expected response fields:

- `customer_id`
- `vehicle_model`
- `mileage`
- `model_url`
- `highlighted_components`
- `annotations`

The 3D panel has its own loading and error state. A failure does not block or hide
the diagnostic result. The model must be usable in Three.js. Users can rotate and
inspect it, and affected components returned by the backend are highlighted in
yellow.

### `GET /service-locations`

Status: Implemented

Query parameters:

- `location`: a city or address string such as `Austin, TX`

Returns up to five nearby Toyota service locations using OpenStreetMap data.

Each result includes:

- `name`
- `address`
- `distance_miles`
- `phone`
- `latitude`
- `longitude`

The frontend calls this after the main diagnostic result or mocked claim step. It
shows a separate location loading state.

## Frontend experience

### 1. Customer entry

The first interaction is a simple customer ID screen. After the ID is accepted,
the frontend has enough information to load the matching customer, vehicle,
insurance level, mileage, and location.

### 2. OBD connection screen

The next screen has a soft white background with blue radio-wave animation that
suggests the app is searching for and connecting to the vehicle.

Suggested messages:

- Waiting for OBD device
- Connecting to vehicle
- Vehicle connected

For the demo, this state lasts about five seconds. It does not need a real OBD
connection protocol yet. When the timer finishes, the frontend automatically
calls `POST /diagnostic-sessions` with the customer ID and any available mock OBD
data.

### 3. Main vehicle workspace

After connection, the experience moves to one main page with a left navigation
bar and the customer's vehicle centered in the page.

The vehicle is rendered as an interactive Three.js model. The asset should match
the customer's vehicle as closely as possible and use a web-compatible format
such as GLB or glTF. The user can rotate the vehicle and select visible parts.

Normal interaction can briefly highlight the selected part. When the backend
identifies an affected component, that component remains highlighted in yellow.
The visualization comes from `GET /3d-visualization/{customer_id}` and loads
independently from the diagnostic request.

The visual direction should feel modern and focused, with the car as the main
object, similar to a premium vehicle-customization garage. UI panels should
support the model without covering it.

### 4. Diagnostic loading state

The car stays visible while the diagnostic request is running. The page should
show clear progress without navigating away:

1. Reading vehicle information
2. Evaluating issue severity
3. Reviewing diagnostic findings
4. Preparing the next steps

The loading treatment should feel intentional and may animate the vehicle or the
affected area. The frontend must prevent duplicate diagnostic requests.

### 5. Low-severity result

Low severity triggers the article and video resources returned by
`POST /diagnostic-sessions`. This branch is based on issue severity, not the
customer's insurance level.

The resources can appear in a panel beside or below the 3D vehicle:

- A primary recommended video with thumbnail
- Additional video cards
- Helpful article cards with source and summary
- Direct links that open in a new tab

The 3D vehicle stays visible so the result feels like a continuation of the same
experience.

### 6. High-severity insurance result

High severity opens the insurance result area without replacing the vehicle
workspace. The most important information appears first:

- Stop-driving or safety warning
- Coverage status
- Estimated repair cost
- Deductible
- Estimated customer cost
- Estimated insurance payment
- Coverage explanation and recommended steps

The affected vehicle component remains highlighted in yellow while this
information is displayed.

### 7. Mock insurance claim

The high-severity result includes a **File insurance claim** button. This is a
frontend-only demo interaction and does not call a backend route.

After the user presses the button, show a short loading state such as **Preparing
your claim**, followed by a confirmation such as **Claim filed — moving to repair
options**. Then continue automatically to the location step.

### 8. Repair locations

After the high-severity result or mocked claim step is ready, the frontend calls
`GET /service-locations` using the location already loaded from the customer. The
page then shows nearby Toyota service locations.

Location results should appear as cards with distance, address, and phone. The
frontend can create a map link from the returned latitude and longitude. This
panel loads independently so it does not delay the diagnosis or insurance result.

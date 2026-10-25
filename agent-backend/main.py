import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from helper import (
    get_customer_information,
    get_device_schematics,
    get_insurance_information,
    give_recommendations,
)
from low_severity_resources import get_low_severity_resources
from schemas import (
    CustomerResponse,
    DiagnosticContext,
    DiagnosticSessionRequest,
    DiagnosticSessionResponse,
    HealthResponse,
    LowSeverityResources,
    Resource,
    ServiceLocationsResponse,
    VehicleVisualizationResponse,
)
from service_locations import find_service_locations
from sensor_gateway import router as sensor_router


app = FastAPI(title="Agent Backend", version="0.1.0")
app.include_router(sensor_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/customers/{customer_id}")
async def get_customer(customer_id: str) -> CustomerResponse:
    try:
        customer = get_customer_information(customer_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return CustomerResponse(
        id=customer.id,
        name=customer.name,
        description=customer.description,
        insurance_level=customer.insurance_level,
        vehicle_model=customer.vehicle_model,
        mileage=customer.mileage,
        location=customer.location,
        severity=customer.issue.severity,
        issue_code=customer.issue.code,
        issue_description=customer.issue.description,
        estimated_repair_cost=customer.technician_diagnosis.estimated_repair_cost if customer.id != "c08" else None,
    )


@app.post("/diagnostic-sessions")
async def create_diagnostic_session(
    request: DiagnosticSessionRequest,
) -> DiagnosticSessionResponse:
    try:
        customer = get_customer_information(request.customer_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    diagnostic = request.diagnostic or DiagnosticContext(
        issue_code=customer.issue.code,
        vehicle_model=customer.vehicle_model,
        mileage=customer.mileage,
    )
    severity = customer.issue.severity

    if severity == "low":
        # The bundled walkthrough is a deterministic demo; it does not need a
        # search-provider key to demonstrate a routine maintenance session.
        if customer.id == "c08" and customer.issue.code == "MAINT-AIR-FILTER":
            if diagnostic.issue_code != customer.issue.code or diagnostic.vehicle_model != customer.vehicle_model:
                raise HTTPException(status_code=422, detail="The bundled demo supports only this Land Cruiser profile's air-filter maintenance code and vehicle.")
            return DiagnosticSessionResponse(
                severity="low",
                source="bundled-demo",
                resources=LowSeverityResources(
                    videos=[],
                    articles=[Resource(
                        title="Toyota owner manuals — confirm your engine and air-cleaner layout",
                        link="https://www.toyota.ae/en/owners/owners-manual/",
                        source="Toyota",
                        snippet="Use the manual for your exact vehicle and engine before following the illustrative walkthrough.",
                    )],
                ),
            )
        try:
            resources = await get_low_severity_resources(
                issue=customer.issue.description,
                vehicle_model=diagnostic.vehicle_model,
            )
        except (httpx.HTTPError, KeyError) as error:
            raise HTTPException(
                status_code=502,
                detail="The resource search provider is unavailable",
            ) from error
        response = DiagnosticSessionResponse(
            severity="low",
            source="serpapi",
            resources=resources,
        )
        print(response.model_dump_json(indent=2))
        return response

    customer_context = customer.model_dump_json(indent=2)
    insurance_context = get_insurance_information(customer.insurance_level)
    diagnostic_context = get_device_schematics(
        {
            "obd_data": diagnostic.model_dump(),
            "technician_diagnosis": customer.technician_diagnosis.model_dump(),
        }
    )

    try:
        recommendations = await give_recommendations(
            diagnostic_context=diagnostic_context,
            customer_context=customer_context,
            insurance_context=insurance_context,
        )
    except (httpx.HTTPError, RuntimeError, KeyError) as error:
        raise HTTPException(
            status_code=502,
            detail="The diagnostic agent is unavailable",
        ) from error

    response = DiagnosticSessionResponse(
        severity="high",
        source="snowflake",
        recommendations=recommendations,
    )
    print(response.model_dump_json(indent=2))
    return response


@app.get("/3d-visualization/{customer_id}")
async def prepare_3d_visualization(customer_id: str) -> VehicleVisualizationResponse:
    try:
        customer = get_customer_information(customer_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    land_cruiser = "land cruiser 300" in customer.vehicle_model.lower()
    return VehicleVisualizationResponse(
        customer_id=customer.id,
        vehicle_model=customer.vehicle_model,
        mileage=customer.mileage,
        model_url="/models/land-cruiser-300.glb" if land_cruiser else None,
        open_hood_model_url="/models/land-cruiser-300-open-hood.glb" if land_cruiser else None,
    )


@app.get("/service-locations")
def get_service_locations(location: str) -> ServiceLocationsResponse:
    try:
        results = find_service_locations(location)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except OSError as error:
        raise HTTPException(
            status_code=502,
            detail="The service-location provider is unavailable",
        ) from error

    return ServiceLocationsResponse(location=location, results=results)


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")

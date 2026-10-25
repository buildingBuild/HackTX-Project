from fastapi import FastAPI, HTTPException

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
    ServiceLocationsResponse,
)
from service_locations import find_service_locations


app = FastAPI(title="Agent Backend", version="0.1.0")


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
    )


@app.post("/diagnostic-sessions")
async def create_diagnostic_session(
    request: DiagnosticSessionRequest,
) -> DiagnosticSessionResponse:
    customer = get_customer_information(request.customer_id)
    diagnostic = request.diagnostic or DiagnosticContext(
        issue_code=customer.issue.code,
        vehicle_model=customer.vehicle_model,
        mileage=customer.mileage,
    )
    severity = customer.issue.severity

    if severity == "low":
        resources = await get_low_severity_resources(
            issue=customer.issue.description,
            vehicle_model=diagnostic.vehicle_model,
        )
        response = DiagnosticSessionResponse(
            severity="low",
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

    recommendations = await give_recommendations(
        diagnostic_context=diagnostic_context,
        customer_context=customer_context,
        insurance_context=insurance_context,
    )

    response = DiagnosticSessionResponse(
        severity="high",
        recommendations=recommendations,
    )
    print(response.model_dump_json(indent=2))
    return response


@app.get("/3d-visualization/{customer_id}")
async def prepare_3d_visualization(customer_id: str) -> None:
    customer = get_customer_information(customer_id)
    vehicle_model = customer.vehicle_model
    mileage = customer.mileage


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

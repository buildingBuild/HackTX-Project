from fastapi import FastAPI

from helper import (
    get_customer_information,
    get_device_schematics,
    get_insurance_information,
    give_recommendations,
    handle_low_severity,
    search_parts,
)
from schemas import (
    DiagnosticSessionRequest,
    DiagnosticSessionResponse,
    HealthResponse,
)


app = FastAPI(title="Agent Backend", version="0.1.0")


@app.post("/diagnostic-sessions")
async def create_diagnostic_session(
    request: DiagnosticSessionRequest,
) -> DiagnosticSessionResponse:
    if request.diagnostic.severity == "low":
        await handle_low_severity(
            customer_id=request.customer_id,
            diagnostic_data=request.diagnostic.model_dump(),
        )
        return DiagnosticSessionResponse(severity="low")

    customer = get_customer_information(request.customer_id)
    customer_context = customer.model_dump_json(indent=2)
    insurance_context = get_insurance_information(customer.insurance_level)
    diagnostic_context = get_device_schematics(request.diagnostic.model_dump())

    recommendations = await give_recommendations(
        diagnostic_context=diagnostic_context,
        customer_context=customer_context,
        insurance_context=insurance_context,
    )

    part_searches = await search_parts(
        parts=recommendations.required_parts,
        car_model=request.diagnostic.vehicle_model,
    )

    return DiagnosticSessionResponse(
        severity="high",
        recommendations=recommendations,
        part_searches=part_searches,
    )


@app.get("/3d-visualization/{customer_id}")
async def prepare_3d_visualization(customer_id: str) -> None:
    customer = get_customer_information(customer_id)
    vehicle_model = customer.vehicle_model
    mileage = customer.mileage


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")

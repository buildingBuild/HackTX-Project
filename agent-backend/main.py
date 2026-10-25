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
            customer_data=request.customer.model_dump(),
            vehicle_data=request.vehicle.model_dump(),
            diagnostic_data=request.diagnostic.model_dump(),
        )
        return DiagnosticSessionResponse(severity="low")

    customer_context = get_customer_information(request.customer.model_dump())
    insurance_context = get_insurance_information(request.insurance.model_dump())
    diagnostic_context = get_device_schematics(
        {
            "vehicle": request.vehicle.model_dump(),
            "diagnostic": request.diagnostic.model_dump(),
        }
    )

    recommendations = await give_recommendations(
        diagnostic_context=diagnostic_context,
        customer_context=customer_context,
        insurance_context=insurance_context,
    )

    vehicle_name = " ".join(
        value
        for value in (
            str(request.vehicle.year),
            request.vehicle.make,
            request.vehicle.model,
            request.vehicle.trim,
        )
        if value
    )
    part_searches = await search_parts(
        parts=recommendations.required_parts,
        car_model=vehicle_name,
    )

    return DiagnosticSessionResponse(
        severity="high",
        recommendations=recommendations,
        part_searches=part_searches,
    )


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")

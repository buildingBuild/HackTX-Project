from fastapi import FastAPI

from helper import (
    get_customer_information,
    get_device_schematics,
    get_insurance_information,
    give_recommendations,
    handle_low_severity,
)
from schemas import (
    DiagnosticContext,
    DiagnosticSessionRequest,
    DiagnosticSessionResponse,
    HealthResponse,
)


app = FastAPI(title="Agent Backend", version="0.1.0")


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
        await handle_low_severity(
            customer_id=request.customer_id,
            diagnostic_data=diagnostic.model_dump(),
        )
        response = DiagnosticSessionResponse(severity="low")
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


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")

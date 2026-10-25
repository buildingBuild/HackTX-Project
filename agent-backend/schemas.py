from typing import Literal

from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str


class CustomerContext(BaseModel):
    name: str
    description: str
    insurance_level: Literal["silver", "gold", "platinum"]
    mileage: int
    location: str


class VehicleContext(BaseModel):
    year: int
    make: str
    model: str
    trim: str | None = None


class DiagnosticContext(BaseModel):
    code: str
    description: str
    severity: Literal["low", "high"]
    symptoms: list[str] = Field(default_factory=list)
    confirmed_diagnosis: str | None = None
    estimated_repair_cost: float | None = None
    currency: str = "USD"
    technician_findings: str | None = None


class InsuranceContext(BaseModel):
    level: Literal["silver", "gold", "platinum"]
    deductible: float
    coverage: list[str]
    conditions: list[str] = Field(default_factory=list)


class DiagnosticSessionRequest(BaseModel):
    customer: CustomerContext
    vehicle: VehicleContext
    diagnostic: DiagnosticContext
    insurance: InsuranceContext


class PartListing(BaseModel):
    title: str
    thumbnail: str | None = None
    merchant_link: str | None = Field(default=None, validation_alias="link")
    google_product_link: str | None = Field(
        default=None,
        validation_alias="product_link",
    )
    source: str | None = None
    price: str | None = None
    extracted_price: float | None = None
    rating: float | None = None
    reviews: int | None = None


class PartSearchResult(BaseModel):
    part: str
    listings: list[PartListing]


class CostEstimate(BaseModel):
    currency: str
    estimated_repair_cost: float | None
    deductible: float | None
    estimated_customer_cost: float | None
    estimated_insurance_payment: float | None
    calculation: str


class RecommendationResult(BaseModel):
    summary: str
    urgency: Literal["low", "high"]
    safe_to_drive: bool
    coverage_status: Literal["covered", "not_covered", "unclear"]
    coverage_explanation: str
    cost: CostEstimate
    recommendations: list[str]
    required_parts: list[str]


class DiagnosticSessionResponse(BaseModel):
    severity: Literal["low", "high"]
    recommendations: RecommendationResult | None = None
    part_searches: list[PartSearchResult] = Field(default_factory=list)


class InteractionSetup(BaseModel):
    vehicle_model: str
    model_url: str | None = None
    highlighted_parts: list[str]
    annotations: list[str]

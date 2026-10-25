from typing import Literal

from pydantic import BaseModel, Field

InsuranceLevel = Literal["silver", "gold", "platinum"]


class RootResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str


class CustomerIssue(BaseModel):
    description: str
    code: str
    severity: Literal["low", "high"]


class TechnicianDiagnosis(BaseModel):
    confirmed_diagnosis: str
    estimated_repair_cost: float
    currency: str
    technician_findings: str


class CustomerInformation(BaseModel):
    id: str
    name: str
    description: str
    vehicle_model: str
    mileage: int
    insurance_level: InsuranceLevel
    issue: CustomerIssue
    technician_diagnosis: TechnicianDiagnosis
    location: str


class DiagnosticContext(BaseModel):
    issue_code: str
    vehicle_model: str
    mileage: int


class DiagnosticSessionRequest(BaseModel):
    customer_id: str
    diagnostic: DiagnosticContext | None = None


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


class Resource(BaseModel):
    title: str
    link: str
    snippet: str | None = None
    thumbnail: str | None = None
    source: str | None = None


class LowSeverityResources(BaseModel):
    articles: list[Resource]
    videos: list[Resource]


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
    coverage_status: Literal[
        "covered",
        "not_covered",
        "unclear",
        "undetermined",
    ]
    coverage_explanation: str
    cost: CostEstimate
    recommendations: list[str]
    required_parts: list[str]


class DiagnosticSessionResponse(BaseModel):
    severity: Literal["low", "high"]
    recommendations: RecommendationResult | None = None
    part_searches: list[PartSearchResult] = Field(default_factory=list)
    resources: LowSeverityResources | None = None

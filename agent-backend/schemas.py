from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str


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

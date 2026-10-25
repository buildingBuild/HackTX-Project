from fastapi import FastAPI
from schemas import HealthResponse, RootResponse


app = FastAPI(title="Agent Backend", version="0.1.0")


@app.get("/")
async def root() -> RootResponse:
    return RootResponse(message="Agent backend is running")


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")

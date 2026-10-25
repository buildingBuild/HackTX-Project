"""Single-device, in-memory Wi-Fi gateway for the c08 Land Cruiser scan.

The browser owns scan lifetime; the ESP32 polls for that scan and posts readings.
Only device endpoints need the server-side device secret. No OBD vehicle bus is
implemented here: OBD frames are accepted exclusively as explicit emulation.
"""
import math
import os
import re
import secrets
from collections import OrderedDict, deque
from datetime import datetime, timezone
from threading import RLock
from time import monotonic
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator

router = APIRouter()
LEASE_SECONDS = 8
MAX_SCAN_SECONDS = 120


class ScanStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scanId: UUID
    customerId: Literal["c08"]


class ScanStop(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Literal["completed", "cancelled", "error"]


class ObdFrames(BaseModel):
    model_config = ConfigDict(extra="forbid")
    coolant: str = Field(pattern=r"^4105[0-9a-fA-F]{2}$")
    rpm: str = Field(pattern=r"^410[Cc][0-9a-fA-F]{4}$")
    voltage: str = Field(pattern=r"^4142[0-9a-fA-F]{4}$")


class SensorReading(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scanId: UUID
    timestamp: AwareDatetime
    simulated: StrictBool
    temperature: Annotated[float, Field(strict=True, ge=-50, le=200, allow_inf_nan=False)] | None
    vibration: Annotated[float, Field(strict=True, ge=0, le=3.3, allow_inf_nan=False)] | None
    voltage: Annotated[float, Field(strict=True, ge=0, le=60, allow_inf_nan=False)] | None
    rpm: Annotated[float, Field(strict=True, ge=0, le=15000, allow_inf_nan=False)] | None
    obd: ObdFrames | None = None

    @field_validator("timestamp", mode="before")
    @classmethod
    def require_iso_timestamp(cls, value):
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})", value):
            raise ValueError("timestamp must be an ISO 8601 string with a time zone")
        return value

    @model_validator(mode="after")
    def check_measurements(self):
        if all(getattr(self, key) is None for key in ("temperature", "vibration", "voltage", "rpm")):
            raise ValueError("At least one configured sensor must supply a measurement")
        if self.obd:
            if not self.simulated:
                raise ValueError("OBD frames in this integration must be marked simulated")
            decoded = {
                "temperature": int(self.obd.coolant[4:], 16) - 40,
                "rpm": int(self.obd.rpm[4:], 16) / 4,
                "voltage": int(self.obd.voltage[4:], 16) / 1000,
            }
            for key, value in decoded.items():
                metric = getattr(self, key)
                if metric is None or not math.isclose(metric, value, abs_tol=0.001):
                    raise ValueError(f"Decoded {key} does not match its OBD frame")
        return self


class DeviceError(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scanId: UUID
    error: str = Field(min_length=1, max_length=240)


def configured() -> bool:
    return len(os.getenv("SENSOR_DEVICE_TOKEN", "")) >= 16


def require_device(authorization: str = Header(default="")):
    expected = os.getenv("SENSOR_DEVICE_TOKEN", "")
    if not configured():
        raise HTTPException(503, "Hardware mode is not configured on the backend")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    if not secrets.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(401, "Invalid device authorization")


class SensorGateway:
    def __init__(self, clock=monotonic):
        self.clock = clock
        self.lock = RLock()
        self.sessions = OrderedDict()
        self.current = None

    def expire(self):
        if self.current:
            session = self.sessions[self.current]
            if self.clock() > session["lease"] or self.clock() - session["start"] > MAX_SCAN_SECONDS:
                session["active"] = False
                session["reason"] = "expired"
                self.current = None

    def start(self, scan_id):
        with self.lock:
            self.expire()
            if scan_id in self.sessions:
                if self.sessions[scan_id]["active"]:
                    return {"scanId": scan_id, "active": True}
                raise HTTPException(409, "Scan IDs cannot be reused")
            if self.current:
                raise HTTPException(409, "Another Land Cruiser device scan is active; finish or cancel it first")
            while len(self.sessions) >= 32:
                self.sessions.popitem(last=False)
            self.sessions[scan_id] = {
                "active": True, "start": self.clock(), "lease": self.clock() + LEASE_SECONDS,
                "sequence": 0, "readings": deque(maxlen=120), "lastReceived": None,
                "lastTimestamp": None, "lastReading": None, "error": None,
                "simulated": None,
            }
            self.current = scan_id
            return {"scanId": scan_id, "active": True}

    def stop(self, scan_id, reason):
        with self.lock:
            session = self.sessions.get(scan_id)
            if session is None:
                raise HTTPException(404, "Unknown sensor scan")
            session["active"] = False
            session["reason"] = reason
            if self.current == scan_id:
                self.current = None
            return {"scanId": scan_id, "active": False}

    def snapshot(self, scan_id, after):
        with self.lock:
            self.expire()
            session = self.sessions.get(scan_id)
            if session is None:
                raise HTTPException(404, "Unknown sensor scan")
            if session["active"]:
                session["lease"] = self.clock() + LEASE_SECONDS
            if not session["active"]:
                connection, message = "stopped", "Device collection stopped"
            elif session["error"]:
                connection, message = "error", session["error"]
            elif session["lastReceived"] is None:
                connection = "connecting" if self.clock() - session["start"] <= 4 else "disconnected"
                message = "Waiting for device readings" if connection == "connecting" else "No device readings received; check ESP32 power, Wi-Fi, and sensor setup"
            elif self.clock() - session["lastReceived"] > 4:
                connection, message = "disconnected", "Device disconnected; waiting for reconnection"
            else:
                connection, message = "connected", "Receiving readings from the ESP32 gateway"
            return {
                "scanId": scan_id, "active": session["active"], "connection": connection,
                "message": message, "samples": session["sequence"], "lastReading": session["lastReading"],
                "readings": [item for item in session["readings"] if item["sequence"] > after],
            }

    def control(self):
        with self.lock:
            self.expire()
            return {"scanId": self.current, "timestamp": datetime.now(timezone.utc).isoformat()}

    def ingest(self, reading):
        with self.lock:
            self.expire()
            scan_id = str(reading.scanId)
            if self.current != scan_id:
                raise HTTPException(410, "No active scan matches this reading; stop sampling")
            session = self.sessions[scan_id]
            age = (datetime.now(timezone.utc) - reading.timestamp).total_seconds()
            if age > 15 or age < -5:
                raise HTTPException(422, "Reading timestamp is stale or in the future")
            if session["lastTimestamp"] is not None and reading.timestamp <= session["lastTimestamp"]:
                raise HTTPException(409, "Duplicate or out-of-order device reading")
            if session["simulated"] is not None and session["simulated"] != reading.simulated:
                raise HTTPException(409, "Measurement provenance cannot change within a scan")
            session["simulated"] = reading.simulated
            session["sequence"] += 1
            session["lastReceived"] = self.clock()
            session["lastTimestamp"] = reading.timestamp
            session["lastReading"] = reading.timestamp.isoformat()
            session["error"] = None
            session["readings"].append({"sequence": session["sequence"], "reading": reading.model_dump(mode="json", exclude_none=False)})
            return {"accepted": True, "sequence": session["sequence"]}

    def device_error(self, error):
        with self.lock:
            self.expire()
            if self.current != str(error.scanId):
                raise HTTPException(410, "No active scan matches this device status")
            self.sessions[self.current]["error"] = error.error
            return {"accepted": True}


gateway = SensorGateway()


@router.get("/sensor-config")
def sensor_config():
    return {"hardwareConfigured": configured(), "deviceId": os.getenv("SENSOR_DEVICE_ID", "land-cruiser-esp32") if configured() else None}


@router.post("/sensor-scans")
def start_sensor_scan(body: ScanStart):
    if not configured():
        raise HTTPException(503, "Configure SENSOR_DEVICE_TOKEN on the backend before selecting Hardware Mode")
    return gateway.start(str(body.scanId))


@router.get("/sensor-scans/{scan_id}")
def get_sensor_scan(scan_id: UUID, after: int = 0):
    return gateway.snapshot(str(scan_id), max(0, after))


@router.post("/sensor-scans/{scan_id}/stop")
def stop_sensor_scan(scan_id: UUID, body: ScanStop):
    return gateway.stop(str(scan_id), body.reason)


@router.get("/device/scan-control", dependencies=[Depends(require_device)])
def device_scan_control():
    return gateway.control()


@router.post("/device/readings", dependencies=[Depends(require_device)])
def device_readings(body: SensorReading):
    return gateway.ingest(body)


@router.post("/device/status", dependencies=[Depends(require_device)])
def device_status(body: DeviceError):
    return gateway.device_error(body)

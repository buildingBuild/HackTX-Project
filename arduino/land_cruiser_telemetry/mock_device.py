"""Run in place of an ESP32 to exercise Hardware Mode's HTTP gateway.

All generated measurements are explicitly simulated. The process waits for the
app to start c08's scan; it never creates a scan or measures a real vehicle.
"""
import argparse
import json
import os
import random
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv


def emulated_reading(scan_id, timestamp, index):
    warning = index % 10 == 7
    temperature = 108 if warning else random.randint(86, 93)
    rpm_raw = (random.randint(800, 940) + (1000 if index % 5 == 3 else 0)) * 4
    voltage_raw = 11500 if warning else random.randint(13600, 14300)
    return {
        "scanId": scan_id, "timestamp": timestamp, "simulated": True,
        "temperature": temperature, "rpm": rpm_raw / 4, "voltage": voltage_raw / 1000,
        "vibration": round(random.uniform(0.04, 0.14), 3),
        "obd": {"coolant": f"4105{temperature + 40:02X}", "rpm": f"410C{rpm_raw:04X}", "voltage": f"4142{voltage_raw:04X}"},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway", default="http://localhost:8000")
    args = parser.parse_args()
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    token = os.getenv("SENSOR_DEVICE_TOKEN", "")
    if len(token) < 16:
        raise SystemExit("Set SENSOR_DEVICE_TOKEN (at least 16 characters) in the backend .env or environment first.")

    def request(path, body=None):
        payload = None if body is None else json.dumps(body).encode()
        req = Request(args.gateway.rstrip("/") + path, data=payload, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with urlopen(req, timeout=2) as response:
            return json.load(response)

    current = None
    index = 0
    print("Device emulator ready. ALL readings are SIMULATED. Waiting for a Land Cruiser scan.", flush=True)
    try:
        while True:
            started = time.monotonic()
            try:
                control = request("/device/scan-control")
                scan_id = control["scanId"]
                if scan_id != current:
                    current, index = scan_id, 0
                    print(f"Scan {'started: ' + current if current else 'stopped; waiting'}", flush=True)
                if current:
                    request("/device/readings", emulated_reading(current, control["timestamp"], index))
                    index += 1
            except HTTPError as error:
                print(f"Gateway HTTP {error.code}; waiting/retrying", flush=True)
            except (URLError, TimeoutError, KeyError, ValueError):
                print("Gateway unavailable or invalid control response; retrying", flush=True)
            time.sleep(max(0, 1 - (time.monotonic() - started)))
    except KeyboardInterrupt:
        print("Device emulator stopped.")


if __name__ == "__main__":
    main()

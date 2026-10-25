import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from main import app
from sensor_gateway import SensorGateway

TEST_TOKEN = "test-device-secret-not-a-real-key"


class SensorGatewayTest(unittest.TestCase):
    def setUp(self):
        self.time = 0
        self.gateway = SensorGateway(clock=lambda: self.time)
        self.env = patch.dict(os.environ, {"SENSOR_DEVICE_TOKEN": TEST_TOKEN})
        self.store = patch("sensor_gateway.gateway", self.gateway)
        self.env.start(); self.store.start()
        self.addCleanup(self.env.stop); self.addCleanup(self.store.stop)
        self.client = TestClient(app)
        self.scan_id = str(uuid4())
        self.headers = {"Authorization": f"Bearer {TEST_TOKEN}"}

    def start(self, scan_id=None):
        return self.client.post("/sensor-scans", json={"scanId": scan_id or self.scan_id, "customerId": "c08"})

    def reading(self, **changes):
        data = {
            "scanId": self.scan_id, "timestamp": datetime.now(timezone.utc).isoformat(), "simulated": True,
            "temperature": 83.0, "vibration": 0.12, "voltage": 13.8, "rpm": 850,
            "obd": {"coolant": "41057B", "rpm": "410C0D48", "voltage": "414235E8"},
        }
        data.update(changes)
        return self.client.post("/device/readings", json=data, headers=self.headers)

    def snapshot(self, after=0):
        return self.client.get(f"/sensor-scans/{self.scan_id}?after={after}").json()

    def test_defaults_without_credentials_and_never_exposes_device_secret(self):
        config = self.client.get("/sensor-config")
        self.assertTrue(config.json()["hardwareConfigured"])
        self.assertNotIn(TEST_TOKEN, config.text)
        with patch.dict(os.environ, {"SENSOR_DEVICE_TOKEN": ""}):
            self.assertFalse(self.client.get("/sensor-config").json()["hardwareConfigured"])
            self.assertEqual(self.start().status_code, 503)

    def test_only_land_cruiser_one_active_scan_and_no_id_reuse(self):
        self.assertEqual(self.client.post("/sensor-scans", json={"scanId": self.scan_id, "customerId": "c01"}).status_code, 422)
        self.assertEqual(self.start().status_code, 200)
        self.assertEqual(self.start().status_code, 200)
        self.assertEqual(self.start(str(uuid4())).status_code, 409)
        self.client.post(f"/sensor-scans/{self.scan_id}/stop", json={"reason": "completed"})
        self.assertEqual(self.start().status_code, 409)

    def test_device_requires_authorization_and_acquires_current_scan_automatically(self):
        self.assertEqual(self.client.get("/device/scan-control").status_code, 401)
        self.assertIsNone(self.client.get("/device/scan-control", headers=self.headers).json()["scanId"])
        self.start()
        self.assertEqual(self.client.get("/device/scan-control", headers=self.headers).json()["scanId"], self.scan_id)

    def test_hardware_pipeline_accepts_emulated_obd_and_incremental_sample_cursor(self):
        self.start()
        self.assertEqual(self.reading().status_code, 200)
        snapshot = self.snapshot()
        self.assertEqual(snapshot["samples"], 1)
        self.assertEqual(snapshot["connection"], "connected")
        self.assertTrue(snapshot["readings"][0]["reading"]["simulated"])
        self.assertEqual(snapshot["readings"][0]["reading"]["rpm"], 850)
        self.assertEqual(self.snapshot(after=1)["readings"], [])
        self.assertIsNotNone(snapshot["lastReading"])

    def test_malformed_wrong_session_out_of_order_and_stale_readings_are_rejected(self):
        self.start()
        for change in [{"voltage": "13.8"}, {"rpm": True}, {"rpm": -1}, {"vibration": 9}, {"simulated": "true"}, {"simulated": False}, {"temperature": 84}, {"timestamp": "2026-10-25T12:00:00"}, {"timestamp": datetime.now(timezone.utc).timestamp()}, {"scanId": "invalid"}]:
            with self.subTest(change=change):
                self.assertEqual(self.reading(**change).status_code, 422)
        self.assertEqual(self.reading(scanId=str(uuid4())).status_code, 410)
        self.assertEqual(self.reading(timestamp=(datetime.now(timezone.utc) - timedelta(seconds=20)).isoformat()).status_code, 422)
        fixed = datetime.now(timezone.utc).isoformat()
        self.assertEqual(self.reading(timestamp=fixed).status_code, 200)
        self.assertEqual(self.reading(timestamp=fixed).status_code, 409)
        self.assertEqual(self.snapshot()["samples"], 1)

    def test_external_sensor_channels_may_be_null_without_fabricating_values(self):
        self.start()
        self.assertEqual(self.reading(simulated=False, obd=None, temperature=25, voltage=None, rpm=None, vibration=None).status_code, 200)
        reading = self.snapshot()["readings"][0]["reading"]
        self.assertFalse(reading["simulated"])
        self.assertIsNone(reading["rpm"])
        self.assertEqual(self.reading(timestamp=(datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()).status_code, 409)

    def test_connection_loss_device_error_and_reconnection(self):
        self.start(); self.reading()
        self.time = 5
        self.assertEqual(self.snapshot()["connection"], "disconnected")
        self.client.post("/device/status", json={"scanId": self.scan_id, "error": "Temperature sensor unavailable"}, headers=self.headers)
        self.assertEqual(self.snapshot()["connection"], "error")
        self.assertEqual(self.reading(timestamp=(datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()).status_code, 200)
        self.assertEqual(self.snapshot()["connection"], "connected")

    def test_finish_and_cancel_stop_device_and_new_scan_starts_empty(self):
        for reason in ["completed", "cancelled"]:
            self.scan_id = str(uuid4()); self.start(); self.reading()
            self.client.post(f"/sensor-scans/{self.scan_id}/stop", json={"reason": reason})
            self.assertEqual(self.reading().status_code, 410)
            self.assertIsNone(self.client.get("/device/scan-control", headers=self.headers).json()["scanId"])
            self.scan_id = str(uuid4()); self.start()
            self.assertEqual(self.snapshot()["samples"], 0)
            self.client.post(f"/sensor-scans/{self.scan_id}/stop", json={"reason": "cancelled"})

    def test_lost_browser_lease_expires_and_refuses_further_samples(self):
        self.start(); self.time = 9
        self.assertIsNone(self.client.get("/device/scan-control", headers=self.headers).json()["scanId"])
        self.assertEqual(self.reading().status_code, 410)


if __name__ == "__main__":
    unittest.main()

"""Offline API tests: no SerpAPI or Snowflake credentials are required."""
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app


class GuidedRepairTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_profile_and_models_are_available(self):
        profile = self.client.get("/customers/c08").json()
        self.assertEqual(profile["vehicle_model"], "2022 Toyota Land Cruiser 300 VX.R")
        self.assertEqual(profile["mileage"], 32480)
        model = self.client.get("/3d-visualization/c08").json()
        self.assertEqual(model["model_url"], "/models/land-cruiser-300.glb")
        self.assertEqual(model["open_hood_model_url"], "/models/land-cruiser-300-open-hood.glb")

    def test_demo_does_not_call_external_services(self):
        with patch("main.get_low_severity_resources", new_callable=AsyncMock) as search:
            response = self.client.post("/diagnostic-sessions", json={"customer_id": "c08"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["severity"], "low")
        self.assertTrue(response.json()["resources"]["articles"])
        search.assert_not_called()

    def test_other_fault_codes_cannot_be_treated_as_the_maintenance_demo(self):
        response = self.client.post("/diagnostic-sessions", json={
            "customer_id": "c08",
            "diagnostic": {"issue_code": "P0730", "vehicle_model": "2022 Toyota Land Cruiser 300 VX.R", "mileage": 32480},
        })
        self.assertEqual(response.status_code, 422)

    def test_unknown_profiles_and_existing_vehicle_fallback(self):
        self.assertEqual(self.client.get("/3d-visualization/unknown").status_code, 404)
        self.assertIsNone(self.client.get("/3d-visualization/c01").json()["model_url"])
        self.assertEqual(self.client.get("/customers/c07").status_code, 200)


if __name__ == "__main__":
    unittest.main()

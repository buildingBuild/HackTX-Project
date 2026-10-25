"""Offline API tests: no SerpAPI or Snowflake credentials are required."""
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app
from schemas import LowSeverityResources, RecommendationResult


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

    def test_three_demo_paths_publish_correct_selection_metadata(self):
        for customer, severity, code in [("c08", "low", "MAINT-AIR-FILTER"), ("c01", "low", "P0562"), ("c04", "high", "B1650")]:
            profile = self.client.get(f"/customers/{customer}").json()
            self.assertEqual(profile["severity"], severity)
            self.assertEqual(profile["issue_code"], code)
            self.assertIn("estimated_repair_cost", profile)

    def test_existing_low_profile_uses_serpapi_and_high_profile_uses_agent(self):
        with patch("main.get_low_severity_resources", new_callable=AsyncMock, return_value=LowSeverityResources(articles=[], videos=[])) as search:
            response = self.client.post("/diagnostic-sessions", json={"customer_id": "c01"})
        self.assertEqual(response.json()["source"], "serpapi")
        search.assert_awaited_once()
        recommendation = RecommendationResult.model_validate({
            "summary": "SRS inspection needed", "urgency": "high", "safe_to_drive": False,
            "coverage_status": "covered", "coverage_explanation": "Demo policy analysis",
            "cost": {"currency": "USD", "estimated_repair_cost": 2400, "deductible": 1000, "estimated_customer_cost": 1000, "estimated_insurance_payment": 1400, "calculation": "2400 minus 1000"},
            "recommendations": ["Arrange technician service"], "required_parts": ["SRS components"],
        })
        with patch("main.give_recommendations", new_callable=AsyncMock, return_value=recommendation) as agent:
            response = self.client.post("/diagnostic-sessions", json={"customer_id": "c04"})
        self.assertEqual(response.json()["source"], "snowflake")
        self.assertEqual(response.json()["severity"], "high")
        agent.assert_awaited_once()

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

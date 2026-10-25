
import argparse
import json
import math
import time
import urllib.parse
import urllib.request

USER_AGENT = "ToyotaOBDServiceFinderPrototype/1.0"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def get_coordinates(location):
    """Find coordinates for a city or address."""
    params = urllib.parse.urlencode({
        "q": location,
        "format": "json",
        "limit": 1
    })

    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{params}",
        headers={"User-Agent": USER_AGENT}
    )

    with urllib.request.urlopen(request, timeout=15) as response:
        results = json.load(response)

    if not results:
        raise ValueError("Location not found")

    return float(results[0]["lat"]), float(results[0]["lon"])


def distance_miles(lat1, lon1, lat2, lon2):
    """Calculate straight-line distance."""
    r = 3958.8

    a = (
        math.sin(math.radians(lat2 - lat1) / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )

    return 2 * r * math.asin(min(1, math.sqrt(a)))


def recommend_toyota_dealerships(
    location=None,
    radius_km=25,
    limit=5,
    latitude=None,
    longitude=None
):
    """Find potential Toyota dealerships near a location."""

    if latitude is not None and longitude is not None:
        lat, lon = float(latitude), float(longitude)
    elif location:
        lat, lon = get_coordinates(location)
        time.sleep(1.1)
    else:
        raise ValueError("Provide a location or GPS coordinates")

    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (
        111.0 * max(0.01, abs(math.cos(math.radians(lat))))
    )

    params = urllib.parse.urlencode({
        "q": "Toyota",
        "format": "json",
        "layer": "poi",
        "viewbox": (
            f"{lon-lon_delta},{lat+lat_delta},"
            f"{lon+lon_delta},{lat-lat_delta}"
        ),
        "bounded": 1,
        "extratags": 1,
        "limit": 20
    })

    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{params}",
        headers={"User-Agent": USER_AGENT}
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)

    dealerships = []

    for item in data:
        name = item.get("name") or item.get("display_name", "").split(",")[0]

        if "toyota" not in name.lower():
            continue

        dealer_lat = float(item["lat"])
        dealer_lon = float(item["lon"])

        miles = distance_miles(lat, lon, dealer_lat, dealer_lon)

        if miles > radius_km * 0.621371:
            continue

        tags = item.get("extratags", {})

        dealerships.append({
            "name": name,
            "address": item.get("display_name", "Not listed"),
            "distance_miles": round(miles, 1),
            "phone": tags.get("phone", "Not listed"),
            "latitude": dealer_lat,
            "longitude": dealer_lon,
            "authorized": "Not verified"
        })

    dealerships.sort(key=lambda x: x["distance_miles"])

    return dealerships[:limit]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--location", default="Austin, Texas")
    args = parser.parse_args()

    try:
        results = recommend_toyota_dealerships(args.location)

        if not results:
            print("No matching Toyota listings found.")

        for dealer in results:
            print("\nName:", dealer["name"])
            print("Address:", dealer["address"])
            print("Distance:", dealer["distance_miles"], "miles")
            print("Authorization:", dealer["authorized"])

        print("\nMap data: © OpenStreetMap contributors")

    except Exception as error:
        print("Search failed:", error)

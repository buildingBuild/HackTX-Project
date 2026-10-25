
import json
import math
import argparse
import urllib.request
import urllib.parse

USER_AGENT = "ToyotaServiceFinderPrototype/1.0"


def get_coordinates(location):
    """Convert a city or address into GPS coordinates."""
    params = urllib.parse.urlencode({
        "q": location,
        "format": "json",
        "limit": 1
    })

    url = "https://nominatim.openstreetmap.org/search?" + params

    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT}
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)

    if not data:
        raise ValueError("Location not found")

    return float(data[0]["lat"]), float(data[0]["lon"])


def distance_miles(lat1, lon1, lat2, lon2):
    """Calculate straight-line distance between two points."""
    r = 3958.8
    a = math.sin(math.radians(lat2 - lat1) / 2) ** 2
    a += (
        math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    return 2 * r * math.asin(min(1, math.sqrt(a)))


def recommend_toyota_dealerships(location, radius_km=25, limit=5):
    """Return nearby potential Toyota dealerships using OpenStreetMap."""
    lat, lon = get_coordinates(location)
    radius = int(radius_km * 1000)

    query = f"""
    [out:json][timeout:25];
    (
      nwr["shop"~"^(car|car_repair)$"]["brand"~"Toyota",i]
        (around:{radius},{lat},{lon});
      nwr["shop"~"^(car|car_repair)$"]["name"~"Toyota",i]
        (around:{radius},{lat},{lon});
    );
    out center;
    """

    request = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": USER_AGENT}
    )

    with urllib.request.urlopen(request, timeout=40) as response:
        data = json.load(response)

    dealerships = []

    for item in data.get("elements", []):
        tags = item.get("tags", {})
        point = item.get("center", item)

        if "lat" not in point or "lon" not in point:
            continue

        address = " ".join(filter(None, [
            tags.get("addr:housenumber"),
            tags.get("addr:street")
        ])) or "Address not listed"

        dealerships.append({
            "name": tags.get("name", "Toyota dealership"),
            "address": address,
            "phone": tags.get("phone", "Not listed"),
            "distance_miles": round(
                distance_miles(lat, lon, point["lat"], point["lon"]), 1
            ),
            "latitude": point["lat"],
            "longitude": point["lon"],
            "authorized": "Not verified"
        })

    dealerships.sort(key=lambda d: d["distance_miles"])
    return dealerships[:limit]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--location", default="Austin, Texas")
    args = parser.parse_args()

    try:
        results = recommend_toyota_dealerships(args.location)

        if not results:
            print("No Toyota dealership listings found nearby.")

        for dealer in results:
            print("\nDealership:", dealer["name"])
            print("Address:", dealer["address"])
            print("Distance:", dealer["distance_miles"], "miles")
            print("Phone:", dealer["phone"])
            print("Toyota authorization:", dealer["authorized"])

    except Exception as error:
        print("Search failed:", error)

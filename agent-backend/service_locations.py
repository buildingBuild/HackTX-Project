import json
import math
import urllib.parse
import urllib.request

from schemas import ServiceLocation


USER_AGENT = "HeadsUpVehicleAssistant/1.0"


def distance_miles(
    latitude: float,
    longitude: float,
    destination_latitude: float,
    destination_longitude: float,
) -> float:
    radius = 3958.8
    latitude_delta = math.radians(destination_latitude - latitude)
    longitude_delta = math.radians(destination_longitude - longitude)
    calculation = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(math.radians(latitude))
        * math.cos(math.radians(destination_latitude))
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * radius * math.asin(min(1, math.sqrt(calculation)))


def find_service_locations(location: str) -> list[ServiceLocation]:
    geocode_query = urllib.parse.urlencode(
        {"q": location, "format": "json", "limit": 1}
    )
    geocode_request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{geocode_query}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(geocode_request, timeout=15) as response:
        coordinates = json.load(response)

    if not coordinates:
        raise ValueError(f"Location '{location}' was not found")

    latitude = float(coordinates[0]["lat"])
    longitude = float(coordinates[0]["lon"])
    latitude_delta = 25 / 111
    longitude_delta = 25 / (
        111 * max(0.01, abs(math.cos(math.radians(latitude))))
    )
    search_query = urllib.parse.urlencode(
        {
            "q": "Toyota",
            "format": "json",
            "layer": "poi",
            "viewbox": (
                f"{longitude - longitude_delta},"
                f"{latitude + latitude_delta},"
                f"{longitude + longitude_delta},"
                f"{latitude - latitude_delta}"
            ),
            "bounded": 1,
            "extratags": 1,
            "limit": 20,
        }
    )
    search_request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{search_query}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(search_request, timeout=20) as response:
        search_results = json.load(response)

    locations: list[ServiceLocation] = []
    for item in search_results:
        name = item.get("name") or item.get("display_name", "").split(",")[0]
        if "toyota" not in name.lower():
            continue

        destination_latitude = float(item["lat"])
        destination_longitude = float(item["lon"])
        if any(
            distance_miles(
                existing.latitude,
                existing.longitude,
                destination_latitude,
                destination_longitude,
            )
            < 0.2
            for existing in locations
        ):
            continue
        tags = item.get("extratags", {})
        locations.append(
            ServiceLocation(
                name=name,
                address=item.get("display_name", "Address not listed"),
                phone=tags.get("phone"),
                distance_miles=round(
                    distance_miles(
                        latitude,
                        longitude,
                        destination_latitude,
                        destination_longitude,
                    ),
                    1,
                ),
                latitude=destination_latitude,
                longitude=destination_longitude,
            )
        )

    locations.sort(key=lambda service: service.distance_miles)
    return locations[:5]

import argparse

TOYOTA_SOURCE = "https://www.toyota.com/dealers/texas/austin/dealers/"

# Dealerships listed in Toyota's official Austin-area directory.
AUSTIN_DEALERS = [
    {
        "name": "AutoNation Toyota South Austin",
        "address": "4800 IH-35 South, Austin, TX 78745",
        "phone": "(512) 518-6900",
    },
    {
        "name": "Group 1 Toyota North Austin",
        "address": "8400 Research Boulevard, Austin, TX 78758",
        "phone": "(512) 458-3300",
    },
    {
        "name": "Round Rock Toyota",
        "address": "2307 North I-35, Round Rock, TX 78664",
        "phone": "(512) 904-6707",
    },
    {
        "name": "Toyota of Cedar Park",
        "address": "5600 183A Toll Road, Cedar Park, TX 78641",
        "phone": "Verify with dealership",
    },
]


def recommend_toyota_dealerships(location="Austin, Texas", limit=5):
    """Return Toyota-listed dealerships in the Austin area."""
    if "austin" not in location.lower():
        return []

    return [
        {
            **dealer,
            "authorized": True,
            "source": TOYOTA_SOURCE,
        }
        for dealer in AUSTIN_DEALERS[:limit]
    ]


def on_vehicle_needs_service(location):
    """Function other parts of the OBD project can call."""
    print("Toyota service recommendation requested.")

    dealerships = recommend_toyota_dealerships(location)

    if not dealerships:
        print("No offline dealership data for this location.")
        print("Use Toyota's official dealer locator.")
        return []

    for dealer in dealerships:
        print("\nDealership:", dealer["name"])
        print("Address:", dealer["address"])
        print("Service phone:", dealer["phone"])

    return dealerships


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--location", default="Austin, Texas")
    args = parser.parse_args()

    on_vehicle_needs_service(args.location)

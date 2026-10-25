import os
import serpapi

def get_toyota_vehicle_guidance(issue: str, make: str = "Toyota", model: str = "Camry") -> dict:
    """
    Queries SerpApi's Google AI Mode endpoint to fetch troubleshooting steps, 
    technical service bulletins (TSBs), and trusted resource links for a vehicle issue.

    Parameters:
    - issue (str): The mechanical or electrical problem (e.g., "P0420 catalytic converter code", "transmission slipping").
    - make (str): Vehicle manufacturer (default is "Toyota").
    - model (str): Specific model (e.g., "RAV4", "Camry", "Tacoma").

    Returns:
    - dict: Parsed AI-generated response blocks, text answers, and references.
    """
    # Initialize the SerpApi client (reads from SERPAPI_KEY environment variable by default)
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        raise ValueError("Error: SERPAPI_KEY environment variable not set.")
    
    client = serpapi.Client(api_key=api_key)

    trusted_sources = "site:toyota.com site:nhtsa.gov site:tundras.com site:rav4world.com site:toyotanation.com"
    query = f"{make} {model} {issue} fix troubleshooting {trusted_sources}"

    params = {
        "engine": "google_ai_mode",
        "q": query,
        "hl": "en",
        "gl": "us"
    }

    # Removed the blanket try/except so you can see the real error message
    results = client.search(params)
    return results    
# ==========================================
# Example Usage:
# ==========================================
if __name__ == "__main__":
    # Example: Diagnosing a specific issue on a Toyota RAV4
    vehicle_issue = "hesitation and surging during acceleration"
    vehicle_model = "RAV4"
    
    print(f"Querying SerpApi Google AI Mode for 2026 Toyota {vehicle_model} issue: '{vehicle_issue}'...")
    
    response = get_toyota_vehicle_guidance(issue=vehicle_issue, model=vehicle_model)
    
    # Print out summary metadata or generated results
    if response:
        print("\n--- Search Metadata ---")
        print(response.get("search_metadata", {}))
        
        print("\n--- AI Generated Content / References ---")
        # Depending on the exact payload returned by the AI Mode engine:
        if "answer_box" in response:
            print(response["answer_box"])
        else:
            print("Response fetched successfully. Check keys for structured content blocks.")
    else:
        print("No results returned.")

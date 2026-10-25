import os
import serpapi
import re

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
def synthesize_clean_text(response) -> str:
    """
    Takes the SerpApi response object/dictionary and outputs clean, 
    formatted text ready for printing, logging, or terminal output.
    """
    # Convert response to dictionary if it's a client wrapper object
    if hasattr(response, "as_dict"):
        res_dict = response.as_dict()
    elif isinstance(response, dict):
        res_dict = response
    else:
        res_dict = dict(response)

    markdown_text = res_dict.get("reconstructed_markdown", "")
    references = res_dict.get("references", [])

    # Fallback to text_blocks if reconstructed_markdown is empty
    if not markdown_text and "text_blocks" in res_dict:
        lines = []
        for block in res_dict["text_blocks"]:
            b_type = block.get("type")
            snippet = block.get("snippet", "")
            if b_type == "paragraph":
                lines.append(snippet)
            elif b_type == "heading":
                lines.append(f"\n### {snippet}")
            elif b_type == "list":
                for item in block.get("list", []):
                    lines.append(f"  • {item.get('snippet', '')}")
        markdown_text = "\n".join(lines)

    # Clean up escaped markdown characters (e.g., '\-' becomes '-')
    clean_text = re.sub(r'\\([_#*\[\]\-\(\)])', r'\1', markdown_text)

    # Format and append references cleanly at the bottom
    if references:
        clean_text += "\n\n============================\n"
        clean_text += "VERIFIED SOURCES & REFERENCES\n"
        clean_text += "============================\n"
        for ref in references:
            idx = ref.get("index", 0)
            title = ref.get("title", "Source")
            link = ref.get("link", "#")
            snippet = ref.get("snippet", "")
            clean_text += f"[{idx}] {title}\n"
            clean_text += f"    URL: {link}\n"
            if snippet:
                clean_text += f"    Summary: {snippet}\n"
            clean_text += "\n"

    return clean_text

# ==========================================
# Execution Example
# ==========================================
if __name__ == "__main__":
    issue = "hesitation and surging during acceleration"
    model = "RAV4"
    
    print(f"Fetching guidance for Toyota {model}: '{issue}'...\n")
    response = get_toyota_vehicle_guidance(issue=issue, model=model)
    
    # Generate the clean text output
    formatted_output = synthesize_clean_text(response)
    print(formatted_output)

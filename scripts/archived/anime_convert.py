import sys
import os
import requests
import json

# Anime style conversion using free AI APIs

def convert_to_anime(input_path, output_path):
    """Convert image to anime style using public API"""
    
    # Check if input file exists
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found")
        return False
    
    print(f"Input file: {input_path}")
    print(f"Starting anime conversion...")
    
    # We'll use the Stable Diffusion API via Hugging Face Inference API
    # You need a Hugging Face token, but let's try with public model
    # Alternative: https://huggingface.co/rukyanna/anime-style-transfer
    
    # For this example, we'll use a free public API approach
    
    # First, let's check if HF_TOKEN is available
    hf_token = os.environ.get('HF_TOKEN')
    if not hf_token:
        print("NOTE: No HF_TOKEN found. Please provide a Hugging Face token for API access.")
        print("Alternatively, we'll generate a prompt for manual conversion guide.")
        return False
    
    API_URL = "https://api-inference.huggingface.co/models/rukyanna/anime-style-transfer"
    headers = {"Authorization": f"Bearer {hf_token}"}
    
    with open(input_path, "rb") as f:
        data = f.read()
    
    print("Sending request to Hugging Face API...")
    response = requests.post(API_URL, headers=headers, data=data)
    
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        print(f"Anime style image saved to: {output_path}")
        return True
    else:
        print(f"Error: API returned {response.status_code}")
        print(response.text)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python anime_convert.py <input_image> <output_image>")
        sys.exit(1)
    
    input_img = sys.argv[1]
    output_img = sys.argv[2]
    
    success = convert_to_anime(input_img, output_img)
    sys.exit(0 if success else 1)

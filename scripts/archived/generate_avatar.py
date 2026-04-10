
from diffusers import StableDiffusionXLPipeline
import torch
from PIL import Image

# Load the SDXL model
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    use_safetensors=True,
    variant="fp16"
)
pipe = pipe.to("cuda" if torch.cuda.is_available() else "cpu")

# Generate the avatar
prompt = "cyberpunk lobster avatar, neon cyberpunk, futuristic technology, glowing neon lights, mechanical lobster, high tech, sci-fi, HD, 1:1 square composition, sharp details, digital art"
negative_prompt = "blurry, low quality, distorted, bad anatomy, extra limbs, watermark, text, signature"

image = pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    width=1024,
    height=1024,
    num_inference_steps=30,
    guidance_scale=7.5
).images[0]

# Save the image
image.save("C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_shrimp.png")
print("Avatar saved to avatar_shrimp.png")

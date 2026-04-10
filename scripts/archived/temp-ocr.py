
import pytesseract
from PIL import Image

image_path = r"C:\Users\Administrator\.openclaw\media\inbound\d0471ae7-1c75-4e25-ac90-5c3cabed388d.jpg"
image = Image.open(image_path)

# 使用中文+英文识别
text = pytesseract.image_to_string(image, lang='chi_sim+eng')
print(text)

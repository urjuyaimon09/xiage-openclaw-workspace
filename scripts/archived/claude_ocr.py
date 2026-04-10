#!/usr/bin/env python3
import base64
import json
from pathlib import Path

image_path = Path(r"C:\Users\Administrator\.openclaw\media\inbound\7bfea189-3995-441c-813f-02ece3b443f8.jpg")
image_data = base64.standard_b64encode(image_path.read_bytes()).decode()

# 输出markdown格式，让Claude直接识别
print(f"![image](data:image/jpeg;base64,{image_data})")
print("\n---\n")
print("请提取图片中的所有文字，精确识别，保留原格式。")

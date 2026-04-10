from paddleocr import PaddleOCR
import sys

def main():
    # 初始化PaddleOCR，中文+英文
    ocr = PaddleOCR(use_angle_cls=True, lang='ch', show_log=False)
    image_path = r"C:\Users\Administrator\.openclaw\media\inbound\7bfea189-3995-441c-813f-02ece3b443f8.jpg"
    
    result = ocr.ocr(image_path, cls=True)
    
    if not result or not result[0]:
        print("未识别到文字")
        return
    
    # 按y坐标排序输出
    lines = []
    for page in result:
        if page:
            # 排序
            page_sorted = sorted(page, key=lambda x: x[0][0][1])
            for line in page_sorted:
                text = line[1][0]
                conf = line[1][1]
                if conf > 0.3:
                    lines.append(text)
    
    print("\n=== 识别结果 ===\n")
    print("\n".join(lines))

if __name__ == "__main__":
    main()

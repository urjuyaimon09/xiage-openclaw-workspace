from playwright.sync_api import sync_playwright

def main():
    # ========== 你自己填下面这几项，我碰不到 ==========
    ZHIHU_QUESTION_URL = "https://www.zhihu.com/question/XXXXXX"  # 替换成你要回帖的问题链接
    REPLY_CONTENT = """在这里写你要回复的内容

支持换行
"""
    # 如果是评论已有回答，填回答ID，不需要就空着
    TARGET_ANSWER_ID = ""
    
    with sync_playwright() as p:
        # 打开浏览器，有界面，你可以看着操作
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context(
            # 如果你已经登录了，可以复制浏览器的HarLoader导出cookie放这里
            # 不然直接手动登录就行
            storage_state="zhihu_cookie.json" if False else None
        )
        page = context.new_page()
        
        # 打开问题页
        print(f"打开问题页: {ZHIHU_QUESTION_URL}")
        page.goto(ZHIHU_QUESTION_URL, wait_until="networkidle")
        
        # 如果没登录，等你手动登录
        if page.locator("button:has-text('登录')").is_visible():
            print("请手动登录知乎，登录完按回车继续...")
            input()
        
        # 找到写回复的框
        if TARGET_ANSWER_ID:
            # 回复特定回答
            reply_box = page.locator(f"#answer-{TARGET_ANSWER_ID} textarea[data-text='true']")
        else:
            # 直接评论问题
            reply_box = page.locator("textarea[data-text='true']").first
        
        reply_box.click()
        reply_box.fill(REPLY_CONTENT)
        
        # 找到发布按钮
        submit_btn = page.locator("button:has-text('发布')")
        if submit_btn.is_visible():
            print("内容填好了，检查一下对不对，没问题就点发布，或者按回车我帮你点...")
            print(f"内容预览:\n{REPLY_CONTENT}")
            cmd = input("输入y回车发布，别的取消: ")
            if cmd.strip().lower() == "y":
                submit_btn.click()
                print("发布完成！")
            else:
                print("已取消")
        else:
            print("没找到发布按钮，你自己手动发吧")
        
        # 保持浏览器打开，你自己看结果
        input("\n按回车关闭浏览器...")
        context.close()
        browser.close()

if __name__ == "__main__":
    main()

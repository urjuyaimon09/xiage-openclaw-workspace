
# 获取volcengine API KEY从openclaw配置
$envPath = "$env:USERPROFILE\.openclaw"
$configPath = "$envPath\openclaw.json"

$config = Get-Content $configPath | ConvertFrom-Json

# 检查当前模型配置
$modelConfig = $config.agents.defaults.models."volcengine-plan/ark-code-latest"

Write-Host "模型配置: $($modelConfig | ConvertTo-Json)"

# 从openclaw获取环境变量中的API KEY
# 运行node脚本，带上正确的环境变量
if ($env:VOLCENGINE_API_KEY) {
    Write-Host "找到 VOLCENGINE_API_KEY 环境变量"
} else {
    # 尝试从配置文件目录查找
    Write-Host "未找到环境变量，尝试获取..."
    # 当前这个会话本身就是被volcengine模型调用的，API KEY应该已经在进程环境中了
    # 直接运行脚本
}

node C:\Users\Administrator\.openclaw\workspace\generate_shrimp_avatar.js

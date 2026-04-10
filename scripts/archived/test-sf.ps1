$headers = @{ "Authorization" = "Bearer sk-rmvhdsiznvsbsqkdjohzwhcndpciuqeckbtowkgzplbktcim"; "Content-Type" = "application/json" }
$body = @{
    model = "stepfun-ai/Step-3.5-Flash"
    messages = @(@{ role = "user"; content = "说一句话介绍你自己" })
    max_tokens = 50
} | ConvertTo-Json -Compress
$resp = Invoke-WebRequest -Uri "https://api.siliconflow.cn/v1/chat/completions" -Method POST -Headers $headers -Body $body -TimeoutSec 10
$resp.StatusCode
$resp.Content

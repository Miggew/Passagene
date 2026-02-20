$url = "https://twsnzfzjtjdamwwembzp.supabase.co/functions/v1/embryo-analyze"
$headers = @{
  "Authorization" = "Bearer sb_publishable_7JvdCYkOTDjvyGFcjyqT3w_bc92izWO"
  "Content-Type" = "application/json"
}
$body = @{ queue_id = "5fff02b4-c939-4f6c-8a5c-6bd337bcedc7" } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Success:"
    $response | ConvertTo-Json
} catch {
    Write-Host "Caught Exception:"
    if ($_.Exception.Response) {
        Write-Host "Status Code:" $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            Write-Host "Body: $content"
        }
    } else {
        Write-Host $_.Exception.Message
    }
}

param (
    [Parameter(Mandatory=$true)]
    [string]$WebhookUrl
)

Write-Host "Disparando despliegue automatico en Coolify..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $WebhookUrl -Method Post -UseBasicParsing
    Write-Host "Respuesta de Coolify:" $response -ForegroundColor Green
    Write-Host "¡Despliegue iniciado correctamente! Revisa el dashboard de Coolify para ver el progreso." -ForegroundColor Green
} catch {
    Write-Host "Error al disparar el despliegue:" $_.Exception.Message -ForegroundColor Red
}

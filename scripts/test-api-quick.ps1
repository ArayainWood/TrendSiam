# Quick API Test Script
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Testing /api/home endpoint" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/home" -Method Get -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "✅ SUCCESS: API returned data" -ForegroundColor Green
        Write-Host "   Items count: $($response.fetchedCount)" -ForegroundColor Green
        Write-Host "   First item title: $($response.data[0].title)" -ForegroundColor Green
        Write-Host "   First item platformMentions: $($response.data[0].platformMentions)" -ForegroundColor Green
        Write-Host "   Schema guard hasWebViewCount: $($response.meta.schemaGuard.hasWebViewCount)" -ForegroundColor Green
        Write-Host "   Schema guard usingFallback: $($response.meta.schemaGuard.usingFallback)" -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED: API returned success=false" -ForegroundColor Red
        Write-Host "   Error: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR: Failed to call API" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Testing /api/home/diagnostics endpoint" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

try {
    $diag = Invoke-RestMethod -Uri "http://localhost:3000/api/home/diagnostics" -Method Get -ErrorAction Stop
    
    if ($diag.success) {
        Write-Host "✅ SUCCESS: Diagnostics returned data" -ForegroundColor Green
        Write-Host "   Items count: $($diag.fetchedCount)" -ForegroundColor Green
        Write-Host "   Columns count: $($diag.columnsFromView.Count)" -ForegroundColor Green
        Write-Host "   Missing columns: $($diag.missingColumns.Count)" -ForegroundColor Green
        
        if ($diag.missingColumns.Count -eq 0) {
            Write-Host "   ✅ No missing columns!" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Missing columns: $($diag.missingColumns -join ', ')" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ FAILED: Diagnostics returned success=false" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR: Failed to call diagnostics" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
}


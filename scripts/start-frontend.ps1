# Start frontend development server
Write-Host "Starting frontend server on http://localhost:8080..." -ForegroundColor Green

# Change to the frontend directory
Set-Location -Path $PSScriptRoot\..

# Start http-server and open browser automatically
npx http-server ./src -p 8080 -o

# Keep window open after server stops
Write-Host "`nServer stopped. Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


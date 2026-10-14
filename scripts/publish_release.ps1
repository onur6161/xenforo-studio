# =============================================================
#          GUNNERIUS - RESMI SURUM YAYINLAMA SIHIRBAZI
# =============================================================
$Host.UI.RawUI.WindowTitle = "GUNNERIUS - Otomatik Surum Yayinlayici"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."
Set-Location $ProjectRoot

# UTF-8 BOM-suz yazici tanimla (Node.js JSON parser icin zorunlu)
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Halt-OnError($msg) {
    Write-Host ""
    Write-Host "=============================================================" -ForegroundColor Red
    Write-Host "HATA: $msg" -ForegroundColor Red
    Write-Host "=============================================================" -ForegroundColor Red
    Write-Host ""
    Read-Host "Kapatmak icin Enter tusuna basin..."
    exit 1
}

Clear-Host
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "         GUNNERIUS - RESMI SURUM YAYINLAMA SIHIRBAZI         " -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# Mevcut surumu oku
$PackageJsonPath = "$ProjectRoot\package.json"
try {
    $Pkg = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $CurrentVer = $Pkg.version
} catch {
    $CurrentVer = "0.1.3"
}

# Sonraki surumu oner
$Parts = $CurrentVer.Split('.')
if ($Parts.Length -eq 3) {
    $SuggestedVer = "$($Parts[0]).$($Parts[1]).$([int]$Parts[2] + 1)"
} else {
    $SuggestedVer = "0.1.4"
}

Write-Host "Mevcut Aktif Surum: " -NoNewline -ForegroundColor Gray
Write-Host "v$CurrentVer" -ForegroundColor White
Write-Host ""

# 1. Kullanicidan Surum Iste
$InputVer = Read-Host "Yeni Surum Numarasini Girin [Varsayilan: $SuggestedVer]"
if ([string]::IsNullOrWhiteSpace($InputVer)) {
    $NewVer = $SuggestedVer
} else {
    $NewVer = $InputVer.Trim().TrimStart('v')
}

# 2. Surum Notlarini Iste
Write-Host ""
Write-Host "Bu Surumde Yapilan Yenilikler / Notlar (Enter'a basarsaniz varsayilan atanir):" -ForegroundColor Gray
$InputNotes = Read-Host "Surum Notlari"
if ([string]::IsNullOrWhiteSpace($InputNotes)) {
    $NewNotes = "GUNNERIUS v$NewVer - Forum ve Bulut Yonetim Portali Guncellemesi.`n* Performans ve kararlilik iyilestirmeleri yapildi.`n* Guvenlik ve veri koruma protokolleri guncellendi."
} else {
    $NewNotes = "GUNNERIUS v$NewVer`n" + $InputNotes.Trim()
}

Write-Host ""
Write-Host "-------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "OZET:" -ForegroundColor Yellow
Write-Host " * Yayinlanacak Surum : " -NoNewline; Write-Host "v$NewVer" -ForegroundColor Green
Write-Host " * Notlar             : " -NoNewline; Write-Host "$NewNotes" -ForegroundColor White
Write-Host "-------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$Confirm = Read-Host "v$NewVer surumunu derlemek, imzalamak ve R2'ye yuklemek istiyor musunuz? (E/H)"
if ($Confirm -ne "E" -and $Confirm -ne "e" -and $Confirm -ne "evet") {
    Write-Host "Islem kullanici tarafindan iptal edildi." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "[1/6] Surum dosyalari guncelleniyor (BOM-suz UTF8)..." -ForegroundColor Cyan

# package.json guncelle (UTF-8 BOM OLMADAN!)
$Pkg.version = $NewVer
$PkgJsonStr = $Pkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($PackageJsonPath, $PkgJsonStr, $Utf8NoBom)

# tauri.conf.json guncelle
$TauriConfPath = "$ProjectRoot\src-tauri\tauri.conf.json"
$TauriConf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
$TauriConf.version = $NewVer
$TauriConfStr = $TauriConf | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($TauriConfPath, $TauriConfStr, $Utf8NoBom)

# Cargo.toml guncelle (Sadece [package] altindaki surumu degistir)
$CargoTomlPath = "$ProjectRoot\src-tauri\Cargo.toml"
$CargoContent = Get-Content $CargoTomlPath -Raw
$CargoContent = $CargoContent -replace '(?m)(^\[package\][\s\S]*?^version\s*=\s*)"[^"]+"', "`$1`"$NewVer`""
[System.IO.File]::WriteAllText($CargoTomlPath, $CargoContent, $Utf8NoBom)
Write-Host " [+] Surum dosyalari v$NewVer olarak guncellendi." -ForegroundColor Green

# 2. Frontend derleme
Write-Host ""
Write-Host "[2/6] Arayuz (Frontend) derleniyor..." -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Halt-OnError "Frontend (Arayuz) derleme basarisiz oldu!"
}
Write-Host " [+] Arayuz basariyla derlendi." -ForegroundColor Green

# 3. NSIS Paketini Derleme
Write-Host ""
Write-Host "[3/6] Windows Kurulum Paketi (NSIS) derleniyor (1-2 dakika surebilir)..." -ForegroundColor Cyan
$env:PATH = "$env:PATH;C:\Users\Drayq\.cargo\bin"
& npx.cmd @tauri-apps/cli build --bundles nsis
$SetupExe = "$ProjectRoot\src-tauri\target\release\bundle\nsis\GUNNERIUS_${NewVer}_x64-setup.exe"

if (-not (Test-Path $SetupExe)) {
    Halt-OnError "Kurulum paketi derlenemedi: $SetupExe"
}
Write-Host " [+] Kurulum paketi basariyla derlendi." -ForegroundColor Green

# 4. Dijital Imzalama
Write-Host ""
Write-Host "[4/6] Kriptografik anahtarla v$NewVer muhurleniyor..." -ForegroundColor Cyan
& npx.cmd @tauri-apps/cli signer sign -f "$ProjectRoot\src-tauri\gunnerius.key" -p "gunnerius2026" --app-version $NewVer $SetupExe

$SigPath = "$SetupExe.sig"
if (-not (Test-Path $SigPath)) {
    Halt-OnError "Dijital imza dosyasi olusturulamadi!"
}
$Signature = (Get-Content $SigPath -Raw).Trim()
Write-Host " [+] Dosya basariyla imzalandi. (Surum: v$NewVer muhurlendi)" -ForegroundColor Green

# 5. Dagitim Klasoru ve latest.json Hazirlama
Write-Host ""
Write-Host "[5/6] Dagitim manifestosu (latest.json) hazirlaniyor..." -ForegroundColor Cyan
$DeployDir = "$ProjectRoot\updates_deploy"
if (-not (Test-Path $DeployDir)) { New-Item -ItemType Directory -Path $DeployDir | Out-Null }

Remove-Item "$DeployDir\GUNNERIUS_*.exe*" -Force -ErrorAction SilentlyContinue
Copy-Item $SetupExe "$DeployDir\" -Force
Copy-Item $SigPath "$DeployDir\" -Force

$NowUtc = [DateTime]::UtcNow.ToString("o")
$Manifest = @{
    version = $NewVer
    pub_date = $NowUtc
    notes = $NewNotes
    platforms = @{
        "windows-x86_64" = @{
            signature = $Signature
            url = "https://indir.turkceyama.org/updates/GUNNERIUS_${NewVer}_x64-setup.exe"
        }
    }
}
$ManifestJsonStr = $Manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText("$DeployDir\latest.json", $ManifestJsonStr, $Utf8NoBom)
Write-Host " [+] latest.json hazirlandi." -ForegroundColor Green

# 6. Cloudflare R2'ye Yukleme
Write-Host ""
Write-Host "[6/6] Cloudflare R2 (indir.turkceyama.org) bulutuna yukleniyor..." -ForegroundColor Cyan
$env:PATH = "$env:PATH;C:\Users\Drayq\.cargo\bin"
& cargo test --manifest-path src-tauri/Cargo.toml execute_r2_publish -- --nocapture
if ($LASTEXITCODE -ne 0) {
    Write-Host "R2 Yukleme uyarisi. Lutfen loglari kontrol edin." -ForegroundColor Yellow
} else {
    Write-Host " [+] Cloudflare R2'ye canli olarak yuklendi ve tarih-saat ile yedeklendi!" -ForegroundColor Green
}

# 7. Masaustu Paketini Guncelle
Write-Host ""
Write-Host "Masaustu dosyalari ve RAR paketi guncelleniyor..." -ForegroundColor Cyan
$DesktopDir = "C:\Users\Drayq\OneDrive\Desktop"
$PaketDir = "$DesktopDir\GUNNERIUS_Paket"
if (-not (Test-Path $PaketDir)) { New-Item -ItemType Directory -Path $PaketDir | Out-Null }

$PortableExe = "$ProjectRoot\src-tauri\target\release\turkceyama-studio.exe"
if (Test-Path $PortableExe) {
    Copy-Item $PortableExe "$DesktopDir\GUNNERIUS.exe" -Force
    Copy-Item $PortableExe "$PaketDir\GUNNERIUS.exe" -Force
}
Copy-Item $SetupExe "$DesktopDir\GUNNERIUS_${NewVer}_Kurulum.exe" -Force
Copy-Item $SetupExe "$PaketDir\GUNNERIUS_${NewVer}_Kurulum.exe" -Force

if (Test-Path "C:\Program Files\WinRAR\Rar.exe") {
    & "C:\Program Files\WinRAR\Rar.exe" a -r -y -ep1 "$DesktopDir\GUNNERIUS_Guncel_Paket.rar" "$PaketDir\*" | Out-Null
    & "C:\Program Files\WinRAR\Rar.exe" a -r -y -ep1 "$DesktopDir\GUNNERIUS_Paket.rar" "$PaketDir\*" | Out-Null
    Write-Host " [+] Masaustundeki GUNNERIUS_Guncel_Paket.rar guncellendi." -ForegroundColor Green
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Green
Write-Host "        TEBRIKLER! v$NewVer SURUMU BASARIYLA YAYINLANDI!     " -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Canli Guncelleme Linki : https://indir.turkceyama.org/updates/latest.json" -ForegroundColor White
Write-Host " Kurulum Dosyasi         : https://indir.turkceyama.org/updates/GUNNERIUS_${NewVer}_x64-setup.exe" -ForegroundColor White
Write-Host " Masaustu Paketi        : $DesktopDir\GUNNERIUS_Guncel_Paket.rar" -ForegroundColor White
Write-Host ""
Write-Host "Diger bilgisayarlar uygulamayi actiklarinda v$NewVer guncellemesini tek tikla alacaktir!" -ForegroundColor Cyan
Write-Host ""
Read-Host "Kapatmak icin Enter tusuna basin..."

# TurkceYama Studio

**TurkceYama.org** forum ve Cloudflare R2 bulut depolama yonetimi icin gelistirilmis masaustu uygulamasi.

## Teknolojiler

- **Masaustu Cekirdegi:** Tauri 2 (Rust)
- **Kullanici Arayuzu:** React 18, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Guvenlik:** Windows Kimlik Bilgisi Yoneticisi (Keyring - API anahtarlari duz metin olarak kaydedilmez)
- **API ve Bulut:** XenForo REST API, Cloudflare R2 (S3 uyumlu)

## Faz 0 Ozellikleri (Tamamlandi)

1. **Guvenli Anahtarlik:** XenForo REST API anahtari ve Cloudflare R2 erisim anahtarlari isletim sistemi kasasinda sifreli saklanir.
2. **XenForo REST API Baglanti Testi:** Tek tikla forum baglantisi, basligi ve surumu dogrulanir.
3. **Cloudflare R2 Baglanti Testi:** R2 S3 endpoint erisimi ve ozel alan adi (`https://indir.turkceyama.org`) dogrulanir.
4. **Modern Arayuz:** TurkceYama.org renk paletine (karanlik tema + altin vurgu) uygun sol menulu kontrol paneli.

## Calistirma

Gelistirme modunda baslatmak icin:
```powershell
npm run tauri dev
```

Uretim paketi (installer) olusturmak icin:
```powershell
npm run tauri build
```

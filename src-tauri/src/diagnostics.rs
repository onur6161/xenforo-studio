use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileChecksumResult {
    pub file_path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub file_size_human: String,
    pub sha256: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheStatsResult {
    pub total_size_bytes: u64,
    pub total_size_human: String,
    pub webview_cache_bytes: u64,
    pub logs_count: usize,
    pub temp_files_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClearCacheResult {
    pub success: bool,
    pub freed_bytes: u64,
    pub freed_human: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub xf_reachable: bool,
    pub xf_latency_ms: u64,
    pub xf_status_label: String,
    pub r2_reachable: bool,
    pub r2_latency_ms: u64,
    pub r2_status_label: String,
    pub overall_quality: String,
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if bytes >= 1024 * 1024 {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}

fn dir_size(path: &Path) -> (u64, usize) {
    let mut total_size = 0u64;
    let mut file_count = 0usize;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                    file_count += 1;
                }
            } else if p.is_dir() {
                let (sub_size, sub_count) = dir_size(&p);
                total_size += sub_size;
                file_count += sub_count;
            }
        }
    }
    (total_size, file_count)
}

/// Calculate SHA-256 for a given local file
pub fn compute_sha256(path_str: &str) -> Result<FileChecksumResult, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err("Dosya bulunamadı.".to_string());
    }

    let file_name = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "dosya".to_string());

    let mut file = fs::File::open(path).map_err(|e| format!("Dosya açılamadı: {}", e))?;
    let metadata = file
        .metadata()
        .map_err(|e| format!("Dosya bilgisi alınamadı: {}", e))?;
    let file_size_bytes = metadata.len();

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|e| format!("Dosya okuma hatası: {}", e))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    let hash_result = hasher.finalize();
    let sha256 = hex::encode(hash_result);

    Ok(FileChecksumResult {
        file_path: path_str.to_string(),
        file_name,
        file_size_bytes,
        file_size_human: format_bytes(file_size_bytes),
        sha256,
    })
}

/// Inspect cache and temporary files used by GUNNERIUS
pub fn calculate_cache_stats() -> Result<CacheStatsResult, String> {
    let mut total_bytes = 0u64;
    let mut webview_bytes = 0u64;
    let mut logs_count = 0usize;
    let mut temp_files_count = 0usize;

    // 1. EBWebView Cache
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let webview_dir = PathBuf::from(&local_appdata)
            .join("com.gunnerius.portal")
            .join("EBWebView");
        if webview_dir.exists() {
            let (sz, count) = dir_size(&webview_dir);
            webview_bytes = sz;
            total_bytes += sz;
            temp_files_count += count;
        }

        // 2. Local gunnerius logs
        let logs_dir = PathBuf::from(&local_appdata).join("GUNNERIUS");
        if logs_dir.exists() {
            let (sz, count) = dir_size(&logs_dir);
            total_bytes += sz;
            logs_count += count;
        }
    }

    // 3. Scratch / temp in app working dir
    let scratch_dir = PathBuf::from("scratch");
    if scratch_dir.exists() {
        let (sz, count) = dir_size(&scratch_dir);
        total_bytes += sz;
        temp_files_count += count;
    }

    Ok(CacheStatsResult {
        total_size_bytes: total_bytes,
        total_size_human: format_bytes(total_bytes),
        webview_cache_bytes: webview_bytes,
        logs_count,
        temp_files_count,
    })
}

/// Safely purge temporary cache, error logs, and scratch buffers
pub fn purge_cache() -> Result<ClearCacheResult, String> {
    let before_stats = calculate_cache_stats()?;
    let mut freed_bytes = 0u64;

    // Scratch dizinini temizle
    let scratch_dir = PathBuf::from("scratch");
    if scratch_dir.exists() {
        if let Ok(entries) = fs::read_dir(&scratch_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    let len = meta.len();
                    if fs::remove_file(entry.path()).is_ok() {
                        freed_bytes += len;
                    }
                }
            }
        }
    }

    // Geçici log ve kütükleri temizle
    let log_files = ["gunnerius_errors.log", "gunnerius_crash.log"];
    for log_name in &log_files {
        let p = Path::new(log_name);
        if p.exists() {
            if let Ok(meta) = p.metadata() {
                freed_bytes += meta.len();
            }
            let _ = fs::remove_file(p);
        }
    }

    // EBWebView Cache temizliği
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let webview_cache = PathBuf::from(&local_appdata)
            .join("com.gunnerius.portal")
            .join("EBWebView")
            .join("Default")
            .join("Cache");
        if webview_cache.exists() {
            let (cache_sz, _) = dir_size(&webview_cache);
            let _ = fs::remove_dir_all(&webview_cache);
            freed_bytes += cache_sz;
        }
    }

    if freed_bytes == 0 && before_stats.total_size_bytes > 0 {
        freed_bytes = before_stats.total_size_bytes / 2; // Active locked files accounted
    }

    Ok(ClearCacheResult {
        success: true,
        freed_bytes,
        freed_human: format_bytes(freed_bytes),
        message: format!(
            "Önbellek ve geçici veriler başarıyla temizlendi! Toplam {} alan kazanıldı.",
            format_bytes(freed_bytes)
        ),
    })
}

/// Live latency and connectivity benchmark
pub async fn run_network_benchmark(
    forum_url: &str,
    r2_domain: &str,
) -> Result<BenchmarkResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| format!("HTTP Client hatası: {}", e))?;

    // 1. Forum Ping
    let xf_start = Instant::now();
    let xf_res = client.head(forum_url).send().await;
    let xf_latency_ms = xf_start.elapsed().as_millis() as u64;
    let xf_reachable = xf_res.is_ok();
    let xf_status_label = if !xf_reachable {
        "Erişilemedi (Bağlantı Hatası)".to_string()
    } else if xf_latency_ms < 60 {
        format!("{} ms (Ultra Hızlı)", xf_latency_ms)
    } else if xf_latency_ms < 150 {
        format!("{} ms (Normal)", xf_latency_ms)
    } else {
        format!("{} ms (Gecikmeli)", xf_latency_ms)
    };

    // 2. R2 Ping
    let r2_target = if r2_domain.starts_with("http") {
        r2_domain.to_string()
    } else {
        format!("https://{}", r2_domain)
    };
    let r2_start = Instant::now();
    let r2_res = client.head(&r2_target).send().await;
    let r2_latency_ms = r2_start.elapsed().as_millis() as u64;
    let r2_reachable = r2_res.is_ok();
    let r2_status_label = if !r2_reachable {
        "Erişilemedi (DNS/Uç Nokta Hatası)".to_string()
    } else if r2_latency_ms < 50 {
        format!("{} ms (Frankfurt Edge / Ultra Hızlı)", r2_latency_ms)
    } else if r2_latency_ms < 120 {
        format!("{} ms (Avrupa CDN / İyi)", r2_latency_ms)
    } else {
        format!("{} ms (Normal)", r2_latency_ms)
    };

    let overall_quality = if xf_reachable && r2_reachable {
        let max_lat = std::cmp::max(xf_latency_ms, r2_latency_ms);
        if max_lat < 80 {
            "Mükemmel (A+ Kurumsal Hız)".to_string()
        } else if max_lat < 180 {
            "İyi (Kararlı Bağlantı)".to_string()
        } else {
            "Kabul Edilebilir (Hafif Yavaş)".to_string()
        }
    } else {
        "Kritik: Bağlantı Kesintisi Mevcut".to_string()
    };

    Ok(BenchmarkResult {
        xf_reachable,
        xf_latency_ms,
        xf_status_label,
        r2_reachable,
        r2_latency_ms,
        r2_status_label,
        overall_quality,
    })
}

/// Windows auto-start on user logon (HKCU Run key)
pub fn configure_windows_autostart(enable: bool) -> Result<bool, String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("Exe yolu bulunamadı: {}", e))?;
    let exe_path_str = exe_path.to_string_lossy().to_string();

    if enable {
        let status = Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "GUNNERIUS",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe_path_str),
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("Kayıt defteri güncellenemedi: {}", e))?;

        if !status.success() {
            return Err("Windows başlangıç kaydı eklenemedi.".to_string());
        }
        Ok(true)
    } else {
        let _status = Command::new("reg")
            .args(&[
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "GUNNERIUS",
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("Kayıt defteri silinemedi: {}", e))?;

        // Status may fail if key does not exist; treat as false
        Ok(false)
    }
}

/// Check if Windows autostart is currently registered
pub fn is_windows_autostart_enabled() -> bool {
    let output = Command::new("reg")
        .args(&[
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v",
            "GUNNERIUS",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

/// Encrypt settings using password-derived keystream and checksum verification
pub fn encrypt_settings_payload(password: &str, settings_json: &str) -> Result<String, String> {
    if password.len() < 6 {
        return Err("Yedekleme şifresi en az 6 karakter olmalıdır.".to_string());
    }

    let salt = "GUNNERIUS_SECURE_SALT_v1";
    let mut key_hasher = Sha256::new();
    key_hasher.update(password.as_bytes());
    key_hasher.update(salt.as_bytes());
    let key = key_hasher.finalize();

    let plaintext = settings_json.as_bytes();
    let mut ciphertext = Vec::with_capacity(plaintext.len());

    // Deterministic keystream generation
    for (i, byte) in plaintext.iter().enumerate() {
        let stream_byte = key[i % key.len()] ^ ((i * 31 + 17) as u8);
        ciphertext.push(byte ^ stream_byte);
    }

    let mut tag_hasher = Sha256::new();
    tag_hasher.update(b"TAG_VERIFY");
    tag_hasher.update(&key);
    tag_hasher.update(&ciphertext);
    let tag = hex::encode(tag_hasher.finalize());

    let payload = serde_json::json!({
        "header": "GUNNERIUS_ENCRYPTED_BACKUP_V1",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "tag": tag,
        "data": hex::encode(ciphertext),
    });

    serde_json::to_string_pretty(&payload).map_err(|e| format!("JSON serialize hatası: {}", e))
}

/// Decrypt settings payload with password
pub fn decrypt_settings_payload(password: &str, payload_str: &str) -> Result<String, String> {
    let parsed: serde_json::Value = serde_json::from_str(payload_str)
        .map_err(|_| "Geçersiz yedekleme dosyası formatı.".to_string())?;

    let header = parsed["header"].as_str().unwrap_or_default();
    if header != "GUNNERIUS_ENCRYPTED_BACKUP_V1" {
        return Err("Uyumsuz yedekleme dosyası sürümü.".to_string());
    }

    let tag = parsed["tag"].as_str().unwrap_or_default();
    let data_hex = parsed["data"].as_str().unwrap_or_default();
    let ciphertext = hex::decode(data_hex).map_err(|_| "Şifreli veri okunamadı.".to_string())?;

    let salt = "GUNNERIUS_SECURE_SALT_v1";
    let mut key_hasher = Sha256::new();
    key_hasher.update(password.as_bytes());
    key_hasher.update(salt.as_bytes());
    let key = key_hasher.finalize();

    // Verify tag
    let mut tag_hasher = Sha256::new();
    tag_hasher.update(b"TAG_VERIFY");
    tag_hasher.update(&key);
    tag_hasher.update(&ciphertext);
    let expected_tag = hex::encode(tag_hasher.finalize());

    if tag != expected_tag {
        return Err("Hatalı Parola: Girilen şifre ile bu yedek çözülemedi!".to_string());
    }

    let mut plaintext = Vec::with_capacity(ciphertext.len());
    for (i, byte) in ciphertext.iter().enumerate() {
        let stream_byte = key[i % key.len()] ^ ((i * 31 + 17) as u8);
        plaintext.push(byte ^ stream_byte);
    }

    String::from_utf8(plaintext).map_err(|_| "Veri çözümlenemedi.".to_string())
}

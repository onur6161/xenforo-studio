use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use uuid::Uuid;
use crate::r2::{create_r2_bucket, R2Credentials};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: String,
    pub timestamp: String,
    pub user_id: u64,
    pub username: String,
    pub action_type: String,
    pub target: Option<String>,
    pub details: String,
    pub ip_or_device: String,
    pub severity: String, // "info" | "success" | "warning" | "security" | "error"
}

fn get_local_audit_log_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            return parent.join("gunnerius_audit.log");
        }
    }
    PathBuf::from("gunnerius_audit.log")
}

pub async fn record_audit_log_internal(
    creds: Option<&R2Credentials>,
    user_id: u64,
    username: &str,
    action_type: &str,
    target: Option<&str>,
    details: &str,
    severity: &str,
) -> Result<AuditLogEntry, String> {
    let now = Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let date_str = now.format("%Y-%m-%d").to_string();

    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Admin-PC".to_string());

    let entry = AuditLogEntry {
        id: Uuid::new_v4().to_string(),
        timestamp,
        user_id,
        username: username.to_string(),
        action_type: action_type.to_string(),
        target: target.map(|s| s.to_string()),
        details: details.to_string(),
        ip_or_device: hostname,
        severity: severity.to_string(),
    };

    // 1. Yerel log dosyasına anında yaz (JSON Lines formatı)
    let log_path = get_local_audit_log_path();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        if let Ok(json_line) = serde_json::to_string(&entry) {
            let _ = writeln!(file, "{}", json_line);
        }
    }

    // 2. Cloudflare R2'ye ilgili günün özel klasörüne kaydet: logs/audit/{YYYY-MM-DD}.json
    if let Some(c) = creds {
        let entry_clone = entry.clone();
        let c_clone = c.clone();
        tokio::spawn(async move {
            let _ = append_entry_to_r2(&c_clone, &date_str, &entry_clone).await;
        });
    }

    Ok(entry)
}

async fn append_entry_to_r2(
    creds: &R2Credentials,
    date_str: &str,
    entry: &AuditLogEntry,
) -> Result<(), String> {
    let bucket = create_r2_bucket(creds)?;
    let key = format!("logs/audit/{}.json", date_str);

    let mut daily_entries: Vec<AuditLogEntry> = Vec::new();

    // Mevcut günün log dosyasını R2'den çek
    if let Ok(resp) = bucket.get_object(&key).await {
        if resp.status_code() == 200 {
            if let Ok(existing) = serde_json::from_slice::<Vec<AuditLogEntry>>(resp.bytes()) {
                daily_entries = existing;
            }
        }
    }

    // Yeni kaydı ekle (en yeni kayıtlar en başta)
    daily_entries.insert(0, entry.clone());

    // Fazla şişmeyi önlemek için günde maksimum 5000 log kaydı tut
    if daily_entries.len() > 5000 {
        daily_entries.truncate(5000);
    }

    let json_bytes = serde_json::to_vec_pretty(&daily_entries)
        .map_err(|e| format!("JSON serileştirme hatası: {}", e))?;

    bucket
        .put_object_with_content_type(&key, &json_bytes, "application/json; charset=utf-8")
        .await
        .map_err(|e| format!("R2 Log yükleme hatası: {}", e))?;

    Ok(())
}

pub async fn get_audit_logs_internal(
    creds: Option<&R2Credentials>,
    limit: usize,
    date_filter: Option<&str>,
    action_filter: Option<&str>,
) -> Result<Vec<AuditLogEntry>, String> {
    let target_date = date_filter
        .map(|s| s.to_string())
        .unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());

    // 1. Önce R2'den çekmeyi dene (eğer kimlik bilgisi varsa)
    if let Some(c) = creds {
        if let Ok(bucket) = create_r2_bucket(c) {
            let key = format!("logs/audit/{}.json", target_date);
            if let Ok(resp) = bucket.get_object(&key).await {
                if resp.status_code() == 200 {
                    if let Ok(entries) = serde_json::from_slice::<Vec<AuditLogEntry>>(resp.bytes()) {
                        let filtered: Vec<AuditLogEntry> = entries
                            .into_iter()
                            .filter(|e| {
                                if let Some(af) = action_filter {
                                    if !af.trim().is_empty() && af != "all" {
                                        return e.action_type.to_lowercase() == af.to_lowercase();
                                    }
                                }
                                true
                            })
                            .take(limit)
                            .collect();
                        return Ok(filtered);
                    }
                }
            }
        }
    }

    // 2. R2'ye ulaşılamazsa veya yerelde aramak gerekirse yerel dosyadan oku
    let log_path = get_local_audit_log_path();
    let mut entries = Vec::new();

    if log_path.exists() {
        if let Ok(file) = OpenOptions::new().read(true).open(log_path) {
            let reader = BufReader::new(file);
            for line in reader.lines().flatten() {
                if let Ok(entry) = serde_json::from_str::<AuditLogEntry>(&line) {
                    if !entry.timestamp.starts_with(&target_date) {
                        continue;
                    }
                    if let Some(af) = action_filter {
                        if !af.trim().is_empty() && af != "all" && entry.action_type.to_lowercase() != af.to_lowercase() {
                            continue;
                        }
                    }
                    entries.push(entry);
                }
            }
        }
    }

    // En son kaydedilen en üstte
    entries.reverse();
    entries.truncate(limit);

    Ok(entries)
}

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::r2::{create_r2_bucket, R2Credentials};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningProcessItem {
    pub pid: u32,
    pub name: String,
    pub mem_usage: String,
    pub session_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminLiveSession {
    pub user_id: u64,
    pub username: String,
    pub role: String,
    pub avatar_color: Option<String>,
    pub avatar_emblem: Option<String>,
    pub current_page: String,
    pub current_action: String,
    pub app_version: String,
    pub hostname: String,
    pub os: String,
    pub last_heartbeat: u64,
    pub status: String, // "online" | "idle" | "offline"
    pub running_processes: Vec<RunningProcessItem>,
}

/// Windows üzerinde çalışan temel kullanıcı uygulamalarını güvenli ve sessiz bir şekilde listeler.
/// CREATE_NO_WINDOW bayrağı kullanılarak hiçbir konsol penceresi açılmaz.
/// Hassas sistem ve arka plan svchost süreçleri temizlenerek kullanıcı uygulamaları öne çıkarılır.
pub fn get_local_running_processes() -> Vec<RunningProcessItem> {
    let mut processes = Vec::new();

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = match Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            Ok(out) => out,
            Err(_) => return processes,
        };

        if !output.status.success() {
            return processes;
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        for line in stdout_str.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // CSV parçala: "Image Name","PID","Session Name","Session#","Mem Usage"
            let parts: Vec<String> = line
                .split("\",\"")
                .map(|p| p.trim_matches('"').trim().to_string())
                .collect();

            if parts.len() >= 5 {
                let name = parts[0].clone();
                let pid = parts[1].parse::<u32>().unwrap_or(0);
                let session_name = parts[2].clone();
                let mem_usage = parts[4].clone();

                let name_lower = name.to_lowercase();

                // Sistem çekirdek servislerini filtrele (gizlilik ve netlik için)
                if name_lower == "system"
                    || name_lower == "system idle process"
                    || name_lower == "registry"
                    || name_lower.starts_with("svchost")
                    || name_lower.starts_with("csrss")
                    || name_lower.starts_with("wininit")
                    || name_lower.starts_with("services")
                    || name_lower.starts_with("lsass")
                    || name_lower.starts_with("smss")
                    || name_lower.starts_with("fontdrvhost")
                {
                    continue;
                }

                processes.push(RunningProcessItem {
                    pid,
                    name,
                    mem_usage,
                    session_type: session_name,
                });
            }
        }
    }

    // İsme göre sırala
    processes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    // Maksimum ilk 60 kullanıcı uygulamasını döndür
    processes.truncate(60);

    processes
}

pub async fn send_admin_heartbeat_internal(
    creds: &R2Credentials,
    user_id: u64,
    username: &str,
    role: &str,
    avatar_color: Option<String>,
    avatar_emblem: Option<String>,
    current_page: &str,
    current_action: &str,
    app_version: &str,
) -> Result<AdminLiveSession, String> {
    let now_ts = Utc::now().timestamp() as u64;
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Admin-PC".to_string());
    let os = format!("Windows ({})", std::env::consts::ARCH);

    let processes = get_local_running_processes();

    let session = AdminLiveSession {
        user_id,
        username: username.to_string(),
        role: role.to_string(),
        avatar_color,
        avatar_emblem,
        current_page: current_page.to_string(),
        current_action: current_action.to_string(),
        app_version: app_version.to_string(),
        hostname,
        os,
        last_heartbeat: now_ts,
        status: "online".to_string(),
        running_processes: processes,
    };

    let bucket = create_r2_bucket(creds)?;
    let key = format!("system/admin_sessions/{}.json", user_id);
    let json_bytes = serde_json::to_vec_pretty(&session).map_err(|e| e.to_string())?;

    bucket
        .put_object_with_content_type(&key, &json_bytes, "application/json; charset=utf-8")
        .await
        .map_err(|e| format!("R2 Yönetici oturum bildirimi gönderilemedi: {}", e))?;

    Ok(session)
}

pub async fn get_active_admin_sessions_internal(
    creds: &R2Credentials,
) -> Result<Vec<AdminLiveSession>, String> {
    let bucket = create_r2_bucket(creds)?;
    let prefix = "system/admin_sessions/".to_string();

    let list_results = bucket
        .list(prefix, None)
        .await
        .map_err(|e| format!("Yönetici oturumları listelenemedi: {}", e))?;

    let now_ts = Utc::now().timestamp() as u64;
    let mut sessions = Vec::new();

    for res in list_results {
        for obj in res.contents {
            if !obj.key.ends_with(".json") {
                continue;
            }

            if let Ok(resp) = bucket.get_object(&obj.key).await {
                if let Ok(session) = serde_json::from_slice::<AdminLiveSession>(resp.bytes()) {
                    let mut s = session;
                    let diff_secs = now_ts.saturating_sub(s.last_heartbeat);

                    if diff_secs <= 90 {
                        s.status = "online".to_string();
                    } else if diff_secs <= 300 {
                        s.status = "idle".to_string();
                    } else {
                        s.status = "offline".to_string();
                    }

                    sessions.push(s);
                }
            }
        }
    }

    // Çevrimiçi olanları en başa al, sonra son aktiviteye göre sırala
    sessions.sort_by(|a, b| {
        let status_order_a = match a.status.as_str() {
            "online" => 0,
            "idle" => 1,
            _ => 2,
        };
        let status_order_b = match b.status.as_str() {
            "online" => 0,
            "idle" => 1,
            _ => 2,
        };

        status_order_a
            .cmp(&status_order_b)
            .then_with(|| b.last_heartbeat.cmp(&a.last_heartbeat))
    });

    Ok(sessions)
}

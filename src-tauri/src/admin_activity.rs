use chrono::Utc;
use serde::{Deserialize, Serialize};
use crate::r2::{create_r2_bucket, R2Credentials};

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

use crate::r2::{
    create_r2_folder_internal, delete_r2_object_internal, get_staged_release_info_internal,
    list_r2_backups_internal, list_r2_explorer_internal, publish_release_to_r2_internal,
    test_r2_connection, upload_r2_bytes_internal, upload_r2_file_internal, PublishReleaseResult,
    R2BackupGroup, R2Credentials, R2ExplorerResponse, R2ObjectItem, R2TestResult,
    StagedReleaseInfo,
};
use crate::secrets::{delete_secret, get_secret, save_secret};
use crate::xenforo::{
    authenticate_forum_user, fetch_dashboard_data, generate_ai_forum_report_internal,
    test_xenforo_connection, AIForumReport, AuthResult, DashboardData, XenForoTestResult,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub const DEFAULT_FORUM_URL: &str = "https://turkceyama.org";
pub const DEFAULT_XENFORO_API_KEY: &str = "FaRm9XgJbqfnQHz470Y0OdX-IFpaE3HU";
pub const DEFAULT_R2_ACCOUNT_ID: &str = "3a2c89e6f4b817d7bf36c4377474212e";
pub const DEFAULT_R2_BUCKET_NAME: &str = "turkceyama";
pub const DEFAULT_R2_CUSTOM_DOMAIN: &str = "https://indir.turkceyama.org";
pub const DEFAULT_R2_ACCESS_KEY_ID: &str = "7807481d1b946133cb1673fe39882d9d";
pub const DEFAULT_R2_SECRET_ACCESS_KEY: &str = "d63cd6aa525e909bd156b100a36acac2242b08cb8228b330abbda3e59baaf673";

pub fn get_configured_forum_url() -> String {
    let v = get_secret("forum_url").unwrap_or_default();
    if v.trim().is_empty() {
        std::env::var("FORUM_URL").unwrap_or_else(|_| DEFAULT_FORUM_URL.to_string())
    } else {
        v
    }
}

pub fn get_configured_api_key() -> String {
    let v = get_secret("xenforo_api_key").unwrap_or_default();
    if v.trim().is_empty() {
        let env_v = std::env::var("XENFORO_API_KEY").unwrap_or_default();
        if env_v.trim().is_empty() {
            DEFAULT_XENFORO_API_KEY.to_string()
        } else {
            env_v
        }
    } else {
        v
    }
}

#[allow(dead_code)]
pub fn get_configured_r2_account_id() -> String {
    let v = get_secret("r2_account_id").unwrap_or_default();
    if v.trim().is_empty() {
        let env_v = std::env::var("R2_ACCOUNT_ID").unwrap_or_default();
        if env_v.trim().is_empty() {
            DEFAULT_R2_ACCOUNT_ID.to_string()
        } else {
            env_v
        }
    } else {
        v
    }
}

#[allow(dead_code)]
pub fn get_configured_r2_bucket_name() -> String {
    let v = get_secret("r2_bucket_name").unwrap_or_default();
    if v.trim().is_empty() {
        std::env::var("R2_BUCKET_NAME").unwrap_or_else(|_| "turkceyama".to_string())
    } else {
        v
    }
}

pub fn get_configured_r2_custom_domain() -> String {
    let v = get_secret("r2_custom_domain").unwrap_or_default();
    if v.trim().is_empty() {
        std::env::var("R2_CUSTOM_DOMAIN").unwrap_or_else(|_| "https://indir.turkceyama.org".to_string())
    } else {
        v
    }
}

pub fn get_configured_cf_api_token() -> String {
    let v = get_secret("cloudflare_api_token").unwrap_or_default();
    if v.trim().is_empty() {
        std::env::var("CLOUDFLARE_API_TOKEN").unwrap_or_default()
    } else {
        v
    }
}

pub fn get_configured_cf_zone_id() -> String {
    let v = get_secret("cloudflare_zone_id").unwrap_or_default();
    if v.trim().is_empty() {
        std::env::var("CLOUDFLARE_ZONE_ID").unwrap_or_default()
    } else {
        v
    }
}

use crate::transfers::{
    add_transfer_job_internal, emit_update, SharedTransferManager, TransferJob,
    TransferQueueResponse,
};

#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct ActiveSession {
    pub user_id: u64,
    pub username: String,
    pub role: String,
    pub created_at: Instant,
    pub expires_at: Instant,
}

#[derive(Default)]
pub struct AppState {
    pub sessions: Mutex<HashMap<String, ActiveSession>>,
    pub dashboard_cache: Mutex<Option<(Instant, DashboardData)>>,
    pub login_attempts: Mutex<HashMap<String, (u32, Instant)>>,
    pub transfer_manager: SharedTransferManager,
}

impl AppState {
    pub fn is_admin_session(&self, token: Option<&str>) -> bool {
        if let Some(t) = token {
            if !t.trim().is_empty() {
                if let Ok(guard) = self.sessions.lock() {
                    if let Some(session) = guard.get(t) {
                        if session.expires_at > Instant::now() {
                            return session.role == "super_admin" || session.role == "admin";
                        }
                    }
                }
            }
        }
        false
    }

    pub fn is_super_admin_session(&self, token: Option<&str>) -> bool {
        if let Some(t) = token {
            if !t.trim().is_empty() {
                if let Ok(guard) = self.sessions.lock() {
                    if let Some(session) = guard.get(t) {
                        if session.expires_at > Instant::now() {
                            return session.role == "super_admin";
                        }
                    }
                }
            }
        }
        false
    }

    pub fn get_session_username(&self, token: Option<&str>) -> String {
        if let Some(t) = token {
            if !t.trim().is_empty() {
                if let Ok(guard) = self.sessions.lock() {
                    if let Some(session) = guard.get(t) {
                        return session.username.clone();
                    }
                }
            }
        }
        if let Ok(u) = get_secret("session_username") {
            if !u.is_empty() {
                return u;
            }
        }
        "Süper Yönetici".to_string()
    }

    pub fn get_session_info(&self, token: Option<&str>) -> (u64, String, String) {
        if let Some(t) = token {
            if !t.trim().is_empty() {
                if let Ok(guard) = self.sessions.lock() {
                    if let Some(session) = guard.get(t) {
                        return (session.user_id, session.username.clone(), session.role.clone());
                    }
                }
            }
        }
        let username = self.get_session_username(token);
        let user_id = get_secret("session_user_id").ok().and_then(|id| id.parse::<u64>().ok()).unwrap_or(1);
        let role = get_secret("session_role").unwrap_or_else(|_| "admin".to_string());
        (user_id, username, role)
    }
}

fn default_transfer_concurrency() -> usize { 4 }
fn default_chunk_size_mb() -> usize { 16 }
fn default_speed_limit_mbps() -> usize { 0 }
fn default_true() -> bool { true }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub forum_url: String,
    pub xenforo_api_key: String,
    #[serde(default)]
    pub forum_banned_count: Option<String>,
    pub r2_account_id: String,
    pub r2_access_key_id: String,
    pub r2_secret_access_key: String,
    pub r2_bucket_name: String,
    pub r2_custom_domain: String,
    // Yeni Gelişmiş Ayarlar
    #[serde(default = "default_transfer_concurrency")]
    pub transfer_concurrency: usize,
    #[serde(default = "default_chunk_size_mb")]
    pub chunk_size_mb: usize,
    #[serde(default = "default_speed_limit_mbps")]
    pub speed_limit_mbps: usize,
    #[serde(default = "default_true")]
    pub enable_native_notifications: bool,
    #[serde(default = "default_true")]
    pub enable_sound_effects: bool,
    #[serde(default = "default_true")]
    pub auto_start_with_windows: bool,
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
}

#[tauri::command]
pub fn save_settings(
    state: tauri::State<AppState>,
    settings: AppSettings,
    session_token: Option<String>,
) -> Result<String, String> {
    // Güvenlik Doğrulaması: Eğer sistemde daha önceden kayıtlı API anahtarı varsa,
    // yetkisiz kullanıcıların veya personelin ayarları değiştirmesi Rust seviyesinde engellenir.
    let existing_key = get_secret("xenforo_api_key").unwrap_or_default();
    if !existing_key.trim().is_empty() && !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Sunucu bağlantı ve güvenlik ayarlarını değiştirmek için Süper Yönetici oturumu gereklidir.".to_string());
    }

    save_secret("forum_url", &settings.forum_url)?;
    save_secret("xenforo_api_key", &settings.xenforo_api_key)?;
    if let Some(ref bc) = settings.forum_banned_count {
        save_secret("forum_banned_count", bc)?;
    }
    save_secret("r2_account_id", &settings.r2_account_id)?;
    save_secret("r2_access_key_id", &settings.r2_access_key_id)?;
    save_secret("r2_secret_access_key", &settings.r2_secret_access_key)?;
    save_secret("r2_bucket_name", &settings.r2_bucket_name)?;
    save_secret("r2_custom_domain", &settings.r2_custom_domain)?;

    // Gelişmiş Performans ve Sistem Ayarları
    save_secret("transfer_concurrency", &settings.transfer_concurrency.to_string())?;
    save_secret("chunk_size_mb", &settings.chunk_size_mb.to_string())?;
    save_secret("speed_limit_mbps", &settings.speed_limit_mbps.to_string())?;
    save_secret("enable_native_notifications", if settings.enable_native_notifications { "1" } else { "0" })?;
    save_secret("enable_sound_effects", if settings.enable_sound_effects { "1" } else { "0" })?;
    save_secret("auto_start_with_windows", if settings.auto_start_with_windows { "1" } else { "0" })?;
    save_secret("minimize_to_tray", if settings.minimize_to_tray { "1" } else { "0" })?;

    // Windows Başlangıç Kaydı Senkronizasyonu
    let _ = crate::diagnostics::configure_windows_autostart(settings.auto_start_with_windows);

    // Ayarlar güncellendiğinde gösterge paneli önbelleğini sıfırla
    if let Ok(mut cache_guard) = state.dashboard_cache.lock() {
        *cache_guard = None;
    }

    Ok("Ayarlar Windows Kimlik Bilgisi Yöneticisine güvenle kaydedildi!".to_string())
}

#[tauri::command]
pub fn load_settings(
    state: tauri::State<AppState>,
    session_token: Option<String>,
) -> Result<AppSettings, String> {
    // Güvenlik Doğrulaması: Personel veya harici bir çağrı bu fonksiyondan API anahtarlarını çekemez!
    let existing_key = get_secret("xenforo_api_key").unwrap_or_default();
    if !existing_key.trim().is_empty() && !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Sunucu güvenlik anahtarlarını görüntülemek için Süper Yönetici oturumu gereklidir.".to_string());
    }

    Ok(AppSettings {
        forum_url: {
            let v = get_secret("forum_url").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_FORUM_URL.to_string() } else { v }
        },
        xenforo_api_key: {
            let v = get_secret("xenforo_api_key").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_XENFORO_API_KEY.to_string() } else { v }
        },
        forum_banned_count: get_secret("forum_banned_count").ok(),
        r2_account_id: {
            let v = get_secret("r2_account_id").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_R2_ACCOUNT_ID.to_string() } else { v }
        },
        r2_access_key_id: {
            let v = get_secret("r2_access_key_id").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_R2_ACCESS_KEY_ID.to_string() } else { v }
        },
        r2_secret_access_key: {
            let v = get_secret("r2_secret_access_key").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_R2_SECRET_ACCESS_KEY.to_string() } else { v }
        },
        r2_bucket_name: {
            let v = get_secret("r2_bucket_name").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_R2_BUCKET_NAME.to_string() } else { v }
        },
        r2_custom_domain: {
            let v = get_secret("r2_custom_domain").unwrap_or_default();
            if v.trim().is_empty() { DEFAULT_R2_CUSTOM_DOMAIN.to_string() } else { v }
        },
        transfer_concurrency: get_secret("transfer_concurrency").ok().and_then(|v| v.parse().ok()).unwrap_or(4),
        chunk_size_mb: get_secret("chunk_size_mb").ok().and_then(|v| v.parse().ok()).unwrap_or(16),
        speed_limit_mbps: get_secret("speed_limit_mbps").ok().and_then(|v| v.parse().ok()).unwrap_or(0),
        enable_native_notifications: get_secret("enable_native_notifications").map(|v| v == "1").unwrap_or(true),
        enable_sound_effects: get_secret("enable_sound_effects").map(|v| v == "1").unwrap_or(true),
        auto_start_with_windows: {
            let enabled = get_secret("auto_start_with_windows").map(|v| v == "1").unwrap_or(true);
            if enabled && !crate::diagnostics::is_windows_autostart_enabled() {
                let _ = crate::diagnostics::configure_windows_autostart(true);
            }
            enabled
        },
        minimize_to_tray: get_secret("minimize_to_tray").map(|v| v == "1").unwrap_or(true),
    })
}

#[tauri::command]
pub fn clear_all_settings(
    state: tauri::State<AppState>,
    session_token: Option<String>,
) -> Result<String, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Tüm ayarları silmek için Süper Yönetici oturumu gereklidir.".to_string());
    }

    let _ = delete_secret("forum_url");
    let _ = delete_secret("xenforo_api_key");
    let _ = delete_secret("forum_banned_count");
    let _ = delete_secret("r2_account_id");
    let _ = delete_secret("r2_access_key_id");
    let _ = delete_secret("r2_secret_access_key");
    let _ = delete_secret("r2_bucket_name");
    let _ = delete_secret("r2_custom_domain");
    let _ = delete_secret("transfer_concurrency");
    let _ = delete_secret("chunk_size_mb");
    let _ = delete_secret("speed_limit_mbps");
    let _ = delete_secret("enable_native_notifications");
    let _ = delete_secret("enable_sound_effects");
    let _ = delete_secret("auto_start_with_windows");
    let _ = delete_secret("minimize_to_tray");
    let _ = crate::diagnostics::configure_windows_autostart(false);
    let _ = delete_secret("r2_account_id");
    let _ = delete_secret("r2_access_key_id");
    let _ = delete_secret("r2_secret_access_key");
    let _ = delete_secret("r2_bucket_name");
    let _ = delete_secret("r2_custom_domain");

    if let Ok(mut cache_guard) = state.dashboard_cache.lock() {
        *cache_guard = None;
    }

    Ok("Tüm kayıtlı kimlik bilgileri güvenle silindi.".to_string())
}

#[tauri::command]
pub async fn test_xenforo_api(forum_url: String, api_key: String) -> XenForoTestResult {
    test_xenforo_connection(&forum_url, &api_key).await
}

#[tauri::command]
pub async fn test_cloudflare_r2(
    account_id: String,
    bucket: String,
    custom_domain: String,
) -> R2TestResult {
    test_r2_connection(&account_id, &bucket, &custom_domain).await
}

#[tauri::command]
pub async fn login_user(
    state: tauri::State<'_, AppState>,
    login: String,
    password: String,
) -> Result<AuthResult, String> {
    let clean_login = login.trim().to_lowercase();

    // 1. KABA KUVVET (BRUTE FORCE) VE GİRİŞ DENEME SINIRI KONTROLÜ
    {
        if let Ok(attempts) = state.login_attempts.lock() {
            if let Some((count, last_try)) = attempts.get(&clean_login) {
                if *count >= 5 {
                    let elapsed = last_try.elapsed();
                    if elapsed < Duration::from_secs(300) {
                        let remaining_secs = 300 - elapsed.as_secs();
                        return Err(format!(
                            "Giriş Deneme Sınırı Aşıldı: 5 kez başarısız giriş yapıldı. Güvenliğiniz için hesabınız {} saniye boyunca kilitlendi.",
                            remaining_secs
                        ));
                    }
                }
            }
        }
    }

    let forum_url = get_configured_forum_url();
    let api_key = get_configured_api_key();

    let mut auth_res = authenticate_forum_user(&forum_url, &api_key, &login, &password).await;

    if auth_res.success {
        // Başarılı girişte deneme sayacını sıfırla
        if let Ok(mut attempts) = state.login_attempts.lock() {
            attempts.remove(&clean_login);
        }

        if let (Some(ref user), Some(ref role)) = (&auth_res.user, &auth_res.role) {
            let access_token = uuid::Uuid::new_v4().to_string();
            let refresh_token = uuid::Uuid::new_v4().to_string();
            let now = Instant::now();
            let expires_at = now + Duration::from_secs(900); // 15 dakika

            if let Ok(mut guard) = state.sessions.lock() {
                guard.insert(
                    access_token.clone(),
                    ActiveSession {
                        user_id: user.user_id,
                        username: user.username.clone(),
                        role: role.clone(),
                        created_at: now,
                        expires_at,
                    },
                );
            }

            // Refresh token ve oturum bilgileri Windows Keyring'de güvenle saklanır
            let _ = save_secret("refresh_token", &refresh_token);
            let _ = save_secret("session_role", role);
            let _ = save_secret("session_username", &user.username);
            let _ = save_secret("session_user_id", &user.user_id.to_string());
            auth_res.session_token = Some(access_token);
        }
    } else {
        // Başarısız girişte sayacı artır
        if let Ok(mut attempts) = state.login_attempts.lock() {
            let entry = attempts.entry(clean_login).or_insert((0, Instant::now()));
            entry.0 += 1;
            entry.1 = Instant::now();
        }
    }

    Ok(auth_res)
}

#[tauri::command]
pub fn refresh_session_token(state: tauri::State<AppState>) -> Result<AuthResult, String> {
    let refresh_token = get_secret("refresh_token").unwrap_or_default();
    let role = get_secret("session_role").unwrap_or_default();
    let username = get_secret("session_username").unwrap_or_default();
    let user_id_str = get_secret("session_user_id").unwrap_or_default();

    if refresh_token.trim().is_empty() || role.trim().is_empty() || username.trim().is_empty() {
        return Err("Oturum yenilenemedi: Geçerli refresh token bulunamadı.".to_string());
    }

    let user_id = user_id_str.parse::<u64>().unwrap_or(0);
    let new_access_token = uuid::Uuid::new_v4().to_string();
    let now = Instant::now();
    let expires_at = now + Duration::from_secs(900); // 15 dakika

    if let Ok(mut guard) = state.sessions.lock() {
        guard.insert(
            new_access_token.clone(),
            ActiveSession {
                user_id,
                username: username.clone(),
                role: role.clone(),
                created_at: now,
                expires_at,
            },
        );
    }

    let is_super = role == "super_admin";
    let is_admin = is_super || role == "admin";

    Ok(AuthResult {
        success: true,
        message: "Oturum anahtarı başarıyla yenilendi".to_string(),
        user: Some(crate::xenforo::ForumUser {
            user_id,
            username,
            email: None,
            is_admin,
            is_moderator: true,
            is_super_admin: is_super,
            is_staff: true,
            user_title: None,
            avatar_url: None,
        }),
        role: Some(role),
        session_token: Some(new_access_token),
    })
}

#[tauri::command]
pub fn logout_user(state: tauri::State<AppState>, session_token: Option<String>) -> Result<(), String> {
    if let Some(token) = session_token {
        if let Ok(mut guard) = state.sessions.lock() {
            guard.remove(&token);
        }
    }
    let _ = delete_secret("session_token");
    let _ = delete_secret("refresh_token");
    let _ = delete_secret("session_role");
    let _ = delete_secret("session_username");
    let _ = delete_secret("session_user_id");
    Ok(())
}

#[tauri::command]
pub fn restore_saved_session(state: tauri::State<AppState>) -> Result<Option<AuthResult>, String> {
    let refresh_token = get_secret("refresh_token").unwrap_or_default();
    let role = get_secret("session_role").unwrap_or_default();
    let username = get_secret("session_username").unwrap_or_default();
    let user_id_str = get_secret("session_user_id").unwrap_or_default();

    if refresh_token.trim().is_empty() || role.trim().is_empty() || username.trim().is_empty() {
        return Ok(None);
    }

    let user_id = user_id_str.parse::<u64>().unwrap_or(0);
    let new_access_token = uuid::Uuid::new_v4().to_string();
    let now = Instant::now();
    let expires_at = now + Duration::from_secs(900); // 15 dakika

    if let Ok(mut guard) = state.sessions.lock() {
        guard.insert(
            new_access_token.clone(),
            ActiveSession {
                user_id,
                username: username.clone(),
                role: role.clone(),
                created_at: now,
                expires_at,
            },
        );
    }

    let is_super = role == "super_admin";
    let is_admin = is_super || role == "admin";

    Ok(Some(AuthResult {
        success: true,
        message: "Kayıtlı oturum başarıyla geri yüklendi".to_string(),
        user: Some(crate::xenforo::ForumUser {
            user_id,
            username,
            email: None,
            is_admin,
            is_moderator: true,
            is_super_admin: is_super,
            is_staff: true,
            user_title: None,
            avatar_url: None,
        }),
        role: Some(role),
        session_token: Some(new_access_token),
    }))
}

#[tauri::command]
pub async fn get_dashboard_stats(
    state: tauri::State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<DashboardData, String> {
    let force = force_refresh.unwrap_or(false);

    // KORUMA & PERFORMANS: 30 Saniyelik Akıllı Önbellek (Forum Sunucusunu Asla Yormaz!)
    // Eğer zorunlu yenileme istenmediyse ve son 30 saniye içinde çekilmiş veri varsa doğrudan hafızadan dönülür.
    if !force {
        if let Ok(guard) = state.dashboard_cache.lock() {
            if let Some((cached_at, ref cached_data)) = *guard {
                if cached_at.elapsed() < Duration::from_secs(30) {
                    return Ok(cached_data.clone());
                }
            }
        }
    }

    let forum_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    let custom_domain = get_configured_r2_custom_domain();

    let mut res = fetch_dashboard_data(&forum_url, &api_key, &custom_domain).await?;

    // Eğer Cloudflare R2 anahtarları varsa, gerçek bucket boyutunu hesapla
    if let Ok(creds) = load_r2_creds_from_keyring() {
        if let Ok((used_mb, total_files)) = crate::r2::calculate_r2_bucket_stats(&creds).await {
            res.r2_storage_used_mb = used_mb;
            res.r2_storage_used_gb = used_mb / 1024.0;
            res.r2_total_files = total_files;
        }
    }

    // Başarılı sonucu 30 saniye boyunca hafızada sakla
    if let Ok(mut guard) = state.dashboard_cache.lock() {
        *guard = Some((Instant::now(), res.clone()));
    }

    Ok(res)
}

fn load_r2_creds_from_keyring() -> Result<R2Credentials, String> {
    let account_id = {
        let v = get_secret("r2_account_id").unwrap_or_default();
        if v.trim().is_empty() { DEFAULT_R2_ACCOUNT_ID.to_string() } else { v }
    };
    let bucket = {
        let v = get_secret("r2_bucket_name").unwrap_or_default();
        if v.trim().is_empty() { DEFAULT_R2_BUCKET_NAME.to_string() } else { v }
    };
    let access_key_id = {
        let v = get_secret("r2_access_key_id").unwrap_or_default();
        if v.trim().is_empty() {
            let env_v = std::env::var("R2_ACCESS_KEY_ID").unwrap_or_default();
            if env_v.trim().is_empty() {
                DEFAULT_R2_ACCESS_KEY_ID.to_string()
            } else {
                env_v
            }
        } else {
            v
        }
    };
    let secret_access_key = {
        let v = get_secret("r2_secret_access_key").unwrap_or_default();
        if v.trim().is_empty() {
            let env_v = std::env::var("R2_SECRET_ACCESS_KEY").unwrap_or_default();
            if env_v.trim().is_empty() {
                DEFAULT_R2_SECRET_ACCESS_KEY.to_string()
            } else {
                env_v
            }
        } else {
            v
        }
    };
    let custom_domain = {
        let v = get_secret("r2_custom_domain").unwrap_or_default();
        if v.trim().is_empty() { DEFAULT_R2_CUSTOM_DOMAIN.to_string() } else { v }
    };

    if access_key_id.trim().is_empty() || secret_access_key.trim().is_empty() {
        return Err("Cloudflare R2 erişim bilgileri (Access Key, Secret Key) bulunamadı. Lütfen Ayarlar sekmesinden kaydedin veya sistem yöneticinize danışın.".to_string());
    }

    Ok(R2Credentials {
        account_id,
        bucket,
        access_key_id,
        secret_access_key,
        custom_domain,
    })
}

#[tauri::command]
pub async fn get_staged_release_info(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
) -> Result<StagedReleaseInfo, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Sürüm paketlerini görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring().ok();
    get_staged_release_info_internal(creds.as_ref()).await
}

#[tauri::command]
pub async fn publish_release_to_r2(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    notes: Option<String>,
    version: Option<String>,
) -> Result<PublishReleaseResult, String> {
    if !state.is_super_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Güncelleme paketini Cloudflare R2'ye yayınlamak için Süper Yönetici (Super Admin) yetkisi zorunludur.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let username = state.get_session_username(session_token.as_deref());

    publish_release_to_r2_internal(&creds, notes.as_deref(), version.as_deref(), &username).await
}

#[tauri::command]
pub async fn list_r2_backups(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
) -> Result<Vec<R2BackupGroup>, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Yedekleme geçmişini görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    list_r2_backups_internal(&creds).await
}

#[tauri::command]
pub async fn list_r2_explorer(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    prefix: Option<String>,
) -> Result<R2ExplorerResponse, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: R2 dosyalarını görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    list_r2_explorer_internal(&creds, prefix.as_deref()).await
}

#[tauri::command]
pub async fn delete_r2_object(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    key: String,
) -> Result<bool, String> {
    if !state.is_super_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Cloudflare R2'den dosya silmek için Süper Yönetici yetkisi gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let res = delete_r2_object_internal(&creds, &key).await;
    if res.is_ok() {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "R2_DELETE",
            Some(&key),
            &format!("Cloudflare R2 nesnesi silindi: {}", key),
            "warning",
        ).await;
    }
    res
}

#[tauri::command]
pub async fn create_r2_folder(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    folder_prefix: String,
) -> Result<bool, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Yeni klasör açmak için Yönetici yetkisi gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let res = create_r2_folder_internal(&creds, &folder_prefix).await;
    if res.is_ok() {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "R2_CREATE_FOLDER",
            Some(&folder_prefix),
            &format!("R2 yeni klasör oluşturuldu: {}", folder_prefix),
            "info",
        ).await;
    }
    res
}

#[tauri::command]
pub async fn upload_r2_file_from_path(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    local_path: String,
    target_key: String,
) -> Result<R2ObjectItem, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Dosya yüklemek için Yönetici yetkisi gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let res = upload_r2_file_internal(&creds, &local_path, &target_key, Some(&app)).await;
    if let Ok(ref obj) = res {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "R2_UPLOAD",
            Some(&target_key),
            &format!("R2'ye dosya yüklendi ({} - {})", obj.name, obj.size_formatted),
            "success",
        ).await;
    }
    res
}

#[tauri::command]
pub async fn upload_r2_file_bytes(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    target_key: String,
    bytes: Vec<u8>,
    file_name: String,
) -> Result<R2ObjectItem, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Dosya yüklemek için Yönetici yetkisi gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let res = upload_r2_bytes_internal(&creds, &target_key, &bytes, &file_name, Some(&app)).await;
    if let Ok(ref obj) = res {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "R2_UPLOAD",
            Some(&target_key),
            &format!("R2'ye dosya yüklendi ({} - {})", obj.name, obj.size_formatted),
            "success",
        ).await;
    }
    res
}

#[tauri::command]
pub async fn rename_or_move_r2_object(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    from_key: String,
    to_key: String,
) -> Result<bool, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Dosya veya klasör taşımak/yeniden adlandırmak için Yönetici yetkisi gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let res = crate::r2::rename_or_move_r2_object_internal(&creds, &from_key, &to_key).await;
    if res.is_ok() {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "R2_RENAME",
            Some(&from_key),
            &format!("R2 nesnesi taşındı/yeniden adlandırıldı: {} -> {}", from_key, to_key),
            "info",
        ).await;
    }
    res
}

#[tauri::command]
pub async fn batch_delete_r2_objects(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    keys: Vec<String>,
) -> Result<usize, String> {
    if !state.is_super_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Toplu dosya silmek için Süper Yönetici yetkisi gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    let res = crate::r2::batch_delete_r2_objects_internal(&creds, keys.clone()).await;
    if let Ok(count) = res {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "R2_BATCH_DELETE",
            None,
            &format!("Toplu {} adet R2 nesnesi kalıcı olarak silindi", count),
            "warning",
        ).await;
    }
    res
}

#[tauri::command]
pub async fn inspect_r2_archive(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    key: String,
) -> Result<crate::r2::ArchiveInspectResult, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Arşiv içeriğini incelemek için Yönetici oturumu gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    crate::r2::inspect_r2_archive_internal(&creds, &key).await
}

#[tauri::command]
pub async fn get_r2_stats(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
) -> Result<crate::r2::R2BucketStats, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: R2 istatistiklerini görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;
    crate::r2::get_r2_stats_internal(&creds).await
}

#[tauri::command]
pub async fn get_forum_categories() -> Result<Vec<crate::xenforo::SimpleForumNode>, String> {
    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    crate::xenforo::get_forum_categories_simple(&base_url, &api_key).await
}

#[tauri::command]
pub async fn create_forum_thread(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    node_id: u64,
    title: String,
    message: String,
) -> Result<crate::xenforo::CreateThreadResult, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Forumda konu açmak için Yönetici oturumu gereklidir.".to_string());
    }

    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    crate::xenforo::create_forum_thread_internal(&base_url, &api_key, node_id, &title, &message).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedFileInfo {
    pub file_path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub size_formatted: String,
}

#[tauri::command]
pub async fn pick_file_dialog() -> Result<Option<SelectedFileInfo>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Cloudflare R2'ye Yüklenecek Dosyayı Seçin (Büyük Dosyalar Desteklenir)")
        .pick_file()
        .await;

    if let Some(handle) = file {
        let path = handle.path().to_path_buf();
        let meta = tokio::fs::metadata(&path)
            .await
            .map_err(|e| format!("Dosya bilgisi okunamadı: {}", e))?;
        let size = meta.len();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("dosya")
            .to_string();

        Ok(Some(SelectedFileInfo {
            file_path: path.to_string_lossy().to_string(),
            file_name,
            size_bytes: size,
            size_formatted: crate::r2::format_bytes(size),
        }))
    } else {
        Ok(None)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModerationActionResult {
    pub success: bool,
    pub message: String,
    pub item_id: u64,
    pub action: String,
}

#[tauri::command]
pub async fn handle_moderation_action(
    state: tauri::State<'_, AppState>,
    item_id: u64,
    action: String, // "approve" | "ignore" | "spam" | "delete"
    post_id: Option<u64>,
    reason: Option<String>,
    session_token: Option<String>,
) -> Result<ModerationActionResult, String> {
    let username = state.get_session_username(session_token.as_deref());
    let forum_url = {
        let v = get_secret("forum_url").unwrap_or_default();
        if v.trim().is_empty() { DEFAULT_FORUM_URL.to_string() } else { v }
    };
    let api_key = {
        let v = get_secret("xenforo_api_key").unwrap_or_default();
        if v.trim().is_empty() { DEFAULT_XENFORO_API_KEY.to_string() } else { v }
    };

    let clean_url = forum_url.trim_end_matches('/');
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    // Eğer XenForo REST API üzerinde silme/onaylama endpoint'i çağrılabiliyorsa deneyelim:
    if let Some(pid) = post_id {
        let target_post_url = format!("{}/api/posts/{}", clean_url, pid);
        match action.as_str() {
            "delete" | "spam" => {
                let _ = client
                    .delete(&target_post_url)
                    .header("XF-Api-Key", api_key.trim())
                    .header("User-Agent", "GUNNERIUS-Portal/1.0")
                    .send()
                    .await;
            }
            "approve" => {
                // Post durumunu güncelleme isteği
                let _ = client
                    .post(&target_post_url)
                    .header("XF-Api-Key", api_key.trim())
                    .header("User-Agent", "GUNNERIUS-Portal/1.0")
                    .form(&[("message_state", "visible")])
                    .send()
                    .await;
            }
            _ => {}
        }
    }

    let action_label = match action.as_str() {
        "approve" => "Onaylandı ve yayınlandı",
        "ignore" => "İşlem yapılmadan pas geçildi",
        "spam" => "Spam olarak işaretlendi ve temizlendi",
        "delete" => "Kalıcı olarak silindi",
        _ => "İşlem tamamlandı",
    };

    let msg = format!("[{}] Nolu kayıt {} ({}) tarafından {}.", item_id, username, reason.unwrap_or_default(), action_label);

    // Dashboard önbelleğini temizle ki sonraki get_dashboard_stats çağrısında taze liste dönsün
    if let Ok(mut guard) = state.dashboard_cache.lock() {
        *guard = None;
    }

    Ok(ModerationActionResult {
        success: true,
        message: msg,
        item_id,
        action,
    })
}


#[tauri::command]
pub async fn get_topics_analytics(
    period: Option<String>,
) -> Result<crate::xenforo::TopicsAnalyticsData, String> {
    let forum_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    let p = period.unwrap_or_else(|| "weekly".to_string());
    crate::xenforo::fetch_topics_analytics(&forum_url, &api_key, &p).await
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrashLogEntry {
    pub timestamp: String,
    pub error_message: String,
    pub stack_trace: Option<String>,
    pub context: Option<String>,
}

#[tauri::command]
pub fn log_client_error(
    error_message: String,
    stack_trace: Option<String>,
    context: Option<String>,
) -> Result<(), String> {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_line = format!(
        "[{}] ALAN: {} | HATA: {} | DETAY: {}\n",
        now,
        context.as_deref().unwrap_or("Genel"),
        error_message,
        stack_trace.as_deref().unwrap_or("Yok")
    );

    let log_path = std::env::current_dir()
        .map(|p| p.join("gunnerius_errors.log"))
        .unwrap_or_else(|_| std::path::PathBuf::from("gunnerius_errors.log"));

    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = file.write_all(log_line.as_bytes());
    }

    Ok(())
}

#[tauri::command]
pub fn get_crash_logs() -> Result<Vec<CrashLogEntry>, String> {
    let log_path = std::env::current_dir()
        .map(|p| p.join("gunnerius_errors.log"))
        .unwrap_or_else(|_| std::path::PathBuf::from("gunnerius_errors.log"));

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    if let Ok(content) = std::fs::read_to_string(log_path) {
        for line in content.lines().rev().take(50) {
            if line.trim().is_empty() {
                continue;
            }
            entries.push(CrashLogEntry {
                timestamp: line.chars().take(21).collect(),
                error_message: line.to_string(),
                stack_trace: None,
                context: None,
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
pub fn clear_crash_logs() -> Result<(), String> {
    let log_path = std::env::current_dir()
        .map(|p| p.join("gunnerius_errors.log"))
        .unwrap_or_else(|_| std::path::PathBuf::from("gunnerius_errors.log"));

    if log_path.exists() {
        let _ = std::fs::remove_file(log_path);
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadNoteItem {
    pub thread_id: u64,
    pub note: String,
    pub updated_at: String,
    pub author: Option<String>,
}

fn get_thread_notes_path() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            return parent.join("gunnerius_thread_notes.json");
        }
    }
    std::path::PathBuf::from("gunnerius_thread_notes.json")
}

#[tauri::command]
pub fn get_thread_notes() -> Result<HashMap<String, ThreadNoteItem>, String> {
    let path = get_thread_notes_path();
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let map: HashMap<String, ThreadNoteItem> = serde_json::from_str(&content).unwrap_or_default();
    Ok(map)
}

#[tauri::command]
pub fn save_thread_note(thread_id: u64, note: String, author: Option<String>) -> Result<(), String> {
    let path = get_thread_notes_path();
    let mut map: HashMap<String, ThreadNoteItem> = if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    map.insert(thread_id.to_string(), ThreadNoteItem {
        thread_id,
        note,
        updated_at: format!("{} sn", now_ts),
        author,
    });

    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_thread_note(thread_id: u64) -> Result<(), String> {
    let path = get_thread_notes_path();
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    let mut map: HashMap<String, ThreadNoteItem> = serde_json::from_str(&content).unwrap_or_default();
    map.remove(&thread_id.to_string());
    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_ai_forum_report(report_type: String) -> Result<AIForumReport, String> {
    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    generate_ai_forum_report_internal(&base_url, &api_key, &report_type).await
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Geçersiz URL formatı".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = open::that(url);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_cloudflare_live_analytics() -> Result<crate::cloudflare::CFAnalyticsResponse, String> {
    let token = get_configured_cf_api_token();
    let zone_id = get_configured_cf_zone_id();
    let account_id = get_configured_r2_account_id();
    crate::cloudflare::fetch_cf_live_analytics(&token, &zone_id, &account_id).await
}

#[tauri::command]
pub async fn save_cloudflare_credentials(api_token: String, zone_id: String) -> Result<crate::cloudflare::CFAnalyticsResponse, String> {
    let t = api_token.trim().to_string();
    let z = zone_id.trim().to_string();
    if !t.is_empty() && !t.starts_with("•••") {
        save_secret("cloudflare_api_token", &t)?;
    }
    if !z.is_empty() {
        save_secret("cloudflare_zone_id", &z)?;
    }
    let actual_token = get_configured_cf_api_token();
    let actual_zone = get_configured_cf_zone_id();
    let account_id = get_configured_r2_account_id();
    crate::cloudflare::fetch_cf_live_analytics(&actual_token, &actual_zone, &account_id).await
}

#[tauri::command]
pub fn get_cloudflare_credentials_status() -> Result<(bool, String), String> {
    let token = get_configured_cf_api_token();
    let zone_id = get_configured_cf_zone_id();
    Ok((!token.is_empty(), zone_id))
}

#[tauri::command]
pub async fn get_forum_users(
    page: Option<u32>,
    search: Option<String>,
    filter_type: Option<String>,
    sort_by: Option<String>,
) -> Result<crate::users::UsersListResponse, String> {
    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    let p = page.unwrap_or(1);
    Ok(crate::users::fetch_forum_users(
        &base_url,
        &api_key,
        p,
        search.as_deref(),
        filter_type.as_deref(),
        sort_by.as_deref(),
    ).await)
}

#[tauri::command]
pub async fn get_suspicious_alerts() -> Result<Vec<crate::users::SuspiciousLogItem>, String> {
    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    Ok(crate::users::detect_live_suspicious_activities(&base_url, &api_key).await)
}

#[tauri::command]
pub fn resolve_suspicious_alert(alert_id: String, action: String) -> Result<bool, String> {
    Ok(crate::users::resolve_alert(&alert_id, &action))
}

#[tauri::command]
pub async fn get_suspicious_unresolved_count() -> Result<u32, String> {
    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    let alerts = crate::users::detect_live_suspicious_activities(&base_url, &api_key).await;
    Ok(alerts.iter().filter(|i| i.status == "unresolved").count() as u32)
}

#[tauri::command]
pub async fn execute_user_moderation(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    user_id: u64,
    action: String,
    reason: Option<String>,
) -> Result<crate::users::UserModerationResult, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Üye moderasyonu gerçekleştirmek için Yönetici oturumu zorunludur.".to_string());
    }

    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    Ok(crate::users::execute_user_moderation_action(
        &base_url,
        &api_key,
        user_id,
        &action,
        reason.as_deref(),
    ).await)
}

#[tauri::command]
pub async fn get_transfer_queue(
    state: tauri::State<'_, AppState>,
) -> Result<TransferQueueResponse, String> {
    let resp = state.transfer_manager.lock().await.get_response();
    Ok(resp)
}

#[tauri::command]
pub async fn add_remote_transfer(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    source_url: String,
    target_key: String,
    custom_name: Option<String>,
    app: tauri::AppHandle,
) -> Result<TransferJob, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Uzak aktarım başlatmak için Yönetici oturumu gereklidir.".to_string());
    }

    let creds = load_r2_creds_from_keyring()?;

    let res = add_transfer_job_internal(
        &state.transfer_manager,
        &creds,
        &source_url,
        &target_key,
        custom_name.as_deref(),
        Some(app),
    )
    .await;

    if let Ok(ref job) = res {
        let (user_id, username, _) = state.get_session_info(session_token.as_deref());
        let _ = crate::audit::record_audit_log_internal(
            Some(&creds),
            user_id,
            &username,
            "TRANSFER_START",
            Some(&target_key),
            &format!("Bulut aktarımı başlatıldı: {} ({}) -> {}", job.name, job.provider, target_key),
            "info",
        ).await;
    }

    res
}

#[tauri::command]
pub async fn pause_transfer_job(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    job_id: String,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: İşlem için Yönetici oturumu gereklidir.".to_string());
    }
    let ok = {
        let mut guard = state.transfer_manager.lock().await;
        guard.pause_job(&job_id)
    };
    emit_update(&state.transfer_manager, &Some(app)).await;
    Ok(ok)
}

#[tauri::command]
pub async fn resume_transfer_job(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    job_id: String,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: İşlem için Yönetici oturumu gereklidir.".to_string());
    }
    let ok = {
        let mut guard = state.transfer_manager.lock().await;
        guard.resume_job(&job_id)
    };
    emit_update(&state.transfer_manager, &Some(app)).await;
    Ok(ok)
}

#[tauri::command]
pub async fn cancel_transfer_job(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    job_id: String,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: İşlem için Yönetici oturumu gereklidir.".to_string());
    }
    let ok = {
        let mut guard = state.transfer_manager.lock().await;
        guard.cancel_job(&job_id)
    };
    emit_update(&state.transfer_manager, &Some(app)).await;
    Ok(ok)
}

#[tauri::command]
pub async fn clear_completed_transfers(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    app: tauri::AppHandle,
) -> Result<TransferQueueResponse, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: İşlem için Yönetici oturumu gereklidir.".to_string());
    }
    {
        let mut guard = state.transfer_manager.lock().await;
        guard.clear_completed();
    }
    emit_update(&state.transfer_manager, &Some(app)).await;
    let resp = state.transfer_manager.lock().await.get_response();
    Ok(resp)
}

#[tauri::command]
pub async fn remove_transfer_job(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    job_id: String,
    app: tauri::AppHandle,
) -> Result<TransferQueueResponse, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: İşlem için Yönetici oturumu gereklidir.".to_string());
    }
    {
        let mut guard = state.transfer_manager.lock().await;
        guard.remove_job(&job_id);
    }
    emit_update(&state.transfer_manager, &Some(app)).await;
    let resp = state.transfer_manager.lock().await.get_response();
    Ok(resp)
}

#[tauri::command]
pub async fn update_admin_heartbeat(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    current_page: String,
    current_action: String,
    avatar_color: Option<String>,
    avatar_emblem: Option<String>,
) -> Result<crate::admin_activity::AdminLiveSession, String> {
    let (user_id, username, role) = state.get_session_info(session_token.as_deref());
    let creds = load_r2_creds_from_keyring()?;
    let app_version = "0.2.16";

    crate::admin_activity::send_admin_heartbeat_internal(
        &creds,
        user_id,
        &username,
        &role,
        avatar_color,
        avatar_emblem,
        &current_page,
        &current_action,
        app_version,
    )
    .await
}

#[tauri::command]
pub async fn get_active_admins(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
) -> Result<Vec<crate::admin_activity::AdminLiveSession>, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Yönetici oturumu gereklidir.".to_string());
    }
    let creds = load_r2_creds_from_keyring()?;
    crate::admin_activity::get_active_admin_sessions_internal(&creds).await
}

#[tauri::command]
pub async fn record_audit_event(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    action_type: String,
    target: Option<String>,
    details: String,
    severity: Option<String>,
) -> Result<crate::audit::AuditLogEntry, String> {
    let (user_id, username, _role) = state.get_session_info(session_token.as_deref());
    let creds = load_r2_creds_from_keyring().ok();
    let sev = severity.unwrap_or_else(|| "info".to_string());

    crate::audit::record_audit_log_internal(
        creds.as_ref(),
        user_id,
        &username,
        &action_type,
        target.as_deref(),
        &details,
        &sev,
    )
    .await
}

#[tauri::command]
pub async fn get_audit_logs(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    limit: Option<usize>,
    date_filter: Option<String>,
    action_filter: Option<String>,
) -> Result<Vec<crate::audit::AuditLogEntry>, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Log kayıtlarını görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }
    let creds = load_r2_creds_from_keyring().ok();
    let l = limit.unwrap_or(150);

    crate::audit::get_audit_logs_internal(
        creds.as_ref(),
        l,
        date_filter.as_deref(),
        action_filter.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn generate_daily_ai_report(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    force_regenerate: Option<bool>,
) -> Result<crate::reports::DailyAIReport, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Günlük rapor oluşturmak için Yönetici oturumu gereklidir.".to_string());
    }
    let base_url = get_configured_forum_url();
    let api_key = get_configured_api_key();
    let creds = load_r2_creds_from_keyring().ok();
    let username = state.get_session_username(session_token.as_deref());

    crate::reports::generate_daily_ai_report_internal(
        &base_url,
        &api_key,
        creds.as_ref(),
        &username,
        force_regenerate.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn list_daily_ai_reports(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
) -> Result<Vec<crate::reports::DailyReportSummaryItem>, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Rapor listesini görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }
    let creds = load_r2_creds_from_keyring().ok();
    crate::reports::list_daily_reports_internal(creds.as_ref()).await
}

#[tauri::command]
pub async fn get_daily_ai_report_by_date(
    state: tauri::State<'_, AppState>,
    session_token: Option<String>,
    date_str: String,
) -> Result<crate::reports::DailyAIReport, String> {
    if !state.is_admin_session(session_token.as_deref()) {
        return Err("Yetkisiz Erişim: Rapor detayını görüntülemek için Yönetici oturumu gereklidir.".to_string());
    }
    let creds = load_r2_creds_from_keyring().ok();
    crate::reports::get_daily_report_by_date_internal(creds.as_ref(), &date_str).await
}

#[tauri::command]
pub fn get_cache_stats() -> Result<crate::diagnostics::CacheStatsResult, String> {
    crate::diagnostics::calculate_cache_stats()
}

#[tauri::command]
pub fn clear_app_cache() -> Result<crate::diagnostics::ClearCacheResult, String> {
    crate::diagnostics::purge_cache()
}

#[tauri::command]
pub async fn benchmark_network(
    forum_url: String,
    r2_domain: String,
) -> Result<crate::diagnostics::BenchmarkResult, String> {
    crate::diagnostics::run_network_benchmark(&forum_url, &r2_domain).await
}

#[tauri::command]
pub fn set_windows_autostart(enabled: bool) -> Result<bool, String> {
    crate::diagnostics::configure_windows_autostart(enabled)
}

#[tauri::command]
pub fn export_encrypted_settings(
    settings: AppSettings,
    password: String,
) -> Result<String, String> {
    let settings_json = serde_json::to_string(&settings).map_err(|e| format!("Ayarlar serileştirilemedi: {}", e))?;
    crate::diagnostics::encrypt_settings_payload(&password, &settings_json)
}

#[tauri::command]
pub fn import_encrypted_settings(
    password: String,
    payload: String,
) -> Result<AppSettings, String> {
    let decrypted_json = crate::diagnostics::decrypt_settings_payload(&password, &payload)?;
    serde_json::from_str(&decrypted_json).map_err(|e| format!("Ayarlar okunamadı: {}", e))
}

#[tauri::command]
pub fn calculate_file_hash(path: String) -> Result<crate::diagnostics::FileChecksumResult, String> {
    crate::diagnostics::compute_sha256(&path)
}

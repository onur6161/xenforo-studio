use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::r2::{create_r2_bucket, R2Credentials};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferJob {
    pub id: String,
    pub name: String,
    pub source_url: String,
    pub target_key: String,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub percentage: f32,
    pub speed_mbps: f32,
    pub eta_seconds: u64,
    pub status: String, // "queued", "running", "paused", "completed", "failed", "cancelled"
    #[serde(default = "default_provider")]
    pub provider: String, // "gdrive", "yandex", "mediafire", "direct"
    #[serde(default = "default_stage")]
    pub stage: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

fn default_provider() -> String {
    "direct".to_string()
}

fn default_stage() -> String {
    "Kuyrukta bekliyor...".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferQueueStats {
    pub active_count: usize,
    pub queued_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
    pub total_transferred_bytes: u64,
    pub current_bandwidth_mbps: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferQueueResponse {
    pub jobs: Vec<TransferJob>,
    pub stats: TransferQueueStats,
}

#[derive(Default)]
pub struct TransferManager {
    pub jobs: Vec<TransferJob>,
    pub cancel_tokens: HashMap<String, tokio::sync::watch::Sender<bool>>,
    pub pause_tokens: HashMap<String, tokio::sync::watch::Sender<bool>>,
}

impl TransferManager {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn pause_job(&mut self, job_id: &str) -> bool {
        if let Some(tx) = self.pause_tokens.get(job_id) {
            let _ = tx.send(true);
        }
        if let Some(j) = self.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = "paused".to_string();
            j.stage = "Duraklatıldı".to_string();
            j.speed_mbps = 0.0;
            return true;
        }
        false
    }

    pub fn resume_job(&mut self, job_id: &str) -> bool {
        if let Some(tx) = self.pause_tokens.get(job_id) {
            let _ = tx.send(false);
        }
        if let Some(j) = self.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = "running".to_string();
            j.stage = "Akış devam ediyor...".to_string();
            return true;
        }
        false
    }

    pub fn cancel_job(&mut self, job_id: &str) -> bool {
        if let Some(tx) = self.cancel_tokens.get(job_id) {
            let _ = tx.send(true);
        }
        if let Some(j) = self.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = "cancelled".to_string();
            j.stage = "İptal edildi".to_string();
            j.speed_mbps = 0.0;
            return true;
        }
        false
    }

    pub fn clear_completed(&mut self) {
        self.jobs.retain(|j| j.status == "running" || j.status == "verifying" || j.status == "queued" || j.status == "paused");
    }

    pub fn remove_job(&mut self, job_id: &str) -> bool {
        let prev_len = self.jobs.len();
        self.jobs.retain(|j| j.id != job_id);
        self.cancel_tokens.remove(job_id);
        self.pause_tokens.remove(job_id);
        self.jobs.len() < prev_len
    }

    pub fn get_response(&self) -> TransferQueueResponse {
        let mut active_count = 0;
        let mut queued_count = 0;
        let mut completed_count = 0;
        let mut failed_count = 0;
        let mut total_transferred_bytes: u64 = 0;
        let mut current_bandwidth_mbps: f32 = 0.0;

        for j in &self.jobs {
            match j.status.as_str() {
                "running" | "verifying" => {
                    active_count += 1;
                    current_bandwidth_mbps += j.speed_mbps;
                    total_transferred_bytes += j.transferred_bytes;
                }
                "queued" => {
                    queued_count += 1;
                }
                "completed" => {
                    completed_count += 1;
                    total_transferred_bytes += j.transferred_bytes;
                }
                "failed" => {
                    failed_count += 1;
                }
                _ => {}
            }
        }

        TransferQueueResponse {
            jobs: self.jobs.clone(),
            stats: TransferQueueStats {
                active_count,
                queued_count,
                completed_count,
                failed_count,
                total_transferred_bytes,
                current_bandwidth_mbps,
            },
        }
    }
}

pub type SharedTransferManager = Arc<Mutex<TransferManager>>;

/// Bağlantı sağlayıcısını URL'den tespit eder
pub fn detect_provider(url: &str) -> &'static str {
    let lower = url.to_lowercase();
    if lower.contains("drive.google.com")
        || lower.contains("docs.google.com")
        || lower.contains("usercontent.google.com")
        || lower.contains("googleusercontent.com")
    {
        "gdrive"
    } else if lower.contains("disk.yandex") || lower.contains("yadi.sk") {
        "yandex"
    } else if lower.contains("mediafire.com") {
        "mediafire"
    } else {
        "direct"
    }
}

#[derive(Debug)]
pub struct ResolvedStream {
    pub stream_url: String,
    pub filename: Option<String>,
    pub total_bytes: Option<u64>,
    #[allow(dead_code)]
    pub content_type: Option<String>,
    pub cookies: Option<String>,
}

/// Yeni bir uzak URL aktarımı ekler ve arka planda çalıştırmayı başlatır
pub async fn add_transfer_job_internal(
    manager: &SharedTransferManager,
    creds: &R2Credentials,
    source_url: &str,
    target_key: &str,
    custom_name: Option<&str>,
    app_handle: Option<tauri::AppHandle>,
) -> Result<TransferJob, String> {
    let clean_url = source_url.trim().to_string();
    if !clean_url.starts_with("http://") && !clean_url.starts_with("https://") {
        return Err("Geçerli bir http:// veya https:// indirme bağlantısı belirtilmelidir.".to_string());
    }

    let provider = detect_provider(&clean_url).to_string();

    // Geçici dosya adı
    let file_name = if let Some(cn) = custom_name.filter(|n| !n.trim().is_empty()) {
        cn.trim().to_string()
    } else {
        let base = clean_url
            .split('?')
            .next()
            .unwrap_or(&clean_url)
            .split('/')
            .last()
            .unwrap_or("dosya.bin");
        if base.is_empty() || base == "view" || base == "edit" {
            match provider.as_str() {
                "gdrive" => "Google_Drive_Dosyasi.bin".to_string(),
                "yandex" => "Yandex_Disk_Dosyasi.bin".to_string(),
                "mediafire" => "MediaFire_Dosyasi.bin".to_string(),
                _ => "indirilen_dosya.bin".to_string(),
            }
        } else {
            base.to_string()
        }
    };

    let effective_target_key = if target_key.ends_with('/') || target_key.is_empty() {
        format!("{}{}", target_key.trim_start_matches('/'), file_name)
    } else {
        target_key.trim_start_matches('/').to_string()
    };

    let job_id = uuid::Uuid::new_v4().to_string();
    let job = TransferJob {
        id: job_id.clone(),
        name: file_name,
        source_url: clean_url.clone(),
        target_key: effective_target_key.clone(),
        total_bytes: 0,
        transferred_bytes: 0,
        percentage: 0.0,
        speed_mbps: 0.0,
        eta_seconds: 0,
        status: "queued".to_string(),
        provider: provider.clone(),
        stage: "Kuyrukta bekliyor...".to_string(),
        error_message: None,
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        completed_at: None,
    };

    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
    let (pause_tx, pause_rx) = tokio::sync::watch::channel(false);

    {
        let mut guard = manager.lock().await;
        guard.jobs.insert(0, job.clone());
        guard.cancel_tokens.insert(job_id.clone(), cancel_tx);
        guard.pause_tokens.insert(job_id.clone(), pause_tx);
    }

    // Olay yayını yap
    if let Some(ref app) = app_handle {
        let resp = { manager.lock().await.get_response() };
        let _ = app.emit("transfer-queue-update", resp);
    }

    // Arka plan iş parçacığını başlat
    let m_clone = manager.clone();
    let creds_clone = creds.clone();
    let j_id_clone = job_id.clone();
    let app_clone = app_handle.clone();
    let custom_name_opt = custom_name.map(|s| s.to_string());

    tokio::spawn(async move {
        run_transfer_worker(
            m_clone,
            creds_clone,
            j_id_clone,
            clean_url,
            effective_target_key,
            custom_name_opt,
            cancel_rx,
            pause_rx,
            app_clone,
        )
        .await;
    });

    Ok(job)
}

/// Google Drive dosya ID'sini bağlantıdan çıkarır
fn extract_gdrive_id(url: &str) -> Option<String> {
    if let Some(pos) = url.find("/file/d/") {
        let rem = &url[pos + 8..];
        let id = rem.split('/').next()?.split('?').next()?;
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    if let Some(pos) = url.find("id=") {
        let rem = &url[pos + 3..];
        let id = rem.split('&').next()?.split('#').next()?;
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    None
}

/// Google Drive doğrudan indirme bağlantısını çözer (Virüs uyarısı bypass dahil)
async fn resolve_gdrive(client: &reqwest::Client, url: &str) -> Result<ResolvedStream, String> {
    let file_id = extract_gdrive_id(url)
        .ok_or_else(|| "Google Drive dosya kimliği (ID) bağlantıdan okunamadı.".to_string())?;

    // Eğer kullanıcı zaten drive.usercontent.google.com veya export=download verdiyse o URL'yi kullan,
    // yoksa standart direct URL oluştur:
    let initial_url = if url.contains("export=download") && (url.contains("usercontent.google.com") || url.contains("drive.google.com/uc")) {
        url.to_string()
    } else {
        format!("https://drive.usercontent.google.com/download?id={}&export=download&authuser=0", file_id)
    };

    let res = client
        .get(&initial_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("Google Drive bağlantı hatası: {}", e))?;

    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let mut cookies_vec = Vec::new();
    for val in res.headers().get_all(reqwest::header::SET_COOKIE) {
        if let Ok(s) = val.to_str() {
            if let Some(cookie_part) = s.split(';').next() {
                cookies_vec.push(cookie_part.to_string());
            }
        }
    }
    let cookie_header = cookies_vec.join("; ");

    // Eğer doğrudan dosya indiyse (küçük dosyalar)
    if !content_type.contains("text/html") {
        let filename = extract_filename_from_headers(res.headers());
        let total_bytes = res.content_length();
        let final_url = res.url().to_string();
        return Ok(ResolvedStream {
            stream_url: final_url,
            filename,
            total_bytes,
            content_type: Some(content_type),
            cookies: if cookie_header.is_empty() { None } else { Some(cookie_header) },
        });
    }

    // HTML döndüyse büyük dosya virüs onay sayfasıdır
    let body_text = res.text().await.map_err(|e| format!("Google Drive yanıt metni okunamadı: {}", e))?;

    // HTML'den orijinal dosya adını ayıkla: <span class="uc-name-size"><a ...>Mekan2 Güncell.rar</a> (2.0G)</span>
    let mut html_filename = None;
    if let Some(pos) = body_text.find("class=\"uc-name-size\"") {
        let rem = &body_text[pos..];
        if let Some(a_pos) = rem.find("<a ") {
            let a_rem = &rem[a_pos..];
            if let Some(tag_end) = a_rem.find('>') {
                let text_rem = &a_rem[tag_end + 1..];
                if let Some(end_a) = text_rem.find("</a>") {
                    let fn_candidate = text_rem[..end_a].trim();
                    if !fn_candidate.is_empty() {
                        html_filename = Some(clean_filename(fn_candidate));
                    }
                }
            }
        }
    }

    // Modern Google Drive formunu ve tüm input parametrelerini (uuid, confirm, id, export, authuser) ayıkla:
    let mut form_action = "https://drive.usercontent.google.com/download".to_string();
    let mut form_params: Vec<(String, String)> = Vec::new();

    if let Some(form_pos) = body_text.find("id=\"download-form\"") {
        let form_snippet = &body_text[form_pos..];
        let form_end = form_snippet.find("</form>").unwrap_or(form_snippet.len().min(3000));
        let form_content = &form_snippet[..form_end];

        if let Some(action_pos) = form_content.find("action=\"") {
            let action_rem = &form_content[action_pos + 8..];
            if let Some(end_q) = action_rem.find('"') {
                form_action = action_rem[..end_q].replace("&amp;", "&").to_string();
            }
        }

        let mut search_pos = 0;
        while let Some(input_pos) = form_content[search_pos..].find("<input ") {
            let abs_input_pos = search_pos + input_pos;
            let input_snippet = &form_content[abs_input_pos..];
            let tag_end = input_snippet.find('>').unwrap_or(input_snippet.len().min(200));
            let tag = &input_snippet[..tag_end];

            let mut name = String::new();
            let mut val = String::new();

            if let Some(n_pos) = tag.find("name=\"") {
                let n_rem = &tag[n_pos + 6..];
                if let Some(q) = n_rem.find('"') {
                    name = n_rem[..q].to_string();
                }
            }
            if let Some(v_pos) = tag.find("value=\"") {
                let v_rem = &tag[v_pos + 7..];
                if let Some(q) = v_rem.find('"') {
                    val = v_rem[..q].to_string();
                }
            }

            if !name.is_empty() {
                form_params.push((name, val));
            }

            search_pos = abs_input_pos + tag_end + 1;
            if search_pos >= form_content.len() {
                break;
            }
        }
    }

    let target_download_url = if !form_params.is_empty() {
        let query_str = form_params
            .into_iter()
            .map(|(k, v)| format!("{}={}", urlencoding_simple(&k), urlencoding_simple(&v)))
            .collect::<Vec<_>>()
            .join("&");
        format!("{}?{}", form_action, query_str)
    } else {
        // Fallback: confirm ve uuid ara
        let mut confirm_token = "t".to_string();
        if let Some(pos) = body_text.find("confirm=") {
            let rem = &body_text[pos + 8..];
            let token = rem
                .split('&')
                .next()
                .unwrap_or("")
                .split('"')
                .next()
                .unwrap_or("")
                .split('\'')
                .next()
                .unwrap_or("");
            if !token.is_empty() {
                confirm_token = token.to_string();
            }
        }
        let mut uuid_param = String::new();
        if let Some(pos) = body_text.find("uuid=") {
            let rem = &body_text[pos + 5..];
            let u = rem
                .split('&')
                .next()
                .unwrap_or("")
                .split('"')
                .next()
                .unwrap_or("")
                .split('\'')
                .next()
                .unwrap_or("");
            if !u.is_empty() {
                uuid_param = format!("&uuid={}", u);
            }
        }
        format!(
            "https://drive.usercontent.google.com/download?id={}&export=download&authuser=0&confirm={}{}",
            file_id, confirm_token, uuid_param
        )
    };

    let mut req = client.get(&target_download_url).header(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    if !cookie_header.is_empty() {
        req = req.header("Cookie", &cookie_header);
    }
    let second_res = req.send().await.map_err(|e| format!("Google Drive onay isteği hatası: {}", e))?;
    let second_ct = second_res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if second_ct.contains("text/html") {
        return Err("Google Drive indirme kotası aşılmış veya dosya genel paylaşıma kapatılmış.".to_string());
    }

    let filename = extract_filename_from_headers(second_res.headers()).or(html_filename);
    let total_bytes = second_res.content_length();
    let final_url = second_res.url().to_string();

    Ok(ResolvedStream {
        stream_url: final_url,
        filename,
        total_bytes,
        content_type: Some(second_ct),
        cookies: if cookie_header.is_empty() { None } else { Some(cookie_header) },
    })
}

/// Yandex Disk resmi API'si üzerinden doğrudan indirme bağlantısını çözer
async fn resolve_yandex(client: &reqwest::Client, url: &str) -> Result<ResolvedStream, String> {
    let encoded_url: String = urlencoding_simple(url);
    let api_url = format!(
        "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key={}",
        encoded_url
    );

    let res = client
        .get(&api_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GunneriusStudio/0.2.10")
        .send()
        .await
        .map_err(|e| format!("Yandex Disk API bağlantı hatası: {}", e))?;

    if !res.status().is_success() {
        return Err(format!(
            "Yandex Disk dosyayı bulamadı veya indirme izni kapalı (HTTP {})",
            res.status()
        ));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Yandex Disk API yanıtı çözülemedi: {}", e))?;
    let download_href = json["href"]
        .as_str()
        .ok_or_else(|| "Yandex Disk indirme bağlantısı API yanıtında bulunamadı.".to_string())?
        .to_string();

    let meta_url = format!(
        "https://cloud-api.yandex.net/v1/disk/public/resources?public_key={}",
        encoded_url
    );
    let mut filename = None;
    let mut total_bytes = None;
    if let Ok(meta_res) = client.get(&meta_url).send().await {
        if let Ok(meta_json) = meta_res.json::<serde_json::Value>().await {
            if let Some(name) = meta_json["name"].as_str() {
                filename = Some(name.to_string());
            }
            if let Some(size) = meta_json["size"].as_u64() {
                total_bytes = Some(size);
            }
        }
    }

    Ok(ResolvedStream {
        stream_url: download_href,
        filename,
        total_bytes,
        content_type: None,
        cookies: None,
    })
}

/// MediaFire web sayfasından doğrudan indirme URL'sini ayıklar
async fn resolve_mediafire(client: &reqwest::Client, url: &str) -> Result<ResolvedStream, String> {
    let res = client
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("MediaFire sayfasına erişilemedi: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("MediaFire sayfası açılamadı (HTTP {})", res.status()));
    }

    let html = res.text().await.map_err(|e| format!("MediaFire sayfa içeriği okunamadı: {}", e))?;

    let mut download_url = None;

    if let Some(pos) = html.find("id=\"downloadButton\"") {
        let snippet = &html[pos..html.len().min(pos + 400)];
        if let Some(href_pos) = snippet.find("href=\"") {
            let rem = &snippet[href_pos + 6..];
            if let Some(end_pos) = rem.find('"') {
                let raw_url = &rem[..end_pos];
                if raw_url.starts_with("http") {
                    download_url = Some(raw_url.to_string());
                }
            }
        }
    }

    if download_url.is_none() {
        if let Some(pos) = html.find("https://download") {
            let rem = &html[pos..];
            if let Some(end_pos) = rem.find('"').or_else(|| rem.find('\'')) {
                let candidate = &rem[..end_pos];
                if candidate.contains(".mediafire.com/") {
                    download_url = Some(candidate.to_string());
                }
            }
        }
    }

    let final_dl_url = download_url.ok_or_else(|| {
        "MediaFire indirme butonu bulunamadı. Dosya silinmiş veya link geçersiz olabilir.".to_string()
    })?;

    let filename = final_dl_url
        .split('?')
        .next()
        .and_then(|u| u.split('/').last())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    Ok(ResolvedStream {
        stream_url: final_dl_url,
        filename,
        total_bytes: None,
        content_type: None,
        cookies: None,
    })
}

/// HTTP Header'larından dosya adını çeker
fn extract_filename_from_headers(headers: &reqwest::header::HeaderMap) -> Option<String> {
    if let Some(cd) = headers.get(reqwest::header::CONTENT_DISPOSITION) {
        if let Ok(cd_str) = cd.to_str() {
            if let Some(pos) = cd_str.find("filename*=") {
                let rem = &cd_str[pos + 10..];
                let enc = rem.split(';').next().unwrap_or("").trim().trim_matches('"');
                if let Some(utf_pos) = enc.find("''") {
                    let encoded_name = &enc[utf_pos + 2..];
                    if let Ok(decoded) = percent_encoding_decode(encoded_name) {
                        return Some(clean_filename(&decoded));
                    }
                }
            }
            if let Some(pos) = cd_str.find("filename=") {
                let rem = &cd_str[pos + 9..];
                let name = rem.split(';').next().unwrap_or("").trim().trim_matches('"');
                if !name.is_empty() {
                    return Some(clean_filename(name));
                }
            }
        }
    }
    None
}

fn clean_filename(name: &str) -> String {
    name.replace('/', "_")
        .replace('\\', "_")
        .replace(':', "_")
        .replace('*', "_")
        .replace('?', "_")
        .replace('"', "_")
        .replace('<', "_")
        .replace('>', "_")
        .replace('|', "_")
        .trim()
        .to_string()
}

fn urlencoding_simple(s: &str) -> String {
    let mut encoded = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

fn percent_encoding_decode(s: &str) -> Result<String, ()> {
    let mut bytes = Vec::new();
    let mut chars = s.chars();
    while let Some(ch) = chars.next() {
        if ch == '%' {
            let h1 = chars.next().ok_or(())?;
            let h2 = chars.next().ok_or(())?;
            let hex_str = format!("{}{}", h1, h2);
            let byte = u8::from_str_radix(&hex_str, 16).map_err(|_| ())?;
            bytes.push(byte);
        } else {
            bytes.push(ch as u8);
        }
    }
    String::from_utf8(bytes).map_err(|_| ())
}

/// Arka planda çalışan akıllı aktarım iş parçacığı
#[allow(clippy::too_many_arguments)]
async fn run_transfer_worker(
    manager: SharedTransferManager,
    creds: R2Credentials,
    job_id: String,
    source_url: String,
    mut target_key: String,
    custom_name: Option<String>,
    cancel_rx: tokio::sync::watch::Receiver<bool>,
    pause_rx: tokio::sync::watch::Receiver<bool>,
    app_handle: Option<tauri::AppHandle>,
) {
    let provider = detect_provider(&source_url);

    // 1. Durumu running yap ve Aşama 1 başlat
    let initial_stage = match provider {
        "gdrive" => "[1/3] 🔍 Google Drive bağlantısı ve büyük dosya onayı çözümleniyor...",
        "yandex" => "[1/3] 🔍 Yandex Disk resmi CDN bağlantısı çözümleniyor...",
        "mediafire" => "[1/3] 🔍 MediaFire doğrudan indirme bağlantısı ayıklanıyor...",
        _ => "[1/3] 🔍 Uzak indirme bağlantısı doğrulanıyor...",
    };

    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = "running".to_string();
            j.stage = initial_stage.to_string();
            j.provider = provider.to_string();
        }
    }
    emit_update(&manager, &app_handle).await;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) GunneriusStudio/0.2.10")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .unwrap_or_default();

    // 2. ÇÖZÜMLEME AŞAMASI (RESOLVER)
    let resolved_result = match provider {
        "gdrive" => resolve_gdrive(&client, &source_url).await,
        "yandex" => resolve_yandex(&client, &source_url).await,
        "mediafire" => resolve_mediafire(&client, &source_url).await,
        _ => Ok(ResolvedStream {
            stream_url: source_url.clone(),
            filename: None,
            total_bytes: None,
            content_type: None,
            cookies: None,
        }),
    };

    let resolved = match resolved_result {
        Ok(r) => r,
        Err(err_msg) => {
            mark_failed(&manager, &job_id, &err_msg, &app_handle).await;
            return;
        }
    };

    // Dosya adını ve R2 hedef anahtarını güncelle (Eğer kullanıcı özel isim girmedisye)
    if custom_name.is_none() {
        if let Some(ref real_fn) = resolved.filename {
            let folder_part = if let Some(slash_pos) = target_key.rfind('/') {
                &target_key[..=slash_pos]
            } else {
                ""
            };
            target_key = format!("{}{}", folder_part, real_fn);

            let mut guard = manager.lock().await;
            if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
                j.name = real_fn.clone();
                j.target_key = target_key.clone();
            }
        }
    }

    // Aşama 2: Bağlantı kuruluyor
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.stage = "[2/3] ⚡ Uzak veri akışı kuruluyor ve boyut doğrulanıyor...".to_string();
            if let Some(tb) = resolved.total_bytes {
                j.total_bytes = tb;
            }
        }
    }
    emit_update(&manager, &app_handle).await;

    // Gerçek akış isteğini başlat
    let mut get_req = client.get(&resolved.stream_url);
    if let Some(ref cks) = resolved.cookies {
        get_req = get_req.header("Cookie", cks);
    }
    get_req = get_req.header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GunneriusStudio/0.2.10");

    let get_resp = match get_req.send().await {
        Ok(r) => {
            if !r.status().is_success() {
                mark_failed(
                    &manager,
                    &job_id,
                    &format!("Uzak sunucu HTTP hatası döndürdü: {}", r.status()),
                    &app_handle,
                )
                .await;
                return;
            }
            r
        }
        Err(e) => {
            mark_failed(
                &manager,
                &job_id,
                &format!("Uzak sunucuya bağlanılamadı: {}", e),
                &app_handle,
            )
            .await;
            return;
        }
    };

    // ANTİ-FAKE / HTML KORUMA KALKANI:
    // Eğer gelen yanıt text/html içeriyorsa, bu bir dosya değil web sayfasıdır!
    let resp_content_type = get_resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    if resp_content_type.contains("text/html") {
        mark_failed(
            &manager,
            &job_id,
            "Hata: Bu bağlantı fiziksel bir dosya yerine web sayfası döndürdü. Dosya silinmiş, gizli veya şifreli olabilir.",
            &app_handle,
        )
        .await;
        return;
    }

    // Toplam dosya boyutunu belirle
    let mut total_length: u64 = resolved.total_bytes.unwrap_or(0);
    if total_length == 0 {
        if let Some(len) = get_resp.content_length() {
            total_length = len;
        }
    }

    // Eğer Content-Disposition'dan dosya adı ilk seferde gelmediyse şimdi tekrar kontrol et
    if custom_name.is_none() {
        if let Some(cd_fn) = extract_filename_from_headers(get_resp.headers()) {
            let folder_part = if let Some(slash_pos) = target_key.rfind('/') {
                &target_key[..=slash_pos]
            } else {
                ""
            };
            target_key = format!("{}{}", folder_part, cd_fn);

            let mut guard = manager.lock().await;
            if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
                j.name = cd_fn.clone();
                j.target_key = target_key.clone();
            }
        }
    }

    // R2 Bucket oluştur
    let bucket = match create_r2_bucket(&creds) {
        Ok(b) => b,
        Err(e) => {
            mark_failed(&manager, &job_id, &format!("R2 Depolama hatası: {}", e), &app_handle).await;
            return;
        }
    };

    // Aşama 3: S3 Multipart Akışı Başlatıldı
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.total_bytes = total_length;
            j.stage = "[3/3] 🚀 Cloudflare R2'ye S3 bellek akışı ile aktarılıyor...".to_string();
        }
    }
    emit_update(&manager, &app_handle).await;

    let start_time = Instant::now();
    let mut transferred: u64 = 0;
    let mut last_emit = Instant::now();

    // 15 MB'tan küçükse tek seferde yükle
    if total_length > 0 && total_length < 15 * 1024 * 1024 {
        match get_resp.bytes().await {
            Ok(bytes) => {
                let put_res = bucket
                    .put_object_with_content_type(&target_key, &bytes, &resp_content_type)
                    .await;
                if let Err(e) = put_res {
                    mark_failed(&manager, &job_id, &format!("R2'ye aktarılamadı: {}", e), &app_handle).await;
                    return;
                }
                transferred = bytes.len() as u64;
            }
            Err(e) => {
                mark_failed(&manager, &job_id, &format!("Veri okunamadı: {}", e), &app_handle).await;
                return;
            }
        }
    } else {
        // Büyük Dosyalar İçin S3 Multipart Akışı (Stream to Multipart)
        let init_res = match bucket.initiate_multipart_upload(&target_key, &resp_content_type).await {
            Ok(r) => r,
            Err(e) => {
                mark_failed(&manager, &job_id, &format!("Multipart başlatılamadı: {}", e), &app_handle).await;
                return;
            }
        };

        let upload_id = init_res.upload_id;
        let chunk_size = 16 * 1024 * 1024; // 16 MB tampon
        let mut current_buffer = Vec::with_capacity(chunk_size);
        let mut part_number = 1u32;
        let mut parts_uploaded: Vec<s3::serde_types::Part> = Vec::new();

        use futures_util::StreamExt;
        let mut stream = get_resp.bytes_stream();

        while let Some(chunk_res) = stream.next().await {
            // İptal kontrolü
            if *cancel_rx.borrow() {
                let _ = bucket.abort_upload(&target_key, &upload_id).await;
                mark_status(&manager, &job_id, "cancelled", None, "İptal edildi", &app_handle).await;
                return;
            }

            // Duraklatma kontrolü
            while *pause_rx.borrow() {
                mark_status(&manager, &job_id, "paused", None, "Duraklatıldı", &app_handle).await;
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }

            let chunk = match chunk_res {
                Ok(c) => c,
                Err(e) => {
                    let _ = bucket.abort_upload(&target_key, &upload_id).await;
                    mark_failed(&manager, &job_id, &format!("Akış kesildi: {}", e), &app_handle).await;
                    return;
                }
            };

            current_buffer.extend_from_slice(&chunk);
            transferred += chunk.len() as u64;

            // Tampon 16 MB'a ulaştığında TAM OLARAK 16 MB'lık parçalar halinde R2'ye yükle (Cloudflare R2 kuralı)
            while current_buffer.len() >= chunk_size {
                let chunk_data: Vec<u8> = current_buffer.drain(..chunk_size).collect();
                let put_res = bucket
                    .put_multipart_chunk(chunk_data, &target_key, part_number, &upload_id, &resp_content_type)
                    .await;

                match put_res {
                    Ok(part) => {
                        parts_uploaded.push(part);
                        part_number += 1;
                    }
                    Err(e) => {
                        let _ = bucket.abort_upload(&target_key, &upload_id).await;
                        mark_failed(&manager, &job_id, &format!("S3 Parça yükleme hatası: {}", e), &app_handle).await;
                        return;
                    }
                }
            }

            // Periyodik olarak ilerlemeyi arayüze yay (her 250 ms)
            if last_emit.elapsed().as_millis() > 250 {
                last_emit = Instant::now();
                let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.01);
                let speed_mbps = ((transferred as f64 / (1024.0 * 1024.0)) / elapsed_secs) as f32;
                let percentage = if total_length > 0 {
                    ((transferred as f64 / total_length as f64) * 100.0) as f32
                } else {
                    50.0
                };
                let eta_seconds = if speed_mbps > 0.05 && total_length > transferred {
                    let remaining_mb = (total_length - transferred) as f64 / (1024.0 * 1024.0);
                    (remaining_mb / speed_mbps as f64) as u64
                } else {
                    0
                };

                let stage_str = format!(
                    "[3/3] 🚀 R2'ye yazılıyor: %{:.1} ({:.1} MB/s)",
                    percentage, speed_mbps
                );

                {
                    let mut guard = manager.lock().await;
                    if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
                        j.transferred_bytes = transferred;
                        j.percentage = percentage;
                        j.speed_mbps = speed_mbps;
                        j.eta_seconds = eta_seconds;
                        j.stage = stage_str;
                    }
                }
                emit_update(&manager, &app_handle).await;
            }
        }

        // Kalan son parçayı (trailing part) yükle
        if !current_buffer.is_empty() {
            let chunk_data = std::mem::take(&mut current_buffer);
            let put_res = bucket
                .put_multipart_chunk(chunk_data, &target_key, part_number, &upload_id, &resp_content_type)
                .await;

            match put_res {
                Ok(part) => {
                    parts_uploaded.push(part);
                }
                Err(e) => {
                    let _ = bucket.abort_upload(&target_key, &upload_id).await;
                    mark_failed(&manager, &job_id, &format!("Son parça yüklenemedi: {}", e), &app_handle).await;
                    return;
                }
            }
        }

        // Parçaların part_number sırasına göre dizildiğinden emin ol
        parts_uploaded.sort_by_key(|p| p.part_number);

        // AŞAMA: CF Tarafında Kontrol Ediliyor
        {
            let mut guard = manager.lock().await;
            if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
                j.stage = "☁️ CF Tarafında Kontrol Ediliyor...".to_string();
                j.status = "verifying".to_string();
                j.percentage = 100.0;
                j.speed_mbps = 0.0;
                j.eta_seconds = 0;
            }
        }
        emit_update(&manager, &app_handle).await;

        // Multipart Yüklemeyi Mühürle / Tamamla
        let complete_res = bucket
            .complete_multipart_upload(&target_key, &upload_id, parts_uploaded)
            .await;

        match complete_res {
            Ok(resp) => {
                if !(200..300).contains(&resp.status_code()) {
                    let body_err = resp.as_str().unwrap_or("Bilinmeyen XML yanıtı");
                    let _ = bucket.abort_upload(&target_key, &upload_id).await;
                    mark_failed(
                        &manager,
                        &job_id,
                        &format!("Cloudflare R2 onay reddi (HTTP {}): {}", resp.status_code(), body_err),
                        &app_handle,
                    )
                    .await;
                    return;
                }
            }
            Err(e) => {
                let _ = bucket.abort_upload(&target_key, &upload_id).await;
                mark_failed(
                    &manager,
                    &job_id,
                    &format!("Cloudflare R2 mühürleme bağlantı hatası: {}", e),
                    &app_handle,
                )
                .await;
                return;
            }
        }
    }

    // AŞAMA: Fiziksel Dosya Varlığı Doğrulaması (Cloudflare R2 Head Object)
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.stage = "☁️ CF Tarafında Kontrol Ediliyor...".to_string();
            j.status = "verifying".to_string();
        }
    }
    emit_update(&manager, &app_handle).await;

    let head_check = bucket.head_object(&target_key).await;
    let verified_size = match head_check {
        Ok((head_data, status)) if (200..300).contains(&status) => {
            head_data.content_length.filter(|&l| l > 0).map(|l| l as u64).unwrap_or(transferred)
        }
        Ok((_, status)) => {
            mark_failed(
                &manager,
                &job_id,
                &format!("Cloudflare R2'de dosya doğrulanamadı (HTTP {})", status),
                &app_handle,
            )
            .await;
            return;
        }
        Err(e) => {
            mark_failed(
                &manager,
                &job_id,
                &format!("Cloudflare R2 fiziksel kontrol hatası: {}", e),
                &app_handle,
            )
            .await;
            return;
        }
    };

    let elapsed_total_secs = start_time.elapsed().as_secs();
    let elapsed_formatted = if elapsed_total_secs >= 60 {
        format!("{} dk {} sn", elapsed_total_secs / 60, elapsed_total_secs % 60)
    } else {
        format!("{} sn", elapsed_total_secs)
    };

    // Tamamlandı olarak işaretle (Geçen süre bilgisi ile)
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.transferred_bytes = verified_size;
            j.total_bytes = verified_size;
            j.percentage = 100.0;
            j.speed_mbps = 0.0;
            j.eta_seconds = 0;
            j.status = "completed".to_string();
            j.stage = format!("✅ Tamamlandı • Geçen Süre: {}", elapsed_formatted);
            j.completed_at = Some(Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
        }
    }
    emit_update(&manager, &app_handle).await;
}

async fn mark_failed(
    manager: &SharedTransferManager,
    job_id: &str,
    error: &str,
    app_handle: &Option<tauri::AppHandle>,
) {
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = "failed".to_string();
            j.stage = "❌ Başarısız".to_string();
            j.error_message = Some(error.to_string());
            j.speed_mbps = 0.0;
        }
    }
    emit_update(manager, app_handle).await;
}

async fn mark_status(
    manager: &SharedTransferManager,
    job_id: &str,
    status: &str,
    error: Option<String>,
    stage: &str,
    app_handle: &Option<tauri::AppHandle>,
) {
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = status.to_string();
            j.stage = stage.to_string();
            if let Some(e) = error {
                j.error_message = Some(e);
            }
        }
    }
    emit_update(manager, app_handle).await;
}

pub async fn emit_update(manager: &SharedTransferManager, app_handle: &Option<tauri::AppHandle>) {
    if let Some(app) = app_handle {
        let resp = { manager.lock().await.get_response() };
        let _ = app.emit("transfer-queue-update", resp);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gdrive_resolve() {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .unwrap();
        let url = "https://drive.usercontent.google.com/download?id=1QhLQL4moft-1sokSYwSd6h8Gd6_Hri-q&export=download&authuser=0";
        let res = resolve_gdrive(&client, url).await;
        assert!(res.is_ok(), "Drive resolve failed: {:?}", res.err());
        let stream = res.unwrap();
        assert_eq!(stream.filename.as_deref(), Some("Mekan2 Güncell.rar"));
        assert!(stream.total_bytes.unwrap_or(0) > 2_000_000_000);
    }
}


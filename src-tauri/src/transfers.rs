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
    pub error_message: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
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
            j.speed_mbps = 0.0;
            return true;
        }
        false
    }

    pub fn clear_completed(&mut self) {
        self.jobs.retain(|j| j.status == "running" || j.status == "queued" || j.status == "paused");
    }

    pub fn get_response(&self) -> TransferQueueResponse {
        let mut active_count = 0;
        let mut queued_count = 0;
        let mut completed_count = 0;
        let mut failed_count = 0;
        let mut total_transferred = 0u64;
        let mut total_speed = 0.0f32;

        for j in &self.jobs {
            match j.status.as_str() {
                "running" => {
                    active_count += 1;
                    total_speed += j.speed_mbps;
                }
                "queued" => queued_count += 1,
                "completed" => {
                    completed_count += 1;
                    total_transferred += j.total_bytes;
                }
                "failed" => failed_count += 1,
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
                total_transferred_bytes: total_transferred,
                current_bandwidth_mbps: total_speed,
            },
        }
    }
}

pub type SharedTransferManager = Arc<Mutex<TransferManager>>;

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

    // Dosya adını belirle
    let file_name = if let Some(cn) = custom_name.filter(|n| !n.trim().is_empty()) {
        cn.trim().to_string()
    } else {
        clean_url
            .split('?')
            .next()
            .unwrap_or(&clean_url)
            .split('/')
            .last()
            .unwrap_or("dosya.bin")
            .to_string()
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

    tokio::spawn(async move {
        run_transfer_worker(
            m_clone,
            creds_clone,
            j_id_clone,
            clean_url,
            effective_target_key,
            cancel_rx,
            pause_rx,
            app_clone,
        )
        .await;
    });

    Ok(job)
}

/// Arka planda çalışan aktarım iş parçacığı
#[allow(clippy::too_many_arguments)]
async fn run_transfer_worker(
    manager: SharedTransferManager,
    creds: R2Credentials,
    job_id: String,
    source_url: String,
    target_key: String,
    cancel_rx: tokio::sync::watch::Receiver<bool>,
    pause_rx: tokio::sync::watch::Receiver<bool>,
    app_handle: Option<tauri::AppHandle>,
) {
    // 1. Durumu running yap
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = "running".to_string();
        }
    }
    emit_update(&manager, &app_handle).await;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) GunneriusStudio/0.2.5")
        .build()
        .unwrap_or_default();

    // 2. Uzak bağlantıyı sorgula (HEAD / Range kontrolü)
    let head_res = client.head(&source_url).send().await;
    let mut total_length: u64 = 0;
    let mut content_type = "application/octet-stream".to_string();

    if let Ok(resp) = head_res {
        if resp.status().is_success() {
            if let Some(len) = resp.content_length() {
                total_length = len;
            }
            if let Some(ct) = resp.headers().get(reqwest::header::CONTENT_TYPE) {
                if let Ok(cts) = ct.to_str() {
                    content_type = cts.to_string();
                }
            }
        }
    }

    // Eğer HEAD vermediyse GET başlat
    let get_resp = match client.get(&source_url).send().await {
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
            if total_length == 0 {
                if let Some(len) = r.content_length() {
                    total_length = len;
                }
            }
            r
        }
        Err(e) => {
            mark_failed(&manager, &job_id, &format!("Bağlantı kurulamadı: {}", e), &app_handle).await;
            return;
        }
    };

    // Toplam boyutu güncelle
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.total_bytes = total_length;
        }
    }
    emit_update(&manager, &app_handle).await;

    // R2 Bucket oluştur
    let bucket = match create_r2_bucket(&creds) {
        Ok(b) => b,
        Err(e) => {
            mark_failed(&manager, &job_id, &format!("R2 Depolama hatası: {}", e), &app_handle).await;
            return;
        }
    };

    let start_time = Instant::now();
    let mut transferred: u64 = 0;
    let mut last_emit = Instant::now();

    // 15 MB'tan küçükse tek seferde yükle
    if total_length > 0 && total_length < 15 * 1024 * 1024 {
        match get_resp.bytes().await {
            Ok(bytes) => {
                let put_res = bucket
                    .put_object_with_content_type(&target_key, &bytes, &content_type)
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
        let init_res = match bucket.initiate_multipart_upload(&target_key, &content_type).await {
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
                mark_status(&manager, &job_id, "cancelled", None, &app_handle).await;
                return;
            }

            // Duraklatma kontrolü
            while *pause_rx.borrow() {
                mark_status(&manager, &job_id, "paused", None, &app_handle).await;
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

            // Tampon 16 MB dolduğunda R2'ye yükle
            if current_buffer.len() >= chunk_size {
                let chunk_data = std::mem::take(&mut current_buffer);
                let put_res = bucket
                    .put_multipart_chunk(chunk_data, &target_key, part_number, &upload_id, &content_type)
                    .await;

                match put_res {
                    Ok(part) => {
                        parts_uploaded.push(part);
                        part_number += 1;
                        current_buffer = Vec::with_capacity(chunk_size);
                    }
                    Err(e) => {
                        let _ = bucket.abort_upload(&target_key, &upload_id).await;
                        mark_failed(&manager, &job_id, &format!("S3 Parça yükleme hatası: {}", e), &app_handle).await;
                        return;
                    }
                }
            }

            // Periyodik olarak ilerlemeyi arayüze yay
            if last_emit.elapsed().as_millis() > 300 {
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

                {
                    let mut guard = manager.lock().await;
                    if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
                        j.transferred_bytes = transferred;
                        j.percentage = percentage;
                        j.speed_mbps = speed_mbps;
                        j.eta_seconds = eta_seconds;
                    }
                }
                emit_update(&manager, &app_handle).await;
            }
        }

        // Kalan son tamponu yükle
        if !current_buffer.is_empty() {
            let chunk_data = std::mem::take(&mut current_buffer);
            let put_res = bucket
                .put_multipart_chunk(chunk_data, &target_key, part_number, &upload_id, &content_type)
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

        // Multipart Yüklemeyi Mühürle / Tamamla
        let complete_res = bucket
            .complete_multipart_upload(&target_key, &upload_id, parts_uploaded)
            .await;

        if let Err(e) = complete_res {
            mark_failed(&manager, &job_id, &format!("Multipart mühürleme hatası: {}", e), &app_handle).await;
            return;
        }
    }

    // Tamamlandı olarak işaretle
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.transferred_bytes = if total_length > 0 { total_length } else { transferred };
            j.total_bytes = if total_length > 0 { total_length } else { transferred };
            j.percentage = 100.0;
            j.speed_mbps = 0.0;
            j.eta_seconds = 0;
            j.status = "completed".to_string();
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
    app_handle: &Option<tauri::AppHandle>,
) {
    {
        let mut guard = manager.lock().await;
        if let Some(j) = guard.jobs.iter_mut().find(|x| x.id == job_id) {
            j.status = status.to_string();
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

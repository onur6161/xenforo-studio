mod cloudflare;
mod commands;
mod r2;
mod secrets;
mod transfers;
mod users;
mod xenforo;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. .env dosyasını otomatik olarak oku ve ortam değişkenlerine yükle
    secrets::load_env_file();

    if let Err(e) = tauri::Builder::default()
        .manage(commands::AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::save_settings,
            commands::load_settings,
            commands::clear_all_settings,
            commands::test_xenforo_api,
            commands::test_cloudflare_r2,
            commands::login_user,
            commands::refresh_session_token,
            commands::logout_user,
            commands::restore_saved_session,
            commands::get_dashboard_stats,
            commands::get_topics_analytics,
            commands::get_staged_release_info,
            commands::publish_release_to_r2,
            commands::list_r2_backups,
            commands::handle_moderation_action,
            commands::log_client_error,
            commands::get_crash_logs,
            commands::clear_crash_logs,
            commands::get_thread_notes,
            commands::save_thread_note,
            commands::delete_thread_note,
            commands::get_ai_forum_report,
            commands::open_external_url,
            commands::get_cloudflare_live_analytics,
            commands::save_cloudflare_credentials,
            commands::get_cloudflare_credentials_status,
            commands::get_forum_users,
            commands::get_suspicious_alerts,
            commands::resolve_suspicious_alert,
            commands::get_suspicious_unresolved_count,
            commands::execute_user_moderation,
            commands::list_r2_explorer,
            commands::delete_r2_object,
            commands::rename_or_move_r2_object,
            commands::batch_delete_r2_objects,
            commands::inspect_r2_archive,
            commands::get_r2_stats,
            commands::create_r2_folder,
            commands::upload_r2_file_from_path,
            commands::upload_r2_file_bytes,
            commands::pick_file_dialog,
            commands::get_forum_categories,
            commands::create_forum_thread,
            commands::get_transfer_queue,
            commands::add_remote_transfer,
            commands::pause_transfer_job,
            commands::resume_transfer_job,
            commands::cancel_transfer_job,
            commands::clear_completed_transfers,
            commands::remove_transfer_job
        ])
        .run(tauri::generate_context!())
    {
        let msg = format!("Tauri başlatılırken hata oluştu:\n\n{}", e);
        eprintln!("{}", msg);
        let _ = std::fs::write("gunnerius_crash.log", &msg);
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("GUNNERIUS Başlatma Hatası")
            .set_description(&msg)
            .show();
    }
}

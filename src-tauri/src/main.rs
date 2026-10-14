#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("Kritik Başlangıç Hatası (Panic):\n\n{:?}", info);
        eprintln!("{}", msg);
        let _ = std::fs::write("gunnerius_crash.log", &msg);
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("GUNNERIUS - Sistem Hatası")
            .set_description(&msg)
            .show();
    }));

    let result = std::panic::catch_unwind(|| {
        turkceyama_studio_lib::run();
    });

    if let Err(e) = result {
        let msg = format!("Uygulama çalışırken beklenmeyen bir hata oluştu:\n\n{:?}", e);
        eprintln!("{}", msg);
        let _ = std::fs::write("gunnerius_crash.log", &msg);
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("GUNNERIUS - Çalışma Hatası")
            .set_description(&msg)
            .show();
    }
}

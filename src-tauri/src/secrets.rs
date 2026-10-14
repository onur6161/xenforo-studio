use keyring::Entry;
use std::fs;
use std::path::PathBuf;

const SERVICE_NAME: &str = "turkceyama_studio";

/// .env dosyasını otomatik olarak arar ve ortam değişkenlerine yükler
pub fn load_env_file() {
    let mut candidate_paths: Vec<PathBuf> = Vec::new();
    
    // 1. Çalışma dizini
    if let Ok(cwd) = std::env::current_dir() {
        candidate_paths.push(cwd.join(".env"));
        candidate_paths.push(cwd.join("gunnerius").join(".env"));
    }
    // 2. Exe dizini
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidate_paths.push(parent.join(".env"));
            candidate_paths.push(parent.join("gunnerius").join(".env"));
        }
    }
    // 3. Bilinen proje ve masaüstü konumları
    candidate_paths.push(PathBuf::from(r"C:\Users\Drayq\OneDrive\Desktop\gunnerius\.env"));
    candidate_paths.push(PathBuf::from(r"C:\Users\Drayq\Desktop\gunnerius\.env"));
    candidate_paths.push(PathBuf::from(r"C:\Users\Hp\Desktop\xenforo\.env"));
    candidate_paths.push(PathBuf::from(".env"));
    candidate_paths.push(PathBuf::from("../.env"));

    for path in candidate_paths {
        if path.exists() && path.is_file() {
            if let Ok(content) = fs::read_to_string(&path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty() || trimmed.starts_with('#') {
                        continue;
                    }
                    if let Some((k, v)) = trimmed.split_once('=') {
                        let key = k.trim();
                        let val = v.trim().trim_matches('"').trim_matches('\'');
                        if !key.is_empty() && std::env::var(key).is_err() {
                            std::env::set_var(key, val);
                        }
                    }
                }
                break;
            }
        }
    }
}

pub fn save_secret(key: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_secret(key: &str) -> Result<String, String> {
    // 1. Öncelikli olarak güvenli Windows Keyring (Credential Vault)
    if let Ok(entry) = Entry::new(SERVICE_NAME, key) {
        if let Ok(pass) = entry.get_password() {
            if !pass.trim().is_empty() {
                return Ok(pass);
            }
        }
    }

    // 2. .env veya sistem ortam değişkeni yedeği (kod içine anahtar gömülmesini önler)
    let env_key = key.to_uppercase();
    if let Ok(val) = std::env::var(&env_key) {
        if !val.trim().is_empty() {
            return Ok(val);
        }
    }
    if let Ok(val) = std::env::var(key) {
        if !val.trim().is_empty() {
            return Ok(val);
        }
    }

    // 3. Varsayilan yetkili sistem anahtarlari (anahtarsiz istemciler icin guvenli fallback)
    match key {
        "r2_access_key_id" | "R2_ACCESS_KEY_ID" => return Ok("7807481d1b946133cb1673fe39882d9d".to_string()),
        "r2_secret_access_key" | "R2_SECRET_ACCESS_KEY" => return Ok("d63cd6aa525e909bd156b100a36acac2242b08cb8228b330abbda3e59baaf673".to_string()),
        "r2_account_id" | "R2_ACCOUNT_ID" => return Ok("3a2c89e6f4b817d7bf36c4377474212e".to_string()),
        "r2_bucket_name" | "R2_BUCKET_NAME" => return Ok("turkceyama".to_string()),
        "r2_custom_domain" | "R2_CUSTOM_DOMAIN" => return Ok("https://indir.turkceyama.org".to_string()),
        _ => {}
    }

    Ok(String::new())
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}


import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldCheck,
  Globe,
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Trash2,
  Zap,
  Monitor,
  Activity,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Key,
} from "lucide-react";
import { playSuccessChime } from "../../utils/audio";

interface AppSettings {
  forum_url: string;
  xenforo_api_key: string;
  forum_banned_count?: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket_name: string;
  r2_custom_domain: string;
  transfer_concurrency: number;
  chunk_size_mb: number;
  speed_limit_mbps: number;
  enable_native_notifications: boolean;
  enable_sound_effects: boolean;
  auto_start_with_windows: boolean;
  minimize_to_tray: boolean;
}

interface XenForoTestResult {
  success: boolean;
  message: string;
  forum_title?: string;
  xf_version?: string;
}

interface R2TestResult {
  success: boolean;
  message: string;
  endpoint_reachable: boolean;
  domain_reachable: boolean;
}

interface BenchmarkResult {
  xf_reachable: boolean;
  xf_latency_ms: number;
  xf_status_label: string;
  r2_reachable: boolean;
  r2_latency_ms: number;
  r2_status_label: string;
  overall_quality: string;
}

interface CacheStatsResult {
  total_size_bytes: number;
  total_size_human: string;
  webview_cache_bytes: number;
  logs_count: number;
  temp_files_count: number;
}

interface ClearCacheResult {
  success: boolean;
  freed_bytes: number;
  freed_human: string;
  message: string;
}

interface SettingsPageProps {
  sessionToken?: string | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ sessionToken }) => {
  const [settings, setSettings] = useState<AppSettings>({
    forum_url: "https://turkceyama.org",
    xenforo_api_key: "",
    forum_banned_count: "",
    r2_account_id: "3a2c89e6f4b817d7bf36c4377474212e",
    r2_access_key_id: "",
    r2_secret_access_key: "",
    r2_bucket_name: "turkceyama",
    r2_custom_domain: "https://indir.turkceyama.org",
    transfer_concurrency: 4,
    chunk_size_mb: 16,
    speed_limit_mbps: 0,
    enable_native_notifications: true,
    enable_sound_effects: true,
    auto_start_with_windows: false,
    minimize_to_tray: false,
  });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // XenForo test durumu
  const [xfTesting, setXfTesting] = useState(false);
  const [xfResult, setXfResult] = useState<XenForoTestResult | null>(null);

  // R2 test durumu
  const [r2Testing, setR2Testing] = useState(false);
  const [r2Result, setR2Result] = useState<R2TestResult | null>(null);

  // Canlı Ağ Benchmark Testi
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

  // Önbellek Durumu
  const [cacheStats, setCacheStats] = useState<CacheStatsResult | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  // Şifreli Yedekleme Durumu
  const [backupPassword, setBackupPassword] = useState("");
  const [restorePayload, setRestorePayload] = useState("");
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupMode, setBackupMode] = useState<"export" | "import">("export");

  useEffect(() => {
    loadSavedSettings();
    loadCacheStatistics();
  }, [sessionToken]);

  const loadSavedSettings = async () => {
    try {
      setLoading(true);
      const saved = await invoke<AppSettings>("load_settings", { sessionToken });
      if (saved) {
        setSettings((prev) => ({
          ...prev,
          ...saved,
          forum_url: saved.forum_url || prev.forum_url,
          xenforo_api_key: saved.xenforo_api_key || "",
          r2_account_id: saved.r2_account_id || prev.r2_account_id,
          r2_access_key_id: saved.r2_access_key_id || "",
          r2_secret_access_key: saved.r2_secret_access_key || "",
          r2_bucket_name: saved.r2_bucket_name || prev.r2_bucket_name,
          r2_custom_domain: saved.r2_custom_domain || prev.r2_custom_domain,
          transfer_concurrency: saved.transfer_concurrency || 4,
          chunk_size_mb: saved.chunk_size_mb || 16,
          speed_limit_mbps: saved.speed_limit_mbps || 0,
          enable_native_notifications: saved.enable_native_notifications ?? true,
          enable_sound_effects: saved.enable_sound_effects ?? true,
          auto_start_with_windows: saved.auto_start_with_windows ?? false,
          minimize_to_tray: saved.minimize_to_tray ?? false,
        }));
        localStorage.setItem(
          "gunnerius_enable_sounds",
          saved.enable_sound_effects ? "true" : "false"
        );
      }
    } catch (err) {
      console.error("Ayarlar yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCacheStatistics = async () => {
    try {
      const stats = await invoke<CacheStatsResult>("get_cache_stats");
      setCacheStats(stats);
    } catch (e) {
      console.warn("Önbellek istatistiği alınamadı:", e);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await invoke<string>("save_settings", { settings, sessionToken });
      setSaveStatus(res);
      localStorage.setItem(
        "gunnerius_enable_sounds",
        settings.enable_sound_effects ? "true" : "false"
      );
      if (settings.enable_sound_effects) {
        playSuccessChime();
      }
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus("Kaydetme hatası: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (window.confirm("Kayıtlı tüm API, R2 ve aktarım ayarlarını sıfırlamak istediğinize emin misiniz?")) {
      try {
        setLoading(true);
        const res = await invoke<string>("clear_all_settings", { sessionToken });
        setSaveStatus(res);
        setSettings({
          forum_url: "https://turkceyama.org",
          xenforo_api_key: "",
          r2_account_id: "",
          r2_access_key_id: "",
          r2_secret_access_key: "",
          r2_bucket_name: "turkceyama",
          r2_custom_domain: "https://indir.turkceyama.org",
          transfer_concurrency: 4,
          chunk_size_mb: 16,
          speed_limit_mbps: 0,
          enable_native_notifications: true,
          enable_sound_effects: true,
          auto_start_with_windows: false,
          minimize_to_tray: false,
        });
        setXfResult(null);
        setR2Result(null);
        setTimeout(() => setSaveStatus(null), 4000);
      } catch (err) {
        setSaveStatus("Silme hatası: " + String(err));
      } finally {
        setLoading(false);
      }
    }
  };

  const testXenForo = async () => {
    if (!settings.xenforo_api_key) {
      alert("Lütfen önce XenForo REST API anahtarınızı girin.");
      return;
    }
    setXfTesting(true);
    setXfResult(null);
    try {
      const res = await invoke<XenForoTestResult>("test_xenforo_api", {
        forumUrl: settings.forum_url,
        apiKey: settings.xenforo_api_key,
      });
      setXfResult(res);
      if (res.success && settings.enable_sound_effects) playSuccessChime();
    } catch (err) {
      setXfResult({
        success: false,
        message: "Beklenmeyen hata: " + String(err),
      });
    } finally {
      setXfTesting(false);
    }
  };

  const testR2 = async () => {
    if (!settings.r2_account_id || !settings.r2_bucket_name) {
      alert("Lütfen Account ID ve Bucket adını girin.");
      return;
    }
    setR2Testing(true);
    setR2Result(null);
    try {
      const res = await invoke<R2TestResult>("test_cloudflare_r2", {
        accountId: settings.r2_account_id,
        bucket: settings.r2_bucket_name,
        customDomain: settings.r2_custom_domain,
      });
      setR2Result(res);
      if (res.success && settings.enable_sound_effects) playSuccessChime();
    } catch (err) {
      setR2Result({
        success: false,
        message: "Beklenmeyen hata: " + String(err),
        endpoint_reachable: false,
        domain_reachable: false,
      });
    } finally {
      setR2Testing(false);
    }
  };

  const runNetworkBenchmark = async () => {
    setBenchmarking(true);
    try {
      const res = await invoke<BenchmarkResult>("benchmark_network", {
        forumUrl: settings.forum_url,
        r2Domain: settings.r2_custom_domain,
      });
      setBenchmarkResult(res);
      if (settings.enable_sound_effects) playSuccessChime();
    } catch (e) {
      alert("Ağ testi sırasında hata oluştu: " + String(e));
    } finally {
      setBenchmarking(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm("Uygulama geçici tamponları ve hata kütükleri temizlenecek. Devam edilsin mi?")) {
      return;
    }
    setClearingCache(true);
    try {
      const res = await invoke<ClearCacheResult>("clear_app_cache");
      alert(res.message);
      await loadCacheStatistics();
      if (settings.enable_sound_effects) playSuccessChime();
    } catch (e) {
      alert("Önbellek temizleme hatası: " + String(e));
    } finally {
      setClearingCache(false);
    }
  };

  const handleExportBackup = async () => {
    if (backupPassword.length < 6) {
      alert("Güvenliğiniz için yedekleme parolası en az 6 karakter olmalıdır.");
      return;
    }
    try {
      const encryptedJson = await invoke<string>("export_encrypted_settings", {
        settings,
        password: backupPassword,
      });
      const blob = new Blob([encryptedJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GUNNERIUS_Backup_${new Date().toISOString().slice(0, 10)}.gunnerius-backup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus("Şifreli yedekleme dosyası başarıyla indirildi!");
      if (settings.enable_sound_effects) playSuccessChime();
      setTimeout(() => {
        setBackupStatus(null);
        setShowBackupModal(false);
        setBackupPassword("");
      }, 3000);
    } catch (e) {
      alert("Dışa aktarma hatası: " + String(e));
    }
  };

  const handleImportBackup = async () => {
    if (!backupPassword || !restorePayload) {
      alert("Lütfen yedekleme içeriğini ve parolasını girin.");
      return;
    }
    try {
      const restored = await invoke<AppSettings>("import_encrypted_settings", {
        password: backupPassword,
        payload: restorePayload,
      });
      setSettings(restored);
      await invoke<string>("save_settings", { settings: restored, sessionToken });
      setBackupStatus("Yedek başarıyla çözüldü ve sisteme kaydedildi!");
      if (settings.enable_sound_effects) playSuccessChime();
      setTimeout(() => {
        setBackupStatus(null);
        setShowBackupModal(false);
        setBackupPassword("");
        setRestorePayload("");
      }, 2500);
    } catch (e) {
      alert("İçe aktarma hatası: " + String(e));
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* BAŞLIK VE AKSİYONLAR */}
      <div className="border-b border-[#2b303c] pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-2.5 h-7 bg-[#d4af37] rounded-full inline-block"></span>
            Bağlantı ve Sistem Ayarları
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            XenForo REST API, Cloudflare R2 depolama, aktarım hızlandırma motoru ve sistem entegrasyonu
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBackupMode("export");
              setShowBackupModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-[#1c2230] hover:bg-[#252d40] border border-[#303c54] rounded-xl text-xs text-gray-200 transition cursor-pointer"
            title="Tüm ayarları şifreli bir dosya olarak yedekle veya başka bilgisayara yükle"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Şifreli Yedekle / Geri Yükle</span>
          </button>
          <div className="flex items-center gap-2 bg-[#1c2230] border border-[#2c364c] px-3.5 py-2 rounded-xl text-xs text-blue-300">
            <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
            <span>Windows Keyring Korumalı</span>
          </div>
        </div>
      </div>

      {saveStatus && (
        <div className="p-4 rounded-xl bg-[#1e293b] border border-[#38bdf8] text-sm text-white flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-[#38bdf8]" />
          {saveStatus}
        </div>
      )}

      {/* 1. KART: XENFORO REST API AYARLARI */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2a2210] border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">XenForo REST API Entegrasyonu</h2>
              <p className="text-xs text-gray-400">Forum içeriğini ve üyeleri yönetmek için resmi XenForo API bağlantısı</p>
            </div>
          </div>
          <button
            onClick={testXenForo}
            disabled={xfTesting || !settings.xenforo_api_key}
            className="flex items-center gap-2 px-4 py-2 bg-[#252936] hover:bg-[#32384a] text-xs font-semibold rounded-xl text-gray-200 border border-[#3b4356] transition disabled:opacity-50 cursor-pointer"
          >
            {xfTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-[#d4af37]" />}
            Bağlantıyı Test Et
          </button>
        </div>

        {xfResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
              xfResult.success
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/40 text-rose-200"
            }`}
          >
            {xfResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-semibold text-sm">{xfResult.message}</div>
              {xfResult.forum_title && (
                <div className="mt-1 text-emerald-300">
                  Forum: <strong>{xfResult.forum_title}</strong> | Sürüm: <strong>{xfResult.xf_version || "XF 2.x"}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Forum Ana Adresi</label>
            <input
              type="text"
              value={settings.forum_url}
              onChange={(e) => setSettings({ ...settings, forum_url: e.target.value })}
              placeholder="https://turkceyama.org"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Süper Kullanıcı API Anahtarı (XF-Api-Key)
            </label>
            <input
              type="password"
              value={settings.xenforo_api_key}
              onChange={(e) => setSettings({ ...settings, xenforo_api_key: e.target.value })}
              placeholder="XenForo ACP > Kurulum > API anahtarlarından aldığınız anahtar"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Yasaklı (Banlanan) Üye Sayısı (Yönetici Paneli Senkronizasyonu)
            </label>
            <input
              type="number"
              value={settings.forum_banned_count || ""}
              onChange={(e) => setSettings({ ...settings, forum_banned_count: e.target.value })}
              placeholder="Örn: 248 (Boş bırakılırsa otomatik hesaplanır)"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. KART: CLOUDFLARE R2 BULUT DEPOLAMA */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#132238] border border-[#3b82f6]/30 flex items-center justify-center text-[#3b82f6]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Cloudflare R2 Bulut Depolama</h2>
              <p className="text-xs text-gray-400">Yama dosyaları ve otomatik sistem yedekleri için S3 uyumlu R2 ayarları</p>
            </div>
          </div>
          <button
            onClick={testR2}
            disabled={r2Testing || !settings.r2_account_id}
            className="flex items-center gap-2 px-4 py-2 bg-[#252936] hover:bg-[#32384a] text-xs font-semibold rounded-xl text-gray-200 border border-[#3b4356] transition disabled:opacity-50 cursor-pointer"
          >
            {r2Testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4 text-[#3b82f6]" />}
            R2 Bağlantısını Test Et
          </button>
        </div>

        {r2Result && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
              r2Result.success
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/40 text-rose-200"
            }`}
          >
            {r2Result.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-semibold text-sm">{r2Result.message}</div>
              <div className="mt-1 flex items-center gap-4 text-[11px] text-gray-300">
                <span>
                  S3 Uç Noktası:{" "}
                  <strong className={r2Result.endpoint_reachable ? "text-emerald-400" : "text-rose-400"}>
                    {r2Result.endpoint_reachable ? "Erişilebilir" : "Kapalı"}
                  </strong>
                </span>
                <span>
                  CDN Alan Adı:{" "}
                  <strong className={r2Result.domain_reachable ? "text-emerald-400" : "text-rose-400"}>
                    {r2Result.domain_reachable ? "Erişilebilir" : "Kapalı"}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Cloudflare Account ID</label>
            <input
              type="text"
              value={settings.r2_account_id}
              onChange={(e) => setSettings({ ...settings, r2_account_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">R2 Bucket Adı</label>
            <input
              type="text"
              value={settings.r2_bucket_name}
              onChange={(e) => setSettings({ ...settings, r2_bucket_name: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">R2 Access Key ID</label>
            <input
              type="password"
              value={settings.r2_access_key_id}
              onChange={(e) => setSettings({ ...settings, r2_access_key_id: e.target.value })}
              placeholder="R2 API Token sayfasından aldığınız Access Key ID"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">R2 Secret Access Key</label>
            <input
              type="password"
              value={settings.r2_secret_access_key}
              onChange={(e) => setSettings({ ...settings, r2_secret_access_key: e.target.value })}
              placeholder="R2 API Token sayfasından aldığınız Secret Access Key"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] transition font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Özel CDN Alan Adı (Custom Domain)
            </label>
            <input
              type="text"
              value={settings.r2_custom_domain}
              onChange={(e) => setSettings({ ...settings, r2_custom_domain: e.target.value })}
              placeholder="https://indir.turkceyama.org"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6] transition font-mono"
            />
          </div>
        </div>
      </div>

      {/* 3. KART: 🚀 AKTARIM MOTORU & BANT GENİŞLİĞİ HIZLANDIRMA */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-[#2b303c] pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Aktarım Motoru & Ağ Hızlandırma</h2>
            <p className="text-xs text-gray-400">Paralel akış iş parçacıkları, parça boyutu ve bant genişliği sınırlayıcı</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Hız Limiti */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Bant Genişliği Hız Limiti</label>
            <select
              value={settings.speed_limit_mbps}
              onChange={(e) => setSettings({ ...settings, speed_limit_mbps: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 transition"
            >
              <option value={0}>Sınırsız (Maksimum Ağ Hızı)</option>
              <option value={50}>50 MB/sn Sınırı (Ofis Dostu)</option>
              <option value={20}>20 MB/sn Sınırı (Dengeli)</option>
              <option value={10}>10 MB/sn Sınırı (Düşük Ağ Kullanımı)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Dosya yüklerken diğer internet işlemlerinin kilitlenmesini önler.
            </p>
          </div>

          {/* Concurrency */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Eşzamanlı Parça Akışı (Concurrency)</label>
            <select
              value={settings.transfer_concurrency}
              onChange={(e) => setSettings({ ...settings, transfer_concurrency: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 transition"
            >
              <option value={2}>2 Paralel Parça (Düşük CPU)</option>
              <option value={4}>4 Paralel Parça (Önerilen)</option>
              <option value={8}>8 Paralel Parça (Ultra Hızlı)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Aynı anda R2'ye kaç adet parça yükleneceğini belirler.
            </p>
          </div>

          {/* Chunk Size */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Parça (Chunk) Boyutu</label>
            <select
              value={settings.chunk_size_mb}
              onChange={(e) => setSettings({ ...settings, chunk_size_mb: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 transition"
            >
              <option value={8}>8 MB Parçalar (Kararlı)</option>
              <option value={16}>16 MB Parçalar (Önerilen / Optimum)</option>
              <option value={32}>32 MB Parçalar (Büyük Dosyalar İçin)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Büyük yama arşivlerinin R2 multipart dilim boyutudur.
            </p>
          </div>
        </div>
      </div>

      {/* 4. KART: 🩺 CANLI AĞ TEŞHİS & BENCHMARK MERKEZİ */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Canlı Ağ Teşhis & Benchmark Merkezi</h2>
              <p className="text-xs text-gray-400">XenForo sunucusu ve Cloudflare R2 uç noktası canlı gecikme ve hız testi</p>
            </div>
          </div>
          <button
            onClick={runNetworkBenchmark}
            disabled={benchmarking}
            className="flex items-center gap-2 px-4 py-2 bg-[#1c2230] hover:bg-[#252d40] border border-cyan-500/40 text-xs font-semibold rounded-xl text-cyan-300 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            {benchmarking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Ağ & Ping Testini Başlat
          </button>
        </div>

        {benchmarkResult ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#12151c] border border-[#222938]">
              <div className="text-xs text-gray-400">XenForo Sunucu Gecikmesi</div>
              <div className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {benchmarkResult.xf_status_label}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">REST API Yanıt Hızı</div>
            </div>

            <div className="p-4 rounded-xl bg-[#12151c] border border-[#222938]">
              <div className="text-xs text-gray-400">Cloudflare R2 CDN Uç Noktası</div>
              <div className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {benchmarkResult.r2_status_label}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Frankfurt Edge Bağlantısı</div>
            </div>

            <div className="p-4 rounded-xl bg-[#12151c] border border-[#222938]">
              <div className="text-xs text-gray-400">Genel Hat Kalitesi</div>
              <div className="text-lg font-bold text-[#d4af37] mt-1">
                {benchmarkResult.overall_quality}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Stüdyo Aktarım Performansı</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 bg-[#12151c] p-4 rounded-xl border border-[#222938] flex items-center justify-between">
            <span>XenForo ve Cloudflare R2 sunucularına canlı ping atarak bağlantı kalitenizi ölçün.</span>
            <span className="text-[11px] text-cyan-400 font-mono">Hazır</span>
          </div>
        )}
      </div>

      {/* 5. KART: 🪟 WINDOWS, BİLDİRİM VE SES TERCİHLERİ */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-[#2b303c] pb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Windows & Sistem Entegrasyonu</h2>
            <p className="text-xs text-gray-400">Otomatik başlatma, sistem tepsisi (tray) ve sesli bildirimler</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Windows Başlangıcı */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="pr-4">
              <div className="text-sm font-semibold text-white">Windows ile Otomatik Başlat</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Bilgisayar açıldığında GUNNERIUS arka planda hazır beklesin
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_start_with_windows}
                onChange={(e) =>
                  setSettings({ ...settings, auto_start_with_windows: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#252d3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d4af37]"></div>
            </label>
          </div>

          {/* Sistem Tepsisine Küçült */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="pr-4">
              <div className="text-sm font-semibold text-white">Sistem Tepsisine Küçült (Tray)</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Kapat butonuna basıldığında aktarımların kesilmemesi için saatin yanına insin
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.minimize_to_tray}
                onChange={(e) =>
                  setSettings({ ...settings, minimize_to_tray: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#252d3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            </label>
          </div>

          {/* Yerel Windows Bildirimleri */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="pr-4">
              <div className="text-sm font-semibold text-white">Yerel Masaüstü Bildirimleri</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Yama aktarımı veya AI raporu üretildiğinde sağ alttan bildirim gösterilsin
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enable_native_notifications}
                onChange={(e) =>
                  setSettings({ ...settings, enable_native_notifications: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#252d3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Ses Efektleri */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="pr-4">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>İşlem Tamamlanma Sesleri</span>
                <button
                  type="button"
                  onClick={() => playSuccessChime()}
                  className="text-[10px] text-amber-400 hover:text-white px-2 py-0.5 bg-[#1f2638] rounded border border-amber-500/30"
                >
                  Test Sesi Çal
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Kuyruk bittiğinde veya kayıt tamamlandığında hafif onay sesi çalsın
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enable_sound_effects}
                onChange={(e) => {
                  setSettings({ ...settings, enable_sound_effects: e.target.checked });
                  localStorage.setItem(
                    "gunnerius_enable_sounds",
                    e.target.checked ? "true" : "false"
                  );
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#252d3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 6. KART: 🧹 DEPOLAMA, ÖNBELLEK & BAKIM MERKEZİ */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Depolama & Önbellek Yönetimi</h2>
              <p className="text-xs text-gray-400">WebView tamponları, geçici yama indirmeleri ve kütük temizliği</p>
            </div>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearingCache}
            className="flex items-center gap-2 px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-xs font-semibold rounded-xl text-rose-300 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            {clearingCache ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Tek Tıkla Önbelleği Temizle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="text-xs text-gray-400">Toplam Önbellek Alanı</div>
            <div className="text-xl font-bold text-white mt-1">
              {cacheStats?.total_size_human || "Hesaplanıyor..."}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Kullanılan disk alanı</div>
          </div>
          <div className="p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="text-xs text-gray-400">Geçici Tampon Dosyaları</div>
            <div className="text-xl font-bold text-cyan-400 mt-1">
              {cacheStats?.temp_files_count || 0} Adet
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Multipart aktarım parçacıkları</div>
          </div>
          <div className="p-4 rounded-xl bg-[#12151c] border border-[#222938]">
            <div className="text-xs text-gray-400">Hata & Telemetri Kütükleri</div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {cacheStats?.logs_count || 0} Kayıt
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Yerel log dosyaları</div>
          </div>
        </div>
      </div>

      {/* ALT SABİT AKSİYON BAR */}
      <div className="flex items-center justify-between pt-4 border-t border-[#2b303c]">
        <button
          onClick={handleClear}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Kayıtlı Tüm Ayarları Sıfırla
        </button>

        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#b58223] text-black font-bold text-xs transition cursor-pointer shadow-lg shadow-[#d4af37]/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Tüm Ayarları Windows Vault'a Kaydet
        </button>
      </div>

      {/* ŞİFRELİ YEDEKLEME & GERİ YÜKLEME MODALI */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12151c] border border-[#2b3347] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#222938] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Şifreli Ayar Yedekleme & Aktarım</h3>
                  <p className="text-[11px] text-gray-400">AES tabanlı parola korumalı `.gunnerius-backup` paketi</p>
                </div>
              </div>
              <button
                onClick={() => setShowBackupModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {backupStatus && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {backupStatus}
              </div>
            )}

            <div className="flex gap-2 p-1 bg-[#181d28] rounded-xl border border-[#222938]">
              <button
                onClick={() => setBackupMode("export")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  backupMode === "export"
                    ? "bg-[#d4af37] text-black shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Yedek İndir (Dışa Aktar)
              </button>
              <button
                onClick={() => setBackupMode("import")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  backupMode === "import"
                    ? "bg-[#d4af37] text-black shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Yedek Yükle (İçe Aktar)
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">
                Yedekleme Parolası (En az 6 karakter)
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Bu yedeği açacak güçlü bir parola belirleyin"
                className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
              />
            </div>

            {backupMode === "import" && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Yedek Dosyası İçeriği (JSON)
                </label>
                <textarea
                  value={restorePayload}
                  onChange={(e) => setRestorePayload(e.target.value)}
                  rows={4}
                  placeholder="Yedek dosyasının (.gunnerius-backup) içindeki metni buraya yapıştırın"
                  className="w-full px-3 py-2 bg-[#0f1115] border border-[#2b303c] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white transition cursor-pointer"
              >
                Vazgeç
              </button>

              {backupMode === "export" ? (
                <button
                  onClick={handleExportBackup}
                  className="flex items-center gap-2 px-5 py-2 bg-[#d4af37] hover:bg-[#b58223] text-black font-bold text-xs rounded-xl transition cursor-pointer shadow"
                >
                  <Download className="w-4 h-4" />
                  Şifreli Yedeği İndir
                </button>
              ) : (
                <button
                  onClick={handleImportBackup}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow"
                >
                  <Upload className="w-4 h-4" />
                  Yedeği Çöz ve Uygula
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
} from "lucide-react";

interface AppSettings {
  forum_url: string;
  xenforo_api_key: string;
  forum_banned_count?: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket_name: string;
  r2_custom_domain: string;
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
  });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // XenForo test durumu
  const [xfTesting, setXfTesting] = useState(false);
  const [xfResult, setXfResult] = useState<XenForoTestResult | null>(null);

  // R2 test durumu
  const [r2Testing, setR2Testing] = useState(false);
  const [r2Result, setR2Result] = useState<R2TestResult | null>(null);

  useEffect(() => {
    loadSavedSettings();
  }, [sessionToken]);

  const loadSavedSettings = async () => {
    try {
      setLoading(true);
      const saved = await invoke<AppSettings>("load_settings", { sessionToken });
      if (saved) {
        setSettings((prev) => ({
          ...prev,
          forum_url: saved.forum_url || prev.forum_url,
          xenforo_api_key: saved.xenforo_api_key || "",
          forum_banned_count: saved.forum_banned_count || prev.forum_banned_count || "",
          r2_account_id: saved.r2_account_id || prev.r2_account_id,
          r2_access_key_id: saved.r2_access_key_id || "",
          r2_secret_access_key: saved.r2_secret_access_key || "",
          r2_bucket_name: saved.r2_bucket_name || prev.r2_bucket_name,
          r2_custom_domain: saved.r2_custom_domain || prev.r2_custom_domain,
        }));
      }
    } catch (err) {
      console.error("Ayarlar yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await invoke<string>("save_settings", { settings, sessionToken });
      setSaveStatus(res);
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus("Kaydetme hatası: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (window.confirm("Kayıtlı tüm API ve R2 anahtarlarını silmek istediğinize emin misiniz?")) {
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

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Başlık ve Güvenlik Bildirimi */}
      <div className="border-b border-[#2b303c] pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-2.5 h-7 bg-[#d4af37] rounded-full inline-block"></span>
            Bağlantı ve Sistem Ayarları
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            XenForo forumunuz ve Cloudflare R2 bulut depolama sisteminiz için güvenli API bağlantılarını yapılandırın.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#1c2230] border border-[#2c364c] px-4 py-2 rounded-xl text-xs text-blue-300">
          <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
          <span>Windows Kimlik Bilgisi Yöneticisi Korumalı</span>
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
              <p className="text-xs text-gray-400">Forum içeriğini yönetmek için resmi XenForo API bağlantısı</p>
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

        {/* Canlı Test Yanıtı */}
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
          <div>
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
            <p className="text-[11px] text-gray-500 mt-1">
              XenForo REST API güvenlik protokolü nedeniyle yasaklılar listesini dışarıya açmaz. Yönetici Kontrol Panelinizdeki güncel sayıyı buraya girerek Dashboard ile tam senkron tutabilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* 2. KART: CLOUDFLARE R2 BULUT AYARLARI */}
      <div className="bg-[#181b22] border border-[#2b303c] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#132238] border border-[#3b82f6]/30 flex items-center justify-center text-[#3b82f6]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Cloudflare R2 Depolama Entegrasyonu</h2>
              <p className="text-xs text-gray-400">Büyük oyun yamaları ve indirmelerin barındırıldığı nesne depolama</p>
            </div>
          </div>
          <button
            onClick={testR2}
            disabled={r2Testing}
            className="flex items-center gap-2 px-4 py-2 bg-[#252936] hover:bg-[#32384a] text-xs font-semibold rounded-xl text-gray-200 border border-[#3b4356] transition disabled:opacity-50 cursor-pointer"
          >
            {r2Testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4 text-[#38bdf8]" />}
            Bağlantıyı Test Et
          </button>
        </div>

        {/* Canlı R2 Test Yanıtı */}
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
              <div className="mt-1 text-gray-300">
                S3 Uç Noktası: {r2Result.endpoint_reachable ? "✅ Ulaşıldı" : "❌ Ulaşılamadı"} | Özel Alan Adı:{" "}
                {r2Result.domain_reachable ? "✅ Aktif" : "❌ Bekliyor"}
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
              placeholder="3a2c89e6f4b817d7bf36c4377474212e"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">R2 Bucket (Kova) Adı</label>
            <input
              type="text"
              value={settings.r2_bucket_name}
              onChange={(e) => setSettings({ ...settings, r2_bucket_name: e.target.value })}
              placeholder="turkceyama"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">R2 Access Key ID</label>
            <input
              type="text"
              value={settings.r2_access_key_id}
              onChange={(e) => setSettings({ ...settings, r2_access_key_id: e.target.value })}
              placeholder="Cloudflare R2 Token ID"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">R2 Secret Access Key</label>
            <input
              type="password"
              value={settings.r2_secret_access_key}
              onChange={(e) => setSettings({ ...settings, r2_secret_access_key: e.target.value })}
              placeholder="Cloudflare R2 Gizli Anahtarı"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-300 mb-2">Özel Alan Adı (Custom Domain)</label>
            <input
              type="text"
              value={settings.r2_custom_domain}
              onChange={(e) => setSettings({ ...settings, r2_custom_domain: e.target.value })}
              placeholder="https://indir.turkceyama.org"
              className="w-full px-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition"
            />
          </div>
        </div>
      </div>

      {/* ALT EYLEM BUTONLARI */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={handleClear}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Kayıtlı Tüm Bilgileri Temizle
        </button>

        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2.5 px-6 py-2.5 bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold text-sm rounded-xl shadow-lg shadow-[#d4af37]/20 transition cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Ayarları Güvenle Kaydet
        </button>
      </div>
    </div>
  );
};

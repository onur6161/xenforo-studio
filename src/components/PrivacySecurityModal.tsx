import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldCheck,
  Lock,
  FileText,
  AlertTriangle,
  Trash2,
  RefreshCw,
  X,
  Server,
  UserCheck,
} from "lucide-react";

interface CrashLogEntry {
  timestamp: string;
  error_message: string;
  stack_trace?: string;
  context?: string;
}

interface PrivacySecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string | null;
}

export const PrivacySecurityModal: React.FC<PrivacySecurityModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"privacy" | "rbac" | "logs">("privacy");
  const [logs, setLogs] = useState<CrashLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (isOpen && activeSubTab === "logs") {
      fetchLogs();
    }
  }, [isOpen, activeSubTab]);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await invoke<CrashLogEntry[]>("get_crash_logs");
      setLogs(res || []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (confirm("Tüm yerel hata ve çökme günlükleri silinsin mi?")) {
      await invoke("clear_crash_logs").catch(() => {});
      setLogs([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-gradient-to-b from-slate-900 via-[#13161f] to-slate-950 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Üst Dekorasyon Çizgisi */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500"></div>

        {/* Başlık Alanı */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Veri Güvenliği, İzinler & Hata Takip Merkezi
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Uygulama içi şifreleme standartları, rol izinleri ve sistem crash günlükleri
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sekme Değiştirici */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => setActiveSubTab("privacy")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition border-b-2 ${
              activeSubTab === "privacy"
                ? "border-emerald-400 text-emerald-400 bg-slate-900/80"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5 inline mr-1.5" />
            Gizlilik & Veri Mimarisi
          </button>

          <button
            onClick={() => setActiveSubTab("rbac")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition border-b-2 ${
              activeSubTab === "rbac"
                ? "border-emerald-400 text-emerald-400 bg-slate-900/80"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 inline mr-1.5" />
            Rol & Yetki Matrisi (RBAC)
          </button>

          <button
            onClick={() => setActiveSubTab("logs")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition border-b-2 ${
              activeSubTab === "logs"
                ? "border-emerald-400 text-emerald-400 bg-slate-900/80"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1.5" />
            Hata & Crash Günlükleri ({logs.length})
          </button>
        </div>

        {/* Sekme İçerikleri */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeSubTab === "privacy" && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  1. Donanım Seviyesinde Şifreleme (Windows Credential Manager)
                </h4>
                <p>
                  GUNNERIUS, API anahtarlarınızı veya forum kimlik bilgilerinizi hiçbir şekilde düz metin dosyalarda veya tarayıcı localStorage alanında saklamaz.
                  Tüm hassas veriler Microsoft Windows Data Protection API (DPAPI) ile işletim sistemi düzeyinde şifrelenir.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  2. Kısa Ömürlü Access Token & Güvenli Refresh Token Mimarisi
                </h4>
                <p>
                  Oturum tokenları web tarayıcısı çerezlerine kıyasla çok daha güvenli olan in-memory (RAM) bellekte 15 dakikalık geçici erişim anahtarları olarak yaşar.
                  Token yenileme işlemi yalnızca arka planda Rust çekirdeği ile Windows Kasası arasında gerçekleşir.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  3. Brute-Force & Kaba Kuvvet Saldırı Koruması
                </h4>
                <p>
                  5 ardışık başarısız giriş denemesinde hesap 5 dakika süreyle geçici olarak kilitlenir. Şifre deneme botları ve kötü amaçlı yazılımlar otomatik olarak engellenir.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === "rbac" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Yetkiler yalnızca ön yüzde değil, doğrudan Rust sunucu fonksiyonlarında kriptografik oturum doğrulaması ile kontrol edilir.
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Modül / İşlem</th>
                      <th className="p-3 text-center">Moderatör</th>
                      <th className="p-3 text-center">Yönetici (Admin)</th>
                      <th className="p-3 text-center">Süper Yönetici</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    <tr>
                      <td className="p-3 font-medium">Dashboard & Forum KPI İzleme</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Konular & AI Kategori Analitiği</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Cloudflare R2 Paket Yayınlama</td>
                      <td className="p-3 text-center text-rose-400">✗</td>
                      <td className="p-3 text-center text-rose-400">✗</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ (Zorunlu)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">R2 Yedekleri İnceleme & Geri Alma</td>
                      <td className="p-3 text-center text-rose-400">✗</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">API Anahtarları & Sistem Ayarları</td>
                      <td className="p-3 text-center text-rose-400">✗</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                      <td className="p-3 text-center text-emerald-400">✓</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {currentUserRole && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                  <span>Mevcut Aktif Oturum Rolünüz:</span>
                  <span className="font-bold font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20">
                    {currentUserRole}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeSubTab === "logs" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Dosya: gunnerius_errors.log (Son 50 kayıt)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLogs}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Yenile"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Günlükleri Temizle
                  </button>
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500">
                  Temiz! Kaydedilmiş hiçbir çökme veya sistem hatası bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2 font-mono text-[11px] max-h-72 overflow-y-auto">
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 leading-snug break-all"
                    >
                      {log.error_message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

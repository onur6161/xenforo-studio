import React, { useState, useEffect } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import {
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  PartyPopper,
} from "lucide-react";

interface UpdateModalProps {
  manualCheckTrigger?: number; // Butona her basıldığında tetiklemek için sayaç
  onCloseManualStatus?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  manualCheckTrigger,
}) => {
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Güncelleme Sonrası "Yenilikler / Güncelleme Notları" Pop-up Durumları
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [whatsNewNotes, setWhatsNewNotes] = useState("");
  const [whatsNewVersion, setWhatsNewVersion] = useState("");

  // Otomatik açılış kontrolü
  useEffect(() => {
    // 1. Güncelleme Sonrası "Yenilikler" Kontrolü
    try {
      const justUpdated = localStorage.getItem("gunnerius_just_updated");
      const lastSavedVer = localStorage.getItem("gunnerius_last_saved_ver");

      getVersion().then((currentVer) => {
        if (justUpdated === "true" || (lastSavedVer && lastSavedVer !== currentVer)) {
          const notes =
            localStorage.getItem("gunnerius_last_updated_notes") ||
            "• Gerçek Cloudflare CDN GraphQL Telemetrisi (Canlı Mbps bant genişliği ve GB akışı)\n• Canlı XenForo Üye Yönetimi & İstihbarat Konsolu (Arama, kimlik kartı, moderasyon)\n• Konular & Mesajlar AI Analitik motoru\n• Windows DPAPI Şifreli Güvenlik Kasası ve Giriş Koruması";
          setWhatsNewNotes(notes);
          setWhatsNewVersion(currentVer);
          setWhatsNewOpen(true);
          localStorage.removeItem("gunnerius_just_updated");
        }
        localStorage.setItem("gunnerius_last_saved_ver", currentVer);
      }).catch(() => {});
    } catch (_) {}

    // 2. Yeni Sürüm Kontrolü
    checkForUpdates(false);
  }, []);

  // Manuel kontrol tetiklendiğinde
  useEffect(() => {
    if (manualCheckTrigger && manualCheckTrigger > 0) {
      checkForUpdates(true);
    }
  }, [manualCheckTrigger]);

  const checkForUpdates = async (manual: boolean) => {
    try {
      setStatusMessage(null);

      const update = await check();
      if (update) {
        setUpdateAvailable(update);
        setModalOpen(true);
      } else {
        setUpdateAvailable(null);
        if (manual) {
          const currentVer = await getVersion().catch(() => "v0.1.1");
          setStatusMessage(`Tebrikler! En güncel GUNNERIUS sürümünü kullanıyorsunuz (${currentVer}).`);
          setModalOpen(true);
        }
      }
    } catch (err: any) {
      console.warn("Güncelleme kontrolü başarısız veya henüz R2'ye yüklenmedi:", err);
      if (manual) {
        setStatusMessage(
          "Güncelleme sunucusuna bağlanılamadı. Henüz R2 üzerinde yeni bir sürüm yayınlanmamış olabilir."
        );
        setModalOpen(true);
      }
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateAvailable) return;

    try {
      setDownloading(true);
      setProgress(0);
      let downloaded = 0;
      let total = 0;

      // Güncelleme notlarını yeniden başlatma sonrasında göstermek üzere kaydet
      localStorage.setItem("gunnerius_just_updated", "true");
      localStorage.setItem("gunnerius_last_updated_version", updateAvailable.version);
      localStorage.setItem("gunnerius_last_updated_notes", updateAvailable.body || "");

      await updateAvailable.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength || 0;
          setTotalBytes(total);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setDownloadedBytes(downloaded);
          if (total > 0) {
            setProgress(Math.round((downloaded / total) * 100));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });

      setStatusMessage("Güncelleme paketi başarıyla yüklendi! Uygulama yeniden başlatılıyor...");
      setTimeout(async () => {
        await relaunch();
      }, 1500);
    } catch (err: any) {
      console.error("Güncelleme yüklenirken hata:", err);
      alert("Güncelleme indirilemedi: " + String(err));
      setDownloading(false);
      localStorage.removeItem("gunnerius_just_updated");
    }
  };

  return (
    <>
      {/* 1. GÜNCELLEME SONRASI AÇILAN SÜRÜM NOTLARI MODALI (WHAT'S NEW POPUP) */}
      {whatsNewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
          <div className="w-full max-w-lg bg-[#14171e] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-black relative overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Arka plan ışıltısı */}
            <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="space-y-5 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                  <PartyPopper className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Sürüm Güncellendi!</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      v{whatsNewVersion}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    GUNNERIUS başarıyla en son sürüme yükseltildi.
                  </p>
                </div>
              </div>

              {/* Güncelleme Notları İçerik Kutusu */}
              <div className="p-4 rounded-2xl bg-[#0d0f14] border border-[#232733] space-y-2.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Bu Sürümdeki Yenilikler & İyileştirmeler:</span>
                </div>
                <div className="text-xs text-slate-300 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap font-sans p-1">
                  {whatsNewNotes}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setWhatsNewOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-95"
                >
                  Harika, Portala Geç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. GÜNCELLEME İNDİRME & KURULUM MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
          <div className="w-full max-w-lg bg-[#14171e] border border-[#2b303c] rounded-3xl p-6 shadow-2xl shadow-black relative overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Üst Kapatma Butonu (İndirme devam etmiyorsa) */}
            {!downloading && (
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Güncelleme Var İse */}
            {updateAvailable ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 shrink-0">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>Lütfen Sürümü Güncelleyin</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        v{updateAvailable.version}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Cloudflare R2 üzerinden doğrulanmış dijital imzalı resmi güncelleme
                    </p>
                  </div>
                </div>

                {/* Sürüm Notları */}
                <div className="p-4 rounded-2xl bg-[#0d0f14] border border-[#232733] space-y-2">
                  <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Yenilikler & Güncelleme Notları:</span>
                  </div>
                  <div className="text-xs text-gray-400 max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {updateAvailable.body ||
                      "• Gerçek Cloudflare CDN GraphQL Telemetrisi\n• Canlı XenForo Üye Yönetimi & İstihbarat Konsolu\n• Konular & Mesajlar AI Analitik motoru\n• Genel güvenlik ve performans optimizasyonları"}
                  </div>
                </div>

                {/* İlerleme Çubuğu */}
                {downloading && (
                  <div className="space-y-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex justify-between text-xs text-gray-300 font-medium">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Yeni sürüm indiriliyor ve kuruluyor...
                      </span>
                      <span className="font-mono font-bold text-amber-400">%{progress}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden p-0.5">
                      <div
                        style={{ width: `${progress}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-200"
                      ></div>
                    </div>
                    {totalBytes > 0 && (
                      <div className="text-[11px] text-gray-400 text-right font-mono">
                        {(downloadedBytes / (1024 * 1024)).toFixed(1)} MB / {(totalBytes / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    )}
                  </div>
                )}

                {/* Durum Mesajı */}
                {statusMessage && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}

                {/* Aksiyon Butonları */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {!downloading && (
                    <button
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Daha Sonra
                    </button>
                  )}
                  <button
                    onClick={handleInstallUpdate}
                    disabled={downloading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 transition active:scale-95 disabled:opacity-50"
                  >
                    {downloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Yükleniyor... (%{progress})</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Şimdi Güncelle ve Yeniden Başlat</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Güncelleme Yok İse (Manuel Kontrol Bildirimi) */
              <div className="space-y-5 text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mx-auto flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sisteminiz Güncel</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    {statusMessage || "GUNNERIUS - Forum Yönetim Portalı en son sürümdedir."}
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition mx-auto block"
                >
                  Tamam
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

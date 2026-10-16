import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Rocket,
  CheckCircle2,
  AlertCircle,
  Archive,
  Clock,
  HardDrive,
  FileCheck,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Copy,
  Check,
  FolderArchive,
  Layers,
} from "lucide-react";
import { StagedReleaseInfo, PublishReleaseResult, R2BackupGroup } from "./types";
import packageJson from "../../../package.json";
import { playSuccessChime } from "../../utils/audio";

interface ReleaseHubPageProps {
  sessionToken: string | null;
  role: string | null;
  onOpenAuthModal?: () => void;
}

export const ReleaseHubPage: React.FC<ReleaseHubPageProps> = ({
  sessionToken,
  role,
  onOpenAuthModal,
}) => {
  const [stagedInfo, setStagedInfo] = useState<StagedReleaseInfo | null>(null);
  const [backups, setBackups] = useState<R2BackupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishReleaseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [targetVersion, setTargetVersion] = useState(packageJson.version || "0.2.16");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const isSuperAdmin = role === "super_admin";

  // Calculate next patch and minor based on current version
  const currentVer = packageJson.version || "0.2.16";
  const parts = currentVer.split(".").map((n) => parseInt(n, 10) || 0);
  const nextPatch = `${parts[0] || 0}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
  const nextMinor = `${parts[0] || 0}.${(parts[1] || 0) + 1}.0`;

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const staged: StagedReleaseInfo = await invoke("get_staged_release_info", {
        sessionToken,
      });
      setStagedInfo(staged);
      if (!notes) {
        setNotes(
          staged.notes ||
            `GUNNERIUS v${targetVersion} - Performans iyileştirmeleri, güvenlik güncellemeleri ve sistem optimizasyonları.`
        );
      }
      if (staged.version && staged.version !== "0.1.1" && staged.version !== "0.1.2") {
        setTargetVersion(staged.version);
      }

      try {
        const backupList: R2BackupGroup[] = await invoke("list_r2_backups", {
          sessionToken,
        });
        setBackups(backupList);
      } catch (backupErr) {
        console.warn("R2 yedek listesi henüz alınamadı:", backupErr);
      }
    } catch (err: any) {
      console.error("Sürüm bilgileri alınamadı:", err);
      setErrorMsg(
        typeof err === "string" ? err : "Sürüm bilgileri yüklenirken bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken]);

  const handlePublish = async () => {
    if (!isSuperAdmin) {
      alert("Bu işlem yalnızca Süper Yönetici tarafından gerçekleştirilebilir.");
      return;
    }

    const effectiveVer = targetVersion.trim() || stagedInfo?.version || currentVer;

    const confirmMsg =
      `GUNNERIUS v${effectiveVer} sürümünü Cloudflare R2'ye canlı olarak yayınlamak ve tarih-saat ile yedeklemek istiyor musunuz?\n\n` +
      `• Canlı Manifesto: https://indir.turkceyama.org/updates/latest.json\n` +
      `• R2 Arşiv: backups/updates/YYYY-MM-DD_HH-mm_v${effectiveVer}/`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setPublishing(true);
    setErrorMsg(null);
    setPublishResult(null);

    try {
      const res: PublishReleaseResult = await invoke("publish_release_to_r2", {
        sessionToken,
        notes: notes.trim(),
        version: effectiveVer,
      });
      setPublishResult(res);
      playSuccessChime();

      setTimeout(() => {
        loadData();
      }, 1500);
    } catch (err: any) {
      console.error("Yayınlama hatası:", err);
      setErrorMsg(
        typeof err === "string" ? err : "Yayınlama işlemi sırasında bir hata oluştu."
      );
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-16 text-center text-gray-500">
        <ShieldAlert className="w-12 h-12 mx-auto text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-300">Yetkisiz Erişim</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          Sürüm ve Dağıtım Merkezi yalnızca <strong>Süper Yönetici</strong> yetkisine sahip kullanıcılar tarafından görüntülenebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* ÜST BAŞLIK & YENİLE */}
      <div className="flex items-center justify-between border-b border-[#2b303c] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <span className="w-2.5 h-7 bg-[#d4af37] rounded-full inline-block"></span>
              Sürüm & Dağıtım Merkezi
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 font-mono">
              v{currentVer}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Tek tıkla Cloudflare R2'ye imzalı güncelleme paketi yayınlayın, arşivleyin ve canlıya alın
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading || publishing}
          className="flex items-center gap-2 px-4 py-2 bg-[#181d28] hover:bg-[#232a3b] border border-[#2b364a] text-xs text-gray-300 hover:text-white rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#d4af37]" : ""}`} />
          <span>Durumu Yenile</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-600/40 rounded-2xl flex items-center justify-between gap-4 text-rose-300 text-xs">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-200">İşlem Başarısız</div>
              <div className="mt-0.5 leading-relaxed">{errorMsg}</div>
            </div>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-2 bg-[#d4af37] text-black font-bold rounded-xl text-xs hover:bg-[#e5c148] transition shrink-0 cursor-pointer shadow"
            >
              Yetkili Girişi Yap
            </button>
          )}
        </div>
      )}

      {/* BAŞARILI YAYIN BİLDİRİM KARTI */}
      {publishResult && (
        <div className="p-5 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-300">
                v{publishResult.version} Başarıyla Canlıya Alındı ve R2'ye Arşivlendi!
              </h3>
              <p className="text-xs text-emerald-400/80">
                Tüm yöneticilerin stüdyolarında otomatik güncelleme bildirimi belirecektir.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 bg-[#12161f] rounded-xl border border-emerald-500/20">
              <span className="text-gray-400 block text-[11px]">Canlı Güncelleme Manifestosu:</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-white font-mono truncate">{publishResult.active_manifest_url}</span>
                <button
                  onClick={() => copyToClipboard(publishResult.active_manifest_url, "man")}
                  className="p-1 hover:text-[#d4af37] text-gray-400 cursor-pointer"
                  title="Kopyala"
                >
                  {copiedUrl === "man" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-[#12161f] rounded-xl border border-emerald-500/20">
              <span className="text-gray-400 block text-[11px]">Arşiv Klasörü:</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-emerald-300 font-mono truncate">{publishResult.backup_folder}</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded">
                  Kaydedildi
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 ADET SADE DURUM KARTI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KART 1: HAZIR DAĞITIM PAKETİ */}
        <div className="p-5 bg-[#14171e] border border-[#2b303c] rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-[#d4af37]" />
              Yerel Dağıtım Paketi
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 font-mono">
              v{stagedInfo?.version || currentVer}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Dosya:</span>
              <span className="text-white font-mono font-medium truncate max-w-[170px]" title={stagedInfo?.exe_name}>
                {stagedInfo?.exe_name || "Hazır"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Boyut:</span>
              <span className="text-white font-mono">{stagedInfo?.exe_size_formatted || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">İmza Durumu:</span>
              {stagedInfo?.signature_present ? (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Minisign Geçerli
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  İmza Hazır
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KART 2: CANLI CLOUDFLARE R2 DURUMU */}
        <div className="p-5 bg-[#14171e] border border-[#2b303c] rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              Canlı R2 Dağıtımı
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-mono">
              v{stagedInfo?.live_info?.version || currentVer}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">CDN URL:</span>
              <span className="text-white font-mono truncate max-w-[170px]">indir.turkceyama.org</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Uç Nokta:</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Aktif & Yayında
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Kanal:</span>
              <span className="text-sky-300 font-mono text-[11px]">Production (Canlı)</span>
            </div>
          </div>
        </div>

        {/* KART 3: ARŞİVLEME & YEDEK MOTORU */}
        <div className="p-5 bg-[#14171e] border border-[#2b303c] rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-purple-400" />
              R2 Sürüm Arşivi
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 font-mono">
              {backups.length} Sürüm Yedeği
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Hedef Klasör:</span>
              <span className="text-white font-mono">backups/updates/</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Format:</span>
              <span className="text-purple-300 font-mono text-[11px]">Tarih_Saat_vSürüm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Geri Alma:</span>
              <span className="text-emerald-400 text-[11px]">Anında İndirilebilir</span>
            </div>
          </div>
        </div>
      </div>

      {/* SADE VE GELİŞMİŞ YAYINLAMA KONTROL PANELİ */}
      <div className="bg-[#14171e] border border-[#2b303c] rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sürüm Dağıtım Notları & Yayın Kontrolü</h2>
              <p className="text-xs text-gray-400">
                Hedef sürüm numarasını belirleyin ve kullanıcılara gösterilecek yenilik notlarını düzenleyin
              </p>
            </div>
          </div>

          {/* HIZLI SÜRÜM SEÇİCİ */}
          <div className="flex items-center gap-2 bg-[#0f1115] p-2 rounded-xl border border-[#2b303c]">
            <span className="text-xs text-gray-400 font-medium">Hedef:</span>
            <input
              type="text"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="w-20 bg-[#161a24] border border-[#d4af37]/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-[#d4af37] focus:outline-none focus:border-[#d4af37] text-center"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTargetVersion(nextPatch)}
                className="px-2.5 py-1 rounded-lg bg-[#1e2330] hover:bg-[#2a3142] text-[10px] font-mono text-gray-300 hover:text-white transition cursor-pointer border border-[#2d374a]"
                title="Sonraki Yama Sürümü"
              >
                v{nextPatch}
              </button>
              <button
                type="button"
                onClick={() => setTargetVersion(nextMinor)}
                className="px-2.5 py-1 rounded-lg bg-[#1e2330] hover:bg-[#2a3142] text-[10px] font-mono text-gray-300 hover:text-white transition cursor-pointer border border-[#2d374a]"
                title="Sonraki Minör Sürüm"
              >
                v{nextMinor}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-300 block mb-2 font-medium">
            Kullanıcı Bildirim Penceresinde Gözükecek Güncelleme Notları:
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Sürüm notlarını yazın (örn: • Hızlı Komut Paleti eklendi...)"
            className="w-full bg-[#0d1017] border border-[#2b303c] rounded-xl p-3.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#d4af37] font-sans leading-relaxed"
          />
        </div>

        {/* EYLEM VE YAYINLAMA BUTONU */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Yayınlama esnasında Minisign imza doğrulaması ve R2 zaman damgalı arşivleme otomatik çalışır.</span>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing || loading}
            className="w-full sm:w-auto px-7 py-3 bg-[#d4af37] hover:bg-[#b58223] text-black font-bold text-xs rounded-xl shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50"
          >
            {publishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Cloudflare R2'ye Canlı Yayınlanıyor...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Tek Tıkla R2'ye Canlı Yayınla & Arşivle</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* R2 SÜRÜM & YEDEK ARŞİV GEÇMİŞİ */}
      <div className="bg-[#14171e] border border-[#2b303c] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#2b303c] pb-3">
          <div className="flex items-center gap-2.5">
            <FolderArchive className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Cloudflare R2 Sürüm Arşivi</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {backups.length} Arşiv Kaydı
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center bg-[#0e1118] border border-[#1e232e] rounded-xl text-xs text-gray-500">
            <Clock className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            Henüz Cloudflare R2'de arşivlenmiş eski sürüm yedeği bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((grp) => (
              <div
                key={grp.folder_name}
                className="p-4 bg-[#0e1118] border border-[#222733] hover:border-[#353d4f] rounded-xl transition space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {grp.timestamp}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 font-mono">
                      v{grp.version}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    Toplam: {grp.total_size_formatted}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                  {grp.files.map((f) => (
                    <a
                      key={f.key}
                      href={f.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-[#141822] hover:bg-[#1a202e] border border-[#262c3a] hover:border-[#d4af37]/40 rounded-lg text-xs flex items-center justify-between text-gray-300 hover:text-white transition group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                        <span className="truncate text-[11px] font-mono">{f.file_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] text-gray-500 font-mono">{f.size_formatted}</span>
                        <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-[#d4af37]" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

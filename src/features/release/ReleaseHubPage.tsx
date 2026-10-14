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

interface ReleaseHubPageProps {
  sessionToken: string | null;
  role: string | null;
  onOpenAuthModal?: () => void;
}

export const ReleaseHubPage: React.FC<ReleaseHubPageProps> = ({ sessionToken, role, onOpenAuthModal }) => {
  const [stagedInfo, setStagedInfo] = useState<StagedReleaseInfo | null>(null);
  const [backups, setBackups] = useState<R2BackupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishReleaseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [targetVersion, setTargetVersion] = useState("0.1.2");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const isSuperAdmin = role === "super_admin";

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Hazır dağıtım paketi bilgilerini çek
      const staged: StagedReleaseInfo = await invoke("get_staged_release_info", {
        sessionToken,
      });
      setStagedInfo(staged);
      if (!notes) {
        setNotes(staged.notes);
      }
      if (staged.version && staged.version === "0.1.1") {
        setTargetVersion("0.1.2");
      } else if (staged.version) {
        setTargetVersion(staged.version);
      }

      // 2. R2 üzerindeki arşiv/yedek listesini çek
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
      setErrorMsg(typeof err === "string" ? err : "Sürüm bilgileri yüklenirken bir hata oluştu.");
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

    const effectiveVer = targetVersion.trim() || stagedInfo?.version || "0.1.2";

    const confirmMsg =
      `GUNNERIUS v${effectiveVer} sürümünü Cloudflare R2'ye canlı olarak yayınlamak ve tarih-saat ile yedeklemek istediğinize emin misiniz?\n\n` +
      `• Canlı Güncelleme: https://indir.turkceyama.org/updates/latest.json\n` +
      `• R2 Arşiv & Yedek: backups/updates/YYYY-MM-DD_HH-mm_v${effectiveVer}/`;

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

      // Listeyi ve canlı durum bilgisini tazele
      setTimeout(() => {
        loadData();
      }, 1500);
    } catch (err: any) {
      console.error("Yayınlama hatası:", err);
      setErrorMsg(typeof err === "string" ? err : "Yayınlama işlemi sırasında bir hata oluştu.");
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
          Sürüm ve Dağıtım Merkezi yalnızca <strong>Süper Yönetici</strong> yetkisine sahip kullanıcılar tarafından görüntülenebilir ve çalıştırılabilir.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* BAŞLIK & YENİLE */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Rocket className="w-6 h-6 text-[#d4af37]" />
              Sürüm & Dağıtım Merkezi (Release Hub)
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
              Süper Admin Özel
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Uygulama üzerinden tek tıkla Cloudflare R2'ye güncelleme paketi yayınlayın ve her sürümü tarih-saat damgasıyla otomatik arşivleyin.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading || publishing}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#181d28] hover:bg-[#232a3b] border border-[#2b364a] text-xs text-gray-300 hover:text-white rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#d4af37]" : ""}`} />
          <span>Yenile</span>
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

      {/* BAŞARILI YAYINLAMA BİLDİRİM KARTI */}
      {publishResult && (
        <div className="p-5 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-300">
                Sürüm Başarıyla Yayınlandı ve Cloudflare R2'ye Arşivlendi!
              </h3>
              <p className="text-xs text-emerald-400/80">
                v{publishResult.version} paketi canlıya alındı. Arşiv damgası:{" "}
                <span className="font-mono font-bold text-white">{publishResult.timestamp}</span>
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
                  className="p-1 hover:text-[#d4af37] text-gray-400"
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
              <span className="text-gray-400 block text-[11px]">Tarih-Saat Arşiv Klasörü:</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-emerald-300 font-mono truncate">{publishResult.backup_folder}</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded">
                  Yedeklendi
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DURUM KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KART 1: HAZIR DAĞITIM PAKETİ */}
        <div className="p-5 bg-[#14171e] border border-[#2b303c] rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-[#d4af37]" />
              Yerel Dağıtım Paketi
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
              v{stagedInfo?.version || "..."}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Dosya:</span>
              <span className="text-white font-mono font-medium truncate max-w-[170px]" title={stagedInfo?.exe_name}>
                {stagedInfo?.exe_name || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Boyut:</span>
              <span className="text-white font-mono">{stagedInfo?.exe_size_formatted || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Dijital İmza:</span>
              {stagedInfo?.signature_present ? (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Minisign Onaylı
                </span>
              ) : (
                <span className="text-amber-400 text-[11px]">İmza Dosyası Yok</span>
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
            {stagedInfo?.live_info?.is_live ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                v{stagedInfo.live_info.version || "Aktif"}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/30">
                Dağıtım Yok
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Alan Adı:</span>
              <span className="text-white font-mono">indir.turkceyama.org</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Durum:</span>
              <span className="text-sky-300 font-medium">
                {stagedInfo?.live_info?.is_live ? "Canlıda Erişilebilir" : "İlk Dağıtım Bekleniyor"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Sürüm Eşleşmesi:</span>
              {stagedInfo?.live_info?.version === stagedInfo?.version ? (
                <span className="text-emerald-400 text-[11px] font-medium">Canlı Sürümle Eşleşiyor</span>
              ) : (
                <span className="text-amber-400 text-[11px] font-medium">Yeni Sürüm Yayına Hazır</span>
              )}
            </div>
          </div>
        </div>

        {/* KART 3: ARŞİVLEME & YEDEK MOTORU */}
        <div className="p-5 bg-[#14171e] border border-[#2b303c] rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-purple-400" />
              R2 Arşivleme & Yedek
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
              {backups.length} Yedek Kaydı
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Hedef Klasör:</span>
              <span className="text-white font-mono">backups/updates/</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Arşiv Formatı:</span>
              <span className="text-purple-300 font-mono text-[11px]">Tarih_Saat_vSürüm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Geri Alma:</span>
              <span className="text-gray-400 text-[11px]">İstediğin an indirilebilir</span>
            </div>
          </div>
        </div>
      </div>

      {/* YAYINLAMA KONTROL PANELİ */}
      <div className="bg-[#14171e] border border-[#2b303c] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2b303c] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Sürüm Dağıtım Notları & Hedef Sürüm</h2>
              <p className="text-xs text-gray-400">
                Kullanıcıların güncelleme bildirim penceresinde göreceği yenilikleri ve yayınlanacak sürüm numarasını belirleyin.
              </p>
            </div>
          </div>

          {/* Sürüm Düzenleme Girişi */}
          <div className="flex items-center gap-2 bg-[#0d1017] p-2 rounded-xl border border-[#2b303c]">
            <span className="text-[11px] text-gray-400 font-medium">Hedef Sürüm:</span>
            <input
              type="text"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              placeholder="0.1.2"
              className="w-20 bg-[#161a24] border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 text-center"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTargetVersion("0.1.2")}
                className="px-2 py-1 rounded bg-[#1e2330] hover:bg-[#2a3142] text-[10px] font-mono text-gray-300 transition cursor-pointer"
                title="Yama Sürümü (Önerilen)"
              >
                v0.1.2
              </button>
              <button
                type="button"
                onClick={() => setTargetVersion("0.2.0")}
                className="px-2 py-1 rounded bg-[#1e2330] hover:bg-[#2a3142] text-[10px] font-mono text-gray-300 transition cursor-pointer"
                title="Minör Yeni Sürüm"
              >
                v0.2.0
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-gray-400 block mb-1.5 font-medium">
            Güncelleme Notları (Kullanıcıların Ekranında Çıkacak Metin):
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Sürüm notlarını yazın (örn: • Canlı XenForo API entegrasyonu...)"
            className="w-full bg-[#0d1017] border border-[#2b303c] rounded-xl p-3.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#d4af37] font-sans leading-relaxed"
          />
        </div>

        {/* REHBER KUTUSU: ADIM ADIM NASIL ÇALIŞIR */}
        <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl text-xs space-y-1.5 text-indigo-200/90">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <span>💡 Basit Yayınlama ve Güncelleme Akışı:</span>
          </div>
          <div className="text-[11px] text-gray-300 space-y-1">
            <p>1. <strong>Hedef Sürüm</strong> alanına bir sonraki sürüm numarasını yazın (örn: <code className="text-amber-300 font-mono">0.1.2</code>). Karşı bilgisayarda güncelleme uyarısının çıkması için bu numaranın kurulu sürümden büyük olması şarttır.</p>
            <p>2. <strong>Güncelleme Notları</strong> kutusuna personellerin ve üyelerin göreceği yenilik maddelerini yazın.</p>
            <p>3. <strong>"Tek Tıkla R2'ye Yayınla & Arşivle"</strong> butonuna basın. Dosyalar anında Cloudflare R2'ye yüklenir ve arşivlenir.</p>
            <p>4. <strong>Diğer bilgisayarda</strong> uygulamayı açtığınız anda ekranda otomatik olarak <em>"Lütfen Sürümü Güncelle"</em> uyarısı ve indirme çubuğu çıkacaktır.</p>
          </div>
        </div>

        {/* EYLEM VE DOĞRULAMA BUTONU */}
        <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Kurulum paketi (<span className="font-mono text-gray-300">{stagedInfo?.exe_name}</span>) ve dijital imzası hazır.
              </span>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Yayın anında <span className="font-mono text-gray-300">backups/updates/</span> altına tarih-saat etiketiyle yedeklenecek.
              </span>
            </div>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing || loading || !stagedInfo}
            className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-[#d4af37] to-[#b38e22] hover:from-[#e5c148] hover:to-[#c49f33] text-black font-bold text-xs rounded-xl shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50"
          >
            {publishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Cloudflare R2'ye Yükleniyor & Arşivleniyor...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Tek Tıkla R2'ye Yayınla & Arşivle</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* R2 ARŞİV & YEDEKLEME GEÇMİŞİ */}
      <div className="bg-[#14171e] border border-[#2b303c] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderArchive className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">R2 Sürüm & Yedekleme Arşivi</h2>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {backups.length} Tarihli Yedek Bulundu
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center bg-[#0e1118] border border-[#1e232e] rounded-xl text-xs text-gray-500">
            <Clock className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            Henüz Cloudflare R2'de arşivlenmiş eski sürüm yedeği bulunmuyor.
            <div className="text-[11px] text-gray-600 mt-1">
              "Tek Tıkla R2'ye Yayınla & Arşivle" butonuna bastığınızda her sürüm tarih-saat ile buraya kaydedilecektir.
            </div>
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
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
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

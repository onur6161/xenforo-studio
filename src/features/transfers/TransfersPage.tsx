import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowDownUp,
  Play,
  Pause,
  X,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Activity,
  HardDrive,
  Folder,
  Search,
  ShieldAlert,
  Radio,
  Globe,
} from "lucide-react";
import { TransferQueueResponse } from "./types";

interface TransfersPageProps {
  sessionToken: string | null;
  role: string | null;
  onNavigateToR2?: (folderKey?: string) => void;
}

export const getProviderBadge = (provider?: string) => {
  switch (provider) {
    case "gdrive":
      return {
        name: "Google Drive",
        badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      };
    case "yandex":
      return {
        name: "Yandex Disk",
        badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      };
    case "mediafire":
      return {
        name: "MediaFire",
        badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      };
    default:
      return {
        name: "Doğrudan İndirme",
        badge: "bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40",
      };
  }
};

export const detectUrlProvider = (url: string) => {
  const lower = url.trim().toLowerCase();
  if (lower.includes("drive.google.com") || lower.includes("docs.google.com")) {
    return {
      type: "gdrive",
      title: "Google Drive Doğrudan Çözücü Aktif",
      desc: "Büyük dosya virüs taraması onayı otomatik geçilecek, dosya fiziksel olarak R2'ye akıtılacaktır.",
      color: "border-blue-500/50 bg-blue-950/30 text-blue-300",
      supported: true,
    };
  }
  if (lower.includes("disk.yandex") || lower.includes("yadi.sk")) {
    return {
      type: "yandex",
      title: "Yandex Disk API Çözücü Aktif",
      desc: "Resmi Yandex Cloud API üzerinden yüksek hızlı CDN doğrudan indirme akışı başlatılacaktır.",
      color: "border-rose-500/50 bg-rose-950/30 text-rose-300",
      supported: true,
    };
  }
  if (lower.includes("mediafire.com")) {
    return {
      type: "mediafire",
      title: "MediaFire Akış Çözücü Aktif",
      desc: "MediaFire web sayfası çözümlenerek doğrudan indirme butonu bağlantısı yakalanacaktır.",
      color: "border-cyan-500/50 bg-cyan-950/30 text-cyan-300",
      supported: true,
    };
  }
  if (lower.includes("mega.nz")) {
    return {
      type: "mega",
      title: "MEGA Desteklenmiyor",
      desc: "MEGA uçtan uca şifreleme ve günlük IP indirme kotası uyguladığı için desteklenmemektedir. Lütfen Google Drive, Yandex veya MediaFire kullanın.",
      color: "border-amber-500/50 bg-amber-950/40 text-amber-300",
      supported: false,
    };
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return {
      type: "direct",
      title: "Doğrudan İndirme Bağlantısı",
      desc: "Uzak sunucudan 16 MB'lık S3 blokları ile doğrudan Cloudflare R2'ye aktarılacaktır.",
      color: "border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37]",
      supported: true,
    };
  }
  return null;
};

export const TransfersPage: React.FC<TransfersPageProps> = ({
  sessionToken,
  role,
  onNavigateToR2,
}) => {
  const [queueData, setQueueData] = useState<TransferQueueResponse>({
    jobs: [],
    stats: {
      active_count: 0,
      queued_count: 0,
      completed_count: 0,
      failed_count: 0,
      total_transferred_bytes: 0,
      current_bandwidth_mbps: 0,
    },
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Yeni aktarım formu
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState<string>("yamalar/");

  const isAdmin = role === "super_admin" || role === "admin";

  const fetchQueue = async () => {
    try {
      const res = await invoke<TransferQueueResponse>("get_transfer_queue");
      setQueueData(res);
    } catch (err) {
      console.error("Kuyruk yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Tauri canlı olay dinleyicisi
    let unlistenFn: (() => void) | null = null;
    listen<TransferQueueResponse>("transfer-queue-update", (event) => {
      setQueueData(event.payload);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    // Periyodik yedek sorgu (her 5 sn)
    const interval = setInterval(fetchQueue, 5000);

    return () => {
      if (unlistenFn) unlistenFn();
      clearInterval(interval);
    };
  }, []);

  const handleStartTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) {
      setFeedbackMsg({ type: "error", text: "Lütfen geçerli bir indirme URL'si girin." });
      return;
    }

    const detected = detectUrlProvider(sourceUrl);
    if (detected && !detected.supported) {
      setFeedbackMsg({
        type: "error",
        text: "MEGA bağlantıları şifreli aktarım ve günlük indirme kotası nedeniyle desteklenmemektedir. Lütfen Google Drive, Yandex Disk veya MediaFire kullanın.",
      });
      return;
    }

    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      const cleanFolder = targetFolder.trim();
      const targetPrefix = cleanFolder.endsWith("/") || cleanFolder === "" ? cleanFolder : `${cleanFolder}/`;

      await invoke("add_remote_transfer", {
        sessionToken,
        sourceUrl: sourceUrl.trim(),
        targetKey: targetPrefix,
        customName: customName.trim() ? customName.trim() : null,
      });

      setFeedbackMsg({
        type: "success",
        text: "Aktarım kuyruğa alındı ve bellek akışı arka planda başlatıldı.",
      });
      setSourceUrl("");
      setCustomName("");
      setIsModalOpen(false);
      fetchQueue();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: typeof err === "string" ? err : err?.message || "Aktarım başlatılamadı.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      await invoke("pause_transfer_job", { sessionToken, jobId });
      fetchQueue();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: String(err) });
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      await invoke("resume_transfer_job", { sessionToken, jobId });
      fetchQueue();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: String(err) });
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await invoke("cancel_transfer_job", { sessionToken, jobId });
      fetchQueue();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: String(err) });
    }
  };

  const handleClearCompleted = async () => {
    try {
      const res = await invoke<TransferQueueResponse>("clear_completed_transfers", { sessionToken });
      setQueueData(res);
      setFeedbackMsg({ type: "success", text: "Tamamlanan aktarımlar kuyruktan temizlendi." });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: String(err) });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = 2;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatSeconds = (sec: number): string => {
    if (!sec || sec <= 0) return "--";
    if (sec < 60) return `${sec} sn`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (min < 60) return `${min} dk ${remSec > 0 ? `${remSec} sn` : ""}`;
    const hours = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hours} sa ${remMin} dk`;
  };

  const filteredJobs = queueData.jobs.filter((j) => {
    if (filterStatus !== "all" && j.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        j.name.toLowerCase().includes(term) ||
        j.target_key.toLowerCase().includes(term) ||
        j.source_url.toLowerCase().includes(term)
      );
    }
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="p-16 text-center text-gray-500">
        <ShieldAlert className="w-12 h-12 mx-auto text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-300">Yetkisiz Erişim</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          Aktarım Kuyruğu ve Cloudflare R2 doğrudan akış motorunu kullanmak için Yönetici yetkisi gereklidir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. ÜST BAŞLIK VE EYLEMLER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2b303c]/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-[#d4af37] shadow-inner">
              <ArrowDownUp className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-wide">
                  Aktarım Kuyruğu & Senkronizasyon
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-400">
                  FAZ 2 CANLI
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Sıfır yerel disk alanı ile doğrudan uzak URL'den Cloudflare R2'ye S3 multipart akışı (16 MB Stream Buffer).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setLoading(true);
              fetchQueue();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1f29] border border-[#2b303c] text-gray-300 hover:text-white hover:border-gray-500 transition cursor-pointer"
            title="Listeyi Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#d4af37]" : ""}`} />
            Yenile
          </button>

          {queueData.jobs.some((j) => j.status === "completed" || j.status === "failed") && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1f29] border border-[#2b303c] text-gray-400 hover:text-rose-400 hover:border-rose-500/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Temizle
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#d4af37] hover:bg-[#c5a030] text-black shadow-lg shadow-[#d4af37]/20 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Yeni Uzak Aktarım
          </button>
        </div>
      </div>

      {/* GERİ BİLDİRİM BANNER */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. KPI / METRİK KARTLARI (4'LÜ PANEL) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aktif İşler */}
        <div className="p-4 rounded-2xl bg-[#14171e] border border-[#2b303c] relative overflow-hidden group hover:border-[#d4af37]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Aktif Aktarımlar
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              queueData.stats.active_count > 0
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-gray-800/50 text-gray-400"
            }`}>
              <Activity className={`w-4 h-4 ${queueData.stats.active_count > 0 ? "animate-pulse" : ""}`} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {queueData.stats.active_count}
            </span>
            <span className="text-xs text-gray-400">işlem canlı akıyor</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-400" />
            S3 Multipart Pipeline
          </div>
        </div>

        {/* Canlı Bant Genişliği */}
        <div className="p-4 rounded-2xl bg-[#14171e] border border-[#2b303c] relative overflow-hidden group hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Anlık Akış Hızı
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-300 font-mono">
              {queueData.stats.current_bandwidth_mbps.toFixed(2)}
            </span>
            <span className="text-xs text-gray-400 font-mono">MB/s</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500">
            {queueData.stats.active_count > 0 ? "Maksimum TCP throughput devrede" : "Aktarım bekleniyor"}
          </div>
        </div>

        {/* Kuyrukta Bekleyenler */}
        <div className="p-4 rounded-2xl bg-[#14171e] border border-[#2b303c] relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Bekleyen Kuyruk
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300 font-mono">
              {queueData.stats.queued_count}
            </span>
            <span className="text-xs text-gray-400">sırada</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500">
            Sıralı otomatik worker havuzu
          </div>
        </div>

        {/* Tamamlanan / Aktarılan Veri */}
        <div className="p-4 rounded-2xl bg-[#14171e] border border-[#2b303c] relative overflow-hidden group hover:border-purple-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Aktarılan Toplam Veri
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-300 font-mono">
              {formatBytes(queueData.stats.total_transferred_bytes)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            {queueData.stats.completed_count} başarılı dosya
          </div>
        </div>
      </div>

      {/* 3. FİLTRE VE ARAMA ÇUBUĞU */}
      <div className="p-3 bg-[#14171e] rounded-2xl border border-[#2b303c] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "Tümü", count: queueData.jobs.length },
            { id: "running", label: "Aktif Akış", count: queueData.jobs.filter((j) => j.status === "running").length },
            { id: "queued", label: "Kuyrukta", count: queueData.jobs.filter((j) => j.status === "queued").length },
            { id: "paused", label: "Duraklatılan", count: queueData.jobs.filter((j) => j.status === "paused").length },
            { id: "completed", label: "Tamamlanan", count: queueData.jobs.filter((j) => j.status === "completed").length },
            { id: "failed", label: "Hatalı", count: queueData.jobs.filter((j) => j.status === "failed").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                filterStatus === tab.id
                  ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/40 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-[#1a1f29] border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                filterStatus === tab.id
                  ? "bg-[#d4af37]/25 text-[#d4af37]"
                  : "bg-gray-800 text-gray-400"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Dosya veya URL ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#101319] border border-[#2b303c] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37] transition font-sans"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4. KUYRUK VE AKTARIM LİSTESİ */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#14171e] border border-[#2b303c] text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-800/40 border border-gray-700/50 mx-auto flex items-center justify-center text-gray-500 mb-3">
              <ArrowDownUp className="w-6 h-6 opacity-60" />
            </div>
            <h3 className="text-sm font-bold text-gray-300">
              {searchTerm || filterStatus !== "all"
                ? "Arama kriterlerine uygun aktarım bulunamadı"
                : "Aktarım kuyruğu boş"}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchTerm || filterStatus !== "all"
                ? "Farklı bir filtre seçebilir veya arama terimini temizleyebilirsiniz."
                : "Uzak bir web sunucusundan doğrudan Cloudflare R2'ye dosya aktarmak için 'Yeni Uzak Aktarım' butonunu kullanın."}
            </p>
            {!searchTerm && filterStatus === "all" && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#d4af37] text-black hover:bg-[#c5a030] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                İlk Aktarımı Başlat
              </button>
            )}
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isRunning = job.status === "running";
            const isPaused = job.status === "paused";
            const isQueued = job.status === "queued";
            const isCompleted = job.status === "completed";
            const isFailed = job.status === "failed";
            const isCancelled = job.status === "cancelled";

            return (
              <div
                key={job.id}
                className={`p-4 rounded-2xl bg-[#14171e] border transition-all ${
                  isRunning
                    ? "border-[#d4af37]/50 shadow-lg shadow-[#d4af37]/5 bg-gradient-to-r from-[#14171e] to-[#181d27]"
                    : "border-[#2b303c] hover:border-gray-600"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Sol Taraf: Dosya Bilgisi & İkon */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                        isRunning
                          ? "bg-amber-500/15 border-amber-500/40 text-[#d4af37]"
                          : isCompleted
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : isFailed
                          ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                          : isPaused
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-gray-800/60 border-gray-700 text-gray-400"
                      }`}
                    >
                      {isRunning ? (
                        <Activity className="w-5 h-5 animate-pulse" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isFailed ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : isPaused ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Sağlayıcı Rozeti */}
                        {(() => {
                          const prov = getProviderBadge(job.provider);
                          return (
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${prov.badge}`}
                            >
                              {prov.name}
                            </span>
                          );
                        })()}

                        <span className="font-bold text-sm text-white truncate max-w-md font-mono">
                          {job.name}
                        </span>

                        {/* Durum Rozeti */}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isRunning
                              ? "bg-amber-950/60 text-[#d4af37] border-[#d4af37]/40 animate-pulse"
                              : isCompleted
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                              : isFailed
                              ? "bg-rose-950/60 text-rose-300 border-rose-500/40"
                              : isPaused
                              ? "bg-amber-950/40 text-amber-400 border-amber-500/30"
                              : isCancelled
                              ? "bg-gray-800 text-gray-400 border-gray-700"
                              : "bg-gray-800 text-gray-300 border-gray-700"
                          }`}
                        >
                          {isRunning
                            ? "AKTARIYOR"
                            : isCompleted
                            ? "TAMAMLANDI"
                            : isFailed
                            ? "HATA OLUŞTU"
                            : isPaused
                            ? "DURAKLATILDI"
                            : isCancelled
                            ? "İPTAL EDİLDİ"
                            : "KUYRUKTA"}
                        </span>
                      </div>

                      {/* Canlı Aşama Bildirimi (Stage) */}
                      {job.stage && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-300/90 font-mono">
                          {isRunning ? (
                            <Zap className="w-3.5 h-3.5 text-[#d4af37] animate-pulse shrink-0" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}
                          <span className="truncate">{job.stage}</span>
                        </div>
                      )}

                      {/* URL ve Hedef Konum */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1 font-mono text-[11px] text-gray-400 truncate max-w-sm">
                          <ExternalLink className="w-3 h-3 shrink-0 text-gray-500" />
                          <span className="truncate">{job.source_url}</span>
                        </span>
                        <span className="text-gray-600">➔</span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-amber-300/80">
                          <Folder className="w-3 h-3 shrink-0 text-[#d4af37]" />
                          {job.target_key}
                        </span>
                      </div>

                      {/* Hata Mesajı Varsa */}
                      {job.error_message && (
                        <div className="mt-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-500/30 rounded-lg p-2 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{job.error_message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sağ Taraf: Hız, ETA ve Eylemler */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#2b303c]/60">
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-gray-200">
                        {formatBytes(job.transferred_bytes)}
                        {job.total_bytes > 0 && ` / ${formatBytes(job.total_bytes)}`}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center justify-end gap-2 mt-0.5 font-mono">
                        {isRunning && (
                          <>
                            <span className="text-cyan-400 font-bold flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {job.speed_mbps.toFixed(2)} MB/s
                            </span>
                            <span>•</span>
                            <span className="text-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatSeconds(job.eta_seconds)}
                            </span>
                          </>
                        )}
                        {isCompleted && (
                          <span className="text-emerald-400">{job.completed_at || "R2'de Aktif"}</span>
                        )}
                        {(isQueued || isPaused) && (
                          <span className="text-gray-500">{job.created_at}</span>
                        )}
                      </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRunning && (
                        <button
                          onClick={() => handlePause(job.id)}
                          className="p-2 rounded-xl bg-[#1b202a] border border-[#2b303c] text-gray-300 hover:text-amber-400 hover:border-amber-500/40 transition cursor-pointer"
                          title="Duraklat"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isPaused && (
                        <button
                          onClick={() => handleResume(job.id)}
                          className="p-2 rounded-xl bg-[#1b202a] border border-[#2b303c] text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500/40 transition cursor-pointer"
                          title="Devam Et"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(isRunning || isQueued || isPaused) && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="p-2 rounded-xl bg-[#1b202a] border border-[#2b303c] text-gray-400 hover:text-rose-400 hover:border-rose-500/40 transition cursor-pointer"
                          title="İptal Et"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isCompleted && (
                        <>
                          <button
                            onClick={() =>
                              copyToClipboard(`https://indir.turkceyama.org/${job.target_key}`, job.id)
                            }
                            className="p-2 rounded-xl bg-[#1b202a] border border-[#2b303c] text-gray-300 hover:text-[#d4af37] hover:border-[#d4af37]/40 transition cursor-pointer"
                            title="R2 İndirme Bağlantısını Kopyala"
                          >
                            {copiedId === job.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {onNavigateToR2 && (
                            <button
                              onClick={() => {
                                const folder = job.target_key.includes("/")
                                  ? job.target_key.substring(0, job.target_key.lastIndexOf("/") + 1)
                                  : "";
                                onNavigateToR2(folder);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold hover:bg-[#d4af37]/25 transition cursor-pointer flex items-center gap-1"
                              title="R2 Dosya Yöneticisinde Aç"
                            >
                              <Folder className="w-3.5 h-3.5" />
                              Dosyalara Git
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* İlerleme Çubuğu */}
                {(isRunning || isPaused || isCompleted) && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                      <span>Aktarım İlerlemesi</span>
                      <span className="font-bold text-white">
                        {isCompleted ? "100%" : `${job.percentage.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#101319] overflow-hidden border border-[#2b303c]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted
                            ? "bg-emerald-500"
                            : isPaused
                            ? "bg-amber-500"
                            : "bg-gradient-to-r from-amber-500 via-[#d4af37] to-cyan-400 animate-pulse"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, job.percentage))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. YENİ UZAK AKTARIM MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#14171e] border border-[#2b303c] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#2b303c] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
                  <ArrowDownUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Yeni Uzak Aktarım Başlat</h3>
                  <p className="text-xs text-gray-400">
                    Uzak sunucudan Cloudflare R2'ye doğrudan S3 bellek akışı (Zero Disk).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#1e232e] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartTransfer} className="space-y-4">
              {/* Kaynak URL */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Kaynak İndirme URL'si (HTTP / HTTPS) *</span>
                  <span className="text-[10px] text-gray-400 font-mono normal-case">
                    Google Drive • Yandex • MediaFire • Doğrudan
                  </span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/file/d/... veya https://disk.yandex.com.tr/d/... veya https://mediafire.com/file/..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full bg-[#101319] border border-[#2b303c] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37] font-mono transition"
                />

                {/* Akıllı Bağlantı Algılama Rozeti */}
                {(() => {
                  const detected = detectUrlProvider(sourceUrl);
                  if (!detected) {
                    return (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Google Drive, Yandex Disk, MediaFire veya doğrudan dosya indirme bağlantısı girin.
                      </p>
                    );
                  }

                  return (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${detected.color} animate-in fade-in duration-200`}
                    >
                      <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{detected.title}</span>
                          {!detected.supported && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/40">
                              Desteklenmiyor
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed font-sans">
                          {detected.desc}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Özel Dosya Adı (Opsiyonel) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Özel Dosya Adı (Opsiyonel)
                </label>
                <input
                  type="text"
                  placeholder="Boş bırakılırsa URL'deki orijinal isim kullanılır (örn: yama_v2.zip)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#101319] border border-[#2b303c] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37] font-sans transition"
                />
              </div>

              {/* Hedef R2 Klasörü */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Hedef R2 Klasörü / Ön Eki *
                </label>
                <input
                  type="text"
                  required
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  className="w-full bg-[#101319] border border-[#2b303c] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37] font-mono transition"
                />
                {/* Hızlı Klasör Butonları */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-gray-500">Hızlı Seçim:</span>
                  {["yamalar/", "yedekler/", "surumler/", "kurulumlar/"].map((folder) => (
                    <button
                      type="button"
                      key={folder}
                      onClick={() => setTargetFolder(folder)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-[#1b202a] border border-[#2b303c] text-gray-400 hover:text-white hover:border-[#d4af37]/40 transition cursor-pointer"
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              </div>

              {/* Güvenlik & Mimari Bilgi Kartı */}
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200/90">
                <Radio className="w-4 h-4 shrink-0 text-[#d4af37] mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-white block">Sıfır Yerel Disk Kullanımı</span>
                  <p className="text-[11px] leading-relaxed text-gray-300">
                    Aktarım doğrudan RAM belleğinde 16 MB'lık akış dilimlerine bölünür ve Cloudflare R2'ye eşzamanlı multipart yüklenir. Bilgisayarınızın SSD/HDD diskine devasa dosyalar yazılmaz ve yer kaplamaz.
                  </p>
                </div>
              </div>

              {/* Modal Butonları */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2b303c]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1b202a] border border-[#2b303c] text-gray-300 hover:text-white hover:border-gray-500 transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#d4af37] hover:bg-[#c5a030] text-black shadow-lg shadow-[#d4af37]/20 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Aktarım Başlatılıyor...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black" />
                      Aktarımı Başlat
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  Zap,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { TransferQueueResponse, TransferJob } from "../features/transfers/types";

interface FloatingTransferBarProps {
  currentTab: string;
  onNavigateTab: (tab: string) => void;
}

export const FloatingTransferBar: React.FC<FloatingTransferBarProps> = ({
  currentTab,
  onNavigateTab,
}) => {
  const [activeJob, setActiveJob] = useState<TransferJob | null>(null);
  const [completedJob, setCompletedJob] = useState<TransferJob | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // İlk kontrol
    invoke<TransferQueueResponse>("get_transfer_queue")
      .then((res) => handleUpdate(res))
      .catch(() => {});

    // Tauri canlı olay dinleyicisi
    let unlistenFn: (() => void) | null = null;
    listen<TransferQueueResponse>("transfer-queue-update", (event) => {
      handleUpdate(event.payload);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handleUpdate = (data: TransferQueueResponse) => {
    if (!data || !data.jobs) return;

    // Aktif çalışan işi bul
    const running = data.jobs.find((j) => j.status === "running" || j.status === "paused");
    if (running) {
      setActiveJob(running);
      setCompletedJob(null);
    } else {
      setActiveJob(null);
      // Son 15 saniyede bitmiş iş var mı kontrol et
      const justCompleted = data.jobs.find(
        (j) => j.status === "completed" && j.completed_at
      );
      if (justCompleted && !completedJob) {
        setCompletedJob(justCompleted);
        const timer = setTimeout(() => {
          setCompletedJob(null);
        }, 12000);
        return () => clearTimeout(timer);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Eğer zaten Aktarım Kuyruğu sayfasındaysak veya hiç iş yoksa gizle
  if (currentTab === "transfers" && !completedJob) {
    return null;
  }

  if (!activeJob && !completedJob) {
    return null;
  }

  const job = activeJob || completedJob;
  if (!job) return null;

  const isCompleted = job.status === "completed";
  const provider = job.provider || "direct";

  const getProviderInfo = () => {
    switch (provider) {
      case "gdrive":
        return {
          name: "Google Drive",
          color: "border-blue-500/50 bg-blue-500/15 text-blue-400",
          badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
        };
      case "yandex":
        return {
          name: "Yandex Disk",
          color: "border-rose-500/50 bg-rose-500/15 text-rose-400",
          badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        };
      case "mediafire":
        return {
          name: "MediaFire",
          color: "border-cyan-500/50 bg-cyan-500/15 text-cyan-400",
          badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        };
      default:
        return {
          name: "Doğrudan CDN",
          color: "border-[#d4af37]/50 bg-[#d4af37]/15 text-[#d4af37]",
          badgeColor: "bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40",
        };
    }
  };

  const prov = getProviderInfo();

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#14171e]/95 border border-[#d4af37]/40 shadow-2xl backdrop-blur-md cursor-pointer hover:scale-105 transition-all text-xs text-white"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        <span className="font-bold font-mono">
          {isCompleted ? "Aktarım Bitti" : `%${job.percentage.toFixed(0)} • ${prov.name}`}
        </span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-96 max-w-[calc(100vw-2.5rem)] bg-[#12151c]/95 border border-[#2b303c] hover:border-[#d4af37]/60 rounded-3xl p-4 shadow-2xl shadow-black/80 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300 select-none">
      {/* Üst Bilgi Satırı */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#2b303c]/60">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${prov.badgeColor} shrink-0`}
          >
            {prov.name}
          </span>
          <span className="text-xs font-bold text-white truncate font-mono">
            {job.name}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1b202a] transition cursor-pointer"
            title="Küçült"
          >
            <ChevronRight className="w-4 h-4 rotate-90" />
          </button>
          <button
            onClick={() => {
              setActiveJob(null);
              setCompletedJob(null);
            }}
            className="p-1 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-[#1b202a] transition cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canlı Aşama ve Rota */}
      <div className="py-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <div className="flex items-center gap-1.5 truncate">
            {isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-[#d4af37] animate-pulse shrink-0" />
            )}
            <span className="truncate text-gray-300 font-sans">
              {job.stage || (isCompleted ? "Tamamlandı" : "Aktarılıyor...")}
            </span>
          </div>

          {!isCompleted && (
            <span className="font-bold text-white shrink-0 ml-2">
              %{job.percentage.toFixed(1)}
            </span>
          )}
        </div>

        {/* İlerleme Çubuğu */}
        <div className="w-full h-2 rounded-full bg-[#0a0d13] border border-[#2b303c] overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-blue-500 via-[#d4af37] to-emerald-400 animate-pulse"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, job.percentage))}%` }}
          />
        </div>

        {/* Canlı İstatistikler (Hız, Boyut, Kalan Süre) */}
        {!isCompleted && (
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono pt-1">
            <span className="text-emerald-400 font-semibold">
              ⚡ {job.speed_mbps.toFixed(1)} MB/s
            </span>
            <span>
              {formatBytes(job.transferred_bytes)} / {formatBytes(job.total_bytes)}
            </span>
            {job.eta_seconds > 0 && (
              <span className="text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#d4af37]" />
                {job.eta_seconds > 60
                  ? `${Math.floor(job.eta_seconds / 60)} dk ${job.eta_seconds % 60} sn`
                  : `${job.eta_seconds} sn`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Alt Aksiyon Butonları */}
      <div className="pt-2 border-t border-[#2b303c]/60 flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-500 font-mono truncate">
          Hedef: {job.target_key}
        </span>

        {isCompleted ? (
          <button
            onClick={() =>
              copyToClipboard(`https://indir.turkceyama.org/${job.target_key}`)
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/30 transition cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            R2 Linki Kopyala
          </button>
        ) : (
          <button
            onClick={() => onNavigateTab("transfers")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-[11px] font-bold hover:bg-[#d4af37]/30 transition cursor-pointer shrink-0"
          >
            Detaylar
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

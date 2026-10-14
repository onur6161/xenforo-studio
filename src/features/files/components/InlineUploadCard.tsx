import React from "react";
import {
  UploadCloud,
  CheckCircle2,
  X,
  Zap,
  Clock,
  Layers,
  FileArchive,
  FileText,
  FileCode,
  Package,
  Copy,
  MessageSquarePlus,
  Check,
} from "lucide-react";
import { R2UploadProgress } from "../types";

interface InlineUploadCardProps {
  uploadState: R2UploadProgress | null;
  onClose: () => void;
  onOpenForumThread?: (fileName: string, targetKey: string) => void;
}

export const InlineUploadCard: React.FC<InlineUploadCardProps> = ({
  uploadState,
  onClose,
  onOpenForumThread,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!uploadState) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "Hesaplanıyor...";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0) return "Hesaplanıyor...";
    if (seconds < 60) return `~${seconds} sn`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `~${mins} dk ${secs > 0 ? `${secs} sn` : ""}`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["zip", "rar", "7z", "tar", "gz", "pak"].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (["exe", "msi", "dll"].includes(ext)) {
      return <Package className="w-5 h-5 text-rose-400" />;
    }
    if (["json", "xml", "txt", "log"].includes(ext)) {
      return <FileText className="w-5 h-5 text-cyan-400" />;
    }
    return <FileCode className="w-5 h-5 text-indigo-400" />;
  };

  const isComplete = uploadState.is_completed || uploadState.percentage >= 100;
  const fileName = uploadState.file_name;
  const targetKey = uploadState.target_key;
  const percentage = Math.min(100, Math.max(0, uploadState.percentage));
  const speed = uploadState.speed_mbps || 0;
  const eta = uploadState.eta_seconds || 0;
  const currentPart = uploadState.current_part || 1;
  const totalParts = uploadState.total_parts || 1;
  const uploadedBytes = uploadState.uploaded_bytes || 0;
  const totalBytes = uploadState.total_bytes || 0;

  const handleCopyLink = () => {
    const url = `https://indir.turkceyama.org/${targetKey}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative w-full rounded-2xl border transition-all duration-300 overflow-hidden shadow-xl animate-slide-up ${
        isComplete
          ? "bg-[#101c18] border-emerald-500/50 shadow-emerald-950/20"
          : "bg-[#151a24] border-amber-500/40 shadow-amber-950/20"
      }`}
    >
      {/* Üst Hareketli Gradyan Şerit */}
      <div
        className={`h-1.5 w-full ${
          isComplete
            ? "bg-gradient-to-r from-emerald-500 to-teal-400"
            : "bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-500 animate-pulse"
        }`}
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Üst Başlık Satırı */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isComplete
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-950/40 border-amber-500/30 text-amber-400 animate-pulse"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <UploadCloud className="w-5 h-5 text-amber-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white truncate max-w-sm">
                  {fileName}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border ${
                    isComplete
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                  }`}
                >
                  {isComplete ? "✓ YÜKLEME TAMAMLANDI" : "⚡ CANLI S3 MULTIPART AKIŞI"}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                Hedef Dizin: <span className="text-gray-300">{targetKey}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isComplete && onOpenForumThread && (
              <button
                onClick={() => onOpenForumThread(fileName, targetKey)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-900/30 transition cursor-pointer"
                title="TurkceYama.org Forumunda Bu Yamanın Konusunu Aç"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Forumda Konu Aç</span>
              </button>
            )}

            {isComplete && (
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c2433] hover:bg-[#253044] border border-[#2e3b52] text-xs text-gray-200 transition cursor-pointer"
                title="İndirme Linkini Kopyala"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? "Kopyalandı" : "Linki Al"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#232c3d] rounded-lg transition cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* İlerleme Çubuğu */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium flex items-center gap-1.5">
              {getFileIcon(fileName)}
              <span>Aktarım Durumu</span>
            </span>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-gray-400 text-[11px]">
                {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
              </span>
              <span className="font-bold text-white text-sm">
                %{percentage.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="relative w-full h-3 bg-[#0d1017] rounded-full overflow-hidden border border-[#283244] p-0.5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                isComplete
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                  : "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300"
              }`}
              style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
            >
              {!isComplete && (
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, rgba(255, 255, 255, 0.25) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.25) 75%, transparent 75%, transparent)",
                    backgroundSize: "24px 24px",
                    animation: "inlineStripes 1s linear infinite",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Metrikler Izgarası */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Hız */}
          <div className="p-2.5 rounded-xl bg-[#0e121a]/80 border border-[#212a3b] flex flex-col">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Yükleme Hızı</span>
            </div>
            <div className="text-xs font-mono font-bold text-white mt-0.5">
              {isComplete ? "Tamamlandı" : speed > 0 ? `⚡ ${speed.toFixed(1)} MB/s` : "Hesaplanıyor..."}
            </div>
          </div>

          {/* Kalan Süre */}
          <div className="p-2.5 rounded-xl bg-[#0e121a]/80 border border-[#212a3b] flex flex-col">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kalan Süre (ETA)</span>
            </div>
            <div className="text-xs font-mono font-bold text-white mt-0.5">
              {isComplete ? "0 sn" : formatEta(eta)}
            </div>
          </div>

          {/* S3 Multipart Parça */}
          <div className="p-2.5 rounded-xl bg-[#0e121a]/80 border border-[#212a3b] flex flex-col">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>S3 Parçaları</span>
            </div>
            <div className="text-xs font-mono font-bold text-white mt-0.5">
              {totalParts > 1 ? `Parça ${currentPart} / ${totalParts} (32 MB)` : "Tek Parça"}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes inlineStripes {
          from { background-position: 24px 0; }
          to { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
};

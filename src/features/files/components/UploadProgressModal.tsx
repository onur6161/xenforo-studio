import React, { useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  Minimize2,
  Maximize2,
  X,
  Zap,
  Clock,
  Layers,
  FileArchive,
  FileText,
  FileCode,
  Package,
} from "lucide-react";
import { R2UploadProgress } from "../types";

interface UploadProgressModalProps {
  progress: R2UploadProgress | null;
  onClose: () => void;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  progress,
  onClose,
}) => {
  const [minimized, setMinimized] = useState(false);

  if (!progress) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatEta = (seconds: number) => {
    if (seconds <= 0) return "Hesaplanıyor...";
    if (seconds < 60) return `~${seconds} sn`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `~${mins} dk ${secs > 0 ? `${secs} sn` : ""}`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) {
      return <FileArchive className="w-6 h-6 text-amber-400" />;
    }
    if (["exe", "msi", "dll"].includes(ext || "")) {
      return <Package className="w-6 h-6 text-rose-400" />;
    }
    if (["json", "xml", "txt", "log"].includes(ext || "")) {
      return <FileText className="w-6 h-6 text-cyan-400" />;
    }
    return <FileCode className="w-6 h-6 text-indigo-400" />;
  };

  const isComplete = progress.is_completed || progress.percentage >= 100;

  // MINIMIZED FLOATING PILL (Sağ Alt Köşede Şık Kapsül)
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#181d28]/95 backdrop-blur-md border border-[#2b364a] shadow-2xl rounded-2xl text-xs text-white">
          <div className="relative flex items-center justify-center">
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold truncate max-w-[160px]">
              {progress.file_name}
            </span>
            <span className="text-[11px] text-gray-400 font-mono">
              {isComplete
                ? "Tamamlandı"
                : `%${progress.percentage.toFixed(1)} • ${progress.speed_mbps.toFixed(1)} MB/s`}
            </span>
          </div>
          <button
            onClick={() => setMinimized(false)}
            className="p-1.5 hover:bg-[#232a3b] rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
            title="Genişlet"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {isComplete && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // TAM BOYUTLU MODERN MODAL
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#14171e] border border-[#2b364a] rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Üst Gradyan Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-500 animate-pulse" />

        {/* Başlık Alanı */}
        <div className="px-6 py-4 border-b border-[#232834] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1c2230] border border-amber-500/30 flex items-center justify-center shadow-inner">
              {isComplete ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-pulse" />
              ) : (
                <UploadCloud className="w-6 h-6 text-amber-400 animate-bounce" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {isComplete ? "Yükleme Tamamlandı!" : "Cloudflare R2 Yükleniyor"}
                {isComplete && (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Başarılı
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400">
                {isComplete
                  ? "Dosya Cloudflare R2 bulutunda aktif ve kullanıma hazır."
                  : "Yüksek hızlı S3 Multipart akışı (4 Paralel İş Parçacığı)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 hover:bg-[#232a3b] text-gray-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Küçült (Arka planda devam etsin)"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            {isComplete && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* İçerik Alanı */}
        <div className="p-6 space-y-5">
          {/* Dosya Bilgi Kartı */}
          <div className="flex items-center gap-3.5 p-3.5 bg-[#181d28] border border-[#232834] rounded-xl">
            <div className="p-2.5 rounded-lg bg-[#111319] border border-[#2b303c] shrink-0">
              {getFileIcon(progress.file_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate" title={progress.file_name}>
                {progress.file_name}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                Hedef: {progress.target_key}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-amber-400">
                {formatBytes(progress.uploaded_bytes)}
              </span>
              <span className="text-[10px] text-gray-400 font-mono block">
                / {formatBytes(progress.total_bytes)}
              </span>
            </div>
          </div>

          {/* İlerleme Çubuğu (Animated Shimmer Bar) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Yükleme İlerlemesi</span>
              <span className="font-mono font-bold text-sm text-white">
                %{progress.percentage.toFixed(1)}
              </span>
            </div>

            <div className="relative w-full h-3.5 bg-[#111319] rounded-full overflow-hidden border border-[#2b364a] p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                  isComplete
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300"
                }`}
                style={{ width: `${Math.min(100, Math.max(2, progress.percentage))}%` }}
              >
                {/* Işıltılı / Hareketli Çizgiler */}
                {!isComplete && (
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, rgba(255, 255, 255, 0.25) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.25) 75%, transparent 75%, transparent)",
                      backgroundSize: "24px 24px",
                      animation: "progressStripes 1s linear infinite",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* İstatistik Izgarası: Hız, Kalan Süre, Parça Durumu */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Hız */}
            <div className="p-3 bg-[#181d28] border border-[#232834] rounded-xl flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Yükleme Hızı</span>
              </div>
              <div className="text-xs font-mono font-bold text-white">
                {isComplete ? "Tamamlandı" : `⚡ ${progress.speed_mbps.toFixed(1)} MB/s`}
              </div>
            </div>

            {/* Kalan Süre (ETA) */}
            <div className="p-3 bg-[#181d28] border border-[#232834] rounded-xl flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tahmini Kalan</span>
              </div>
              <div className="text-xs font-mono font-bold text-white">
                {isComplete ? "0 sn" : formatEta(progress.eta_seconds)}
              </div>
            </div>

            {/* S3 Multipart Parça */}
            <div className="p-3 bg-[#181d28] border border-[#232834] rounded-xl flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>S3 Parçaları</span>
              </div>
              <div className="text-xs font-mono font-bold text-white">
                {progress.total_parts > 1
                  ? `${progress.current_part} / ${progress.total_parts}`
                  : "Tek Parça"}
              </div>
            </div>
          </div>

          {/* Bilgilendirme Notu */}
          <div className="text-[11px] text-gray-400 bg-[#111319] p-3 rounded-xl border border-[#1e232e] flex items-center justify-between">
            <span>
              💡 4 GB ve üzeri dosyalar <strong>32 MB parçalar</strong> halinde 4 paralel kanal üzerinden aktarılır.
            </span>
            <button
              onClick={() => setMinimized(true)}
              className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer shrink-0 ml-2"
            >
              Arka Plana Al
            </button>
          </div>
        </div>

        {/* Alt Buton Alanı */}
        {isComplete && (
          <div className="px-6 py-4 bg-[#111319] border-t border-[#232834] flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tamam, Pencereyi Kapat</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes progressStripes {
          from { background-position: 24px 0; }
          to { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
};

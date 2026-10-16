import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldCheck,
  Copy,
  Check,
  FolderOpen,
  Loader2,
  X,
  Code,
} from "lucide-react";
import { playSuccessChime } from "../utils/audio";

interface FileChecksumResult {
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  file_size_human: string;
  sha256: string;
}

interface ChecksumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChecksumModal: React.FC<ChecksumModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<FileChecksumResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePickAndCalculate = async () => {
    try {
      const picked: any = await invoke("pick_file_dialog");
      if (!picked || !picked.path) return;

      setCalculating(true);
      setResult(null);

      const res: FileChecksumResult = await invoke("calculate_file_hash", {
        path: picked.path,
      });

      setResult(res);
      playSuccessChime();
    } catch (e) {
      alert("Hash hesaplanırken hata oluştu: " + String(e));
    } finally {
      setCalculating(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getBBCode = () => {
    if (!result) return "";
    return `[B]Dosya Adı:[/B] ${result.file_name}\n[B]Boyut:[/B] ${result.file_size_human}\n[B]SHA-256 Sağlaması:[/B] [ICODE]${result.sha256}[/ICODE]`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12151c] border border-[#2b3347] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#222938] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Dosya Doğrulama & SHA-256 Checksum
              </h3>
              <p className="text-[11px] text-gray-400">
                Oyun yamalarının bütünlüğünü ve sahte/bozuk dosyaları tespit etmek için resmi hash üretici
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#161a24] border border-[#232b3b] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white">
              Bilgisayarınızdan Bir Yama Dosyası Seçin
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              ZIP, RAR, 7Z, EXE veya ISO dosyaları için SHA-256 hesaplar
            </div>
          </div>
          <button
            onClick={handlePickAndCalculate}
            disabled={calculating}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4af37] hover:bg-[#b58223] text-black font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shadow"
          >
            {calculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            Dosya Seç ve Hesapla
          </button>
        </div>

        {calculating && (
          <div className="py-8 text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-[#d4af37] mx-auto" />
            <div className="text-xs text-gray-300">
              Dosya okunuyor ve 256-bit hash algoritması çalıştırılıyor...
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-xl bg-[#0d1017] border border-[#242c3e] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Dosya Adı:</span>
                <span className="font-semibold text-white truncate max-w-[280px]">
                  {result.file_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Dosya Boyutu:</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {result.file_size_human}
                </span>
              </div>
              <div className="pt-2 border-t border-[#1a2130]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">SHA-256 Sağlama Hash Kodu:</span>
                  <button
                    onClick={() => copyToClipboard(result.sha256, "sha256")}
                    className="flex items-center gap-1 text-[10px] text-[#d4af37] hover:underline"
                  >
                    {copiedField === "sha256" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedField === "sha256" ? "Kopyalandı!" : "Hash Kopyala"}
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090d] border border-[#1d2433] font-mono text-[11px] text-emerald-300 break-all select-all">
                  {result.sha256}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => copyToClipboard(getBBCode(), "bbcode")}
                className="flex items-center gap-2 px-4 py-2 bg-[#1b2230] hover:bg-[#252f44] border border-[#2f3b54] text-xs font-semibold text-gray-200 rounded-xl transition cursor-pointer"
              >
                <Code className="w-4 h-4 text-purple-400" />
                {copiedField === "bbcode" ? "BBCode Kopyalandı!" : "XenForo BBCode Formatında Kopyala"}
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2 bg-[#252a36] hover:bg-[#32394a] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

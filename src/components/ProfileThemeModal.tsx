import React from "react";
import {
  X,
  Shield,
  Palette,
  Check,
  Crown,
  Hexagon,
  Diamond,
  ShieldCheck,
} from "lucide-react";
import { ForumUser } from "../features/auth/types";
import { CorporateAvatar } from "./CorporateAvatar";

interface ProfileThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ForumUser | null;
  role: string | null;
  avatarColor: string;
  onColorChange: (color: string) => void;
  avatarEmblem: string;
  onEmblemChange: (emblem: string) => void;
}

export const COLOR_OPTIONS = [
  { label: "TurkceYama Altın", hex: "#d4af37", bgClass: "bg-[#d4af37]" },
  { label: "Zümrüt Yeşili", hex: "#10b981", bgClass: "bg-emerald-500" },
  { label: "Siber Mavi", hex: "#06b6d4", bgClass: "bg-cyan-500" },
  { label: "Kraliyet Moru", hex: "#8b5cf6", bgClass: "bg-purple-500" },
  { label: "Yakut Kırmızısı", hex: "#ef4444", bgClass: "bg-rose-500" },
  { label: "Safir İndigo", hex: "#6366f1", bgClass: "bg-indigo-500" },
  { label: "Platin Gümüş", hex: "#94a3b8", bgClass: "bg-slate-400" },
];

export const EMBLEM_OPTIONS = [
  { id: "shield", label: "TurkceYama Kalkanı", icon: Shield },
  { id: "crown", label: "Yönetici Tacı", icon: Crown },
  { id: "hexagon", label: "Siber Güvenlik", icon: Hexagon },
  { id: "diamond", label: "Kristal Elmas", icon: Diamond },
];

export const ProfileThemeModal: React.FC<ProfileThemeModalProps> = ({
  isOpen,
  onClose,
  user,
  role,
  avatarColor,
  onColorChange,
  avatarEmblem,
  onEmblemChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#14171e] border border-[#2b364a] rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Üst Bar */}
        <div
          className="h-1.5 w-full transition-colors duration-300"
          style={{ backgroundColor: avatarColor }}
        />

        {/* Modal Başlığı */}
        <div className="px-6 py-4 border-b border-[#232834] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl bg-[#1c2230] border"
              style={{ borderColor: `${avatarColor}40` }}
            >
              <Palette className="w-5 h-5" style={{ color: avatarColor }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Profil & Görünüm Ayarları
              </h3>
              <p className="text-xs text-gray-400">
                Kurumsal logo rozeti, renk vurguları ve gece/gündüz teması
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#232a3b] text-gray-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal İçeriği */}
        <div className="p-6 space-y-6">
          {/* 1. KULLANICI KARTI & KURUMSAL LOGO ÖNİZLEME */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#181d28] border border-[#232834]">
            <CorporateAvatar
              size="xl"
              color={avatarColor}
              emblem={avatarEmblem}
              username={user?.username || "TY"}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white truncate">
                  {user?.username || "Giriş Yapılmadı"}
                </h4>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                  style={{
                    backgroundColor: `${avatarColor}15`,
                    color: avatarColor,
                    borderColor: `${avatarColor}40`,
                  }}
                >
                  {role === "super_admin"
                    ? "Süper Yönetici"
                    : role === "admin"
                    ? "Yönetici"
                    : "Moderatör"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                turkceyama.org Yetkili Portalı
              </p>
            </div>
          </div>


          {/* 3. KURUMSAL ROZET / AMBLEM SEÇİCİ */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Kurumsal Amblem Stili
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {EMBLEM_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = avatarEmblem === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onEmblemChange(opt.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "bg-[#181d28] shadow-md"
                        : "bg-[#111319] border-[#2b303c] text-gray-400 hover:text-white hover:bg-[#181d28]"
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: avatarColor,
                            color: avatarColor,
                          }
                        : {}
                    }
                  >
                    <IconComponent className="w-5 h-5 mb-1.5" />
                    <span className="text-[11px] font-medium text-center">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. KURUMSAL RENK PALETİ */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
              <span>Kurumsal Vurgu Rengi</span>
              <span className="text-[11px] font-mono" style={{ color: avatarColor }}>
                {COLOR_OPTIONS.find((c) => c.hex === avatarColor)?.label || "Özel"}
              </span>
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {COLOR_OPTIONS.map((col) => {
                const isSelected = avatarColor === col.hex;
                return (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => onColorChange(col.hex)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform cursor-pointer hover:scale-110 shadow-sm relative ${
                      col.bgClass
                    } ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-[#14171e] scale-110" : ""}`}
                    title={col.label}
                  >
                    {isSelected && <Check className="w-4 h-4 text-black font-bold" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alt Kaydet & Kapat Butonu */}
        <div className="px-6 py-4 bg-[#111319] border-t border-[#232834] flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Tercihleriniz anında kaydedilir ve bir sonraki açılışta korunur.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: avatarColor }}
          >
            <Check className="w-4 h-4 text-black" />
            <span className="text-black font-bold">Tamam</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, KeyRound, User, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthResult, ForumUser } from "./types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: ForumUser, role: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError("Lütfen kullanıcı adı ve şifrenizi girin.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      const res = await invoke<AuthResult>("login_user", {
        login: login.trim(),
        password,
      });

      if (res.success && res.user && res.role) {
        if (res.role === "unauthorized") {
          setError("Giriş başarılı ancak bu hesap forum yönetim veya yetkili kadrosunda değil.");
          return;
        }

        setSuccessMsg(`Hoş geldiniz, ${res.user.username}!`);
        setTimeout(() => {
          onLoginSuccess(res.user!, res.role!);
          onClose();
        }, 800);
      } else {
        setError(res.message || "Giriş başarısız. Kullanıcı adı veya şifre hatalı.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#14171e] border border-[#2b303c] rounded-2xl w-full max-w-md p-7 shadow-2xl shadow-black relative overflow-hidden">
        {/* Üst Dekorasyon */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#d4af37]"></div>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1c2230] border border-[#d4af37]/40 text-[#d4af37] mx-auto flex items-center justify-center mb-3 shadow-lg shadow-[#d4af37]/10">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">GUNNERIUS Portal Girişi</h2>
          <p className="text-xs text-gray-400 mt-1">
            turkceyama.org forum yetkili hesabınızla güvenle giriş yapın
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Forum Kullanıcı Adı veya E-Posta
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Örn: admin"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Forum Şifreniz
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1115] border border-[#2b303c] rounded-xl text-sm text-white focus:outline-none focus:border-[#d4af37] transition font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs text-gray-400 hover:text-white bg-[#1c2230] hover:bg-[#252c3d] rounded-xl transition cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-bold text-black bg-[#d4af37] hover:bg-[#e5c158] rounded-xl transition shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Giriş Yap"}
            </button>
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-[#2b303c] text-center">
          <span className="text-[11px] text-gray-500">
            Yetki seviyeniz (Admin / Moderatör / Ekip) forum hesabınızdan otomatik algılanır.
          </span>
        </div>
      </div>
    </div>
  );
};

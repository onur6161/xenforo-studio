import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { User, KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthResult, ForumUser } from "./types";

interface LoginPageProps {
  onLoginSuccess: (user: ForumUser, role: string, sessionToken?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
          setError("Bu hesap forumda yetkili kadrosunda değil. Giriş reddedildi.");
          return;
        }

        setSuccessMsg(`Hoş geldiniz, ${res.user.username}! Portal açılıyor...`);
        setTimeout(() => {
          onLoginSuccess(res.user!, res.role!, res.session_token);
        }, 600);
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0a0c10] text-white p-4 select-none overflow-hidden">
      {/* Arka Plan Efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12)_0%,transparent_60%)] pointer-events-none"></div>

      {/* Alttan Yukarı Kayarak Gelen Giriş Kartı */}
      <div className="w-full max-w-md bg-[#13161d] border border-[#2b303c] rounded-3xl p-8 shadow-2xl shadow-black relative overflow-hidden animate-slide-up">
        {/* Üst Altın Çizgi */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent"></div>

        {/* Logo & Başlık */}
        <div className="text-center mb-7">
          <div className="w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden border-2 border-[#d4af37]/50 p-1 bg-[#181b22] shadow-[0_0_25px_rgba(212,175,55,0.3)]">
            <img
              src="/logo.jpg"
              alt="TurkceYama.org"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>

          <h2 className="text-2xl font-black tracking-wider text-white font-mono">GUNNERIUS</h2>
          <p className="text-xs font-semibold text-[#d4af37] tracking-wide uppercase mt-0.5">
            Forum Yönetim Portalı
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">
            turkceyama.org yetkili hesabınızla oturum açın
          </span>
        </div>

        {/* Hata ve Başarı Bildirimleri */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Giriş Formu */}
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
                placeholder="Örn: Admin veya kullanıcı adı"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0a0c10] border border-[#2b303c] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#d4af37] transition"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Forum Şifresi</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0a0c10] border border-[#2b303c] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#d4af37] transition font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold text-sm rounded-xl transition shadow-lg shadow-[#d4af37]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-wide"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Giriş Yap"}
            </button>
          </div>
        </form>

        {/* Alt Güvenlik Bildirimi */}
        <div className="mt-6 pt-4 border-t border-[#232834] flex items-center justify-center gap-2 text-[11px] text-gray-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>turkceyama.org Uçtan Uca Şifreli Yetkili Oturumu</span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Users,
  Monitor,
  RefreshCw,
  X,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { CorporateAvatar } from "../../components/CorporateAvatar";

export interface AdminLiveSession {
  user_id: number;
  username: string;
  role: string;
  avatar_color?: string;
  avatar_emblem?: string;
  current_page: string;
  current_action: string;
  app_version: string;
  hostname: string;
  os: string;
  last_heartbeat: number;
  status: "online" | "idle" | "offline" | string;
}

interface AdminTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string | null;
  currentUsername?: string;
}

export const AdminTrackerModal: React.FC<AdminTrackerModalProps> = ({
  isOpen,
  onClose,
  sessionToken,
  currentUsername,
}) => {
  const [admins, setAdmins] = useState<AdminLiveSession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadActiveAdmins = async () => {
    try {
      setLoading(true);
      const res = await invoke<AdminLiveSession[]>("get_active_admins", {
        sessionToken,
      });
      setAdmins(res || []);
    } catch (e) {
      console.warn("Aktif yöneticiler alınamadı:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadActiveAdmins();
      const interval = setInterval(loadActiveAdmins, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen, sessionToken]);

  if (!isOpen) return null;

  const onlineCount = admins.filter((a) => a.status === "online").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#11141c] border border-[#2b3347] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* ÜST BAŞLIK */}
        <div className="px-6 py-4 border-b border-[#1f2638] flex items-center justify-between bg-[#151a26]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Canlı Yönetici Takibi & Operasyonlar</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {onlineCount} Çevrimiçi
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Stüdyoyu kullanan diğer yöneticilerin anlık sayfa, operasyon ve aktiflik telemetrisi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadActiveAdmins}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1f2638] rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1f2638] rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BİLGİLENDİRME & GÜVENLİK NOTU */}
        <div className="px-6 py-3 bg-[#131824] border-b border-[#1b2233] flex items-start gap-2.5 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong>Gizlilik ve Güvenlik Koruması:</strong> Bu alanda yalnızca yöneticilerin GUNNERIUS Studio içerisindeki resmi operasyonları (aktif sayfa, dosya aktarımı, forum yönetimi) izlenir. Kişisel bilgisayar süreçlerine kesinlikle müdahale edilmez.
          </span>
        </div>

        {/* YÖNETİCİ KARTLARI LİSTESİ */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-[#0d1017]">
          {admins.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto text-gray-600 mb-2" />
              <p className="text-sm">Henüz aktif yönetici oturumu tespit edilmedi.</p>
              <span className="text-xs text-gray-600">Her 15 saniyede bir kalp atışı (heartbeat) Cloudflare R2 üzerinden taranır.</span>
            </div>
          ) : (
            admins.map((adm) => {
              const isCurrent = adm.username === currentUsername;
              const isOnline = adm.status === "online";
              const isIdle = adm.status === "idle";

              return (
                <div
                  key={adm.user_id}
                  className={`p-4 rounded-xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isCurrent
                      ? "bg-[#141b2a]/90 border-amber-500/40 shadow-sm shadow-amber-500/5"
                      : isOnline
                      ? "bg-[#121622]/90 border-emerald-500/30 hover:border-emerald-500/50"
                      : "bg-[#0f121a]/60 border-[#1e2535] opacity-80"
                  }`}
                >
                  {/* Sol Bölüm: Avatar ve Temel Bilgiler */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <CorporateAvatar
                        size="md"
                        color={adm.avatar_color || "#d4af37"}
                        emblem={adm.avatar_emblem || "shield"}
                        username={adm.username}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#11141c] ${
                          isOnline
                            ? "bg-emerald-400 animate-pulse"
                            : isIdle
                            ? "bg-amber-400"
                            : "bg-gray-500"
                        }`}
                        title={isOnline ? "Çevrimiçi" : isIdle ? "Boşta" : "Çevrimdışı"}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{adm.username}</span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono font-bold">
                            SİZ
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-[#1a2233] text-gray-300 border border-[#2b364a]">
                          {adm.role === "super_admin" ? "Süper Admin" : adm.role === "admin" ? "Yönetici" : "Moderatör"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono mt-1">
                        <span className="flex items-center gap-1">
                          <Monitor className="w-3 h-3 text-cyan-400" />
                          {adm.hostname}
                        </span>
                        <span>•</span>
                        <span className="text-gray-400">{adm.os}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">v{adm.app_version}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sağ Bölüm: Şu Anda Ne Yapıyor? */}
                  <div className="flex flex-col items-start md:items-end justify-center min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                      <Activity className="w-3 h-3 text-amber-400" />
                      <span>Anlık Stüdyo İşlemi:</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {adm.current_page}
                      </span>
                      <span className="text-xs text-gray-300 font-mono">
                        {adm.current_action}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ALT DURUM BİLGİSİ */}
        <div className="px-6 py-3 border-t border-[#1f2638] bg-[#11141c] flex items-center justify-between text-xs text-gray-500 font-mono">
          <span>GUNNERIUS LIVE TELEMETRY V2</span>
          <span>OTOMATİK YENİLEME: 15 SN</span>
          <span className="text-emerald-400">R2 PROTOKOLÜ AKTİF</span>
        </div>
      </div>
    </div>
  );
};

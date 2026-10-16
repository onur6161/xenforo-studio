import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Users,
  Cpu,
  Monitor,
  RefreshCw,
  X,
  Search,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { CorporateAvatar } from "../../components/CorporateAvatar";

export interface RunningProcessItem {
  pid: number;
  name: string;
  mem_usage: string;
  session_type: string;
}

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
  running_processes: RunningProcessItem[];
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
  const [selectedAdmin, setSelectedAdmin] = useState<AdminLiveSession | null>(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processSearch, setProcessSearch] = useState("");

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

  const filteredProcesses = (selectedAdmin?.running_processes || []).filter((p) =>
    p.name.toLowerCase().includes(processSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#11141c] border border-[#2b3347] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* ÜST BAŞLIK */}
        <div className="px-6 py-4 border-b border-[#1f2638] flex items-center justify-between bg-[#151a26]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Canlı Yönetici & Operasyon Takibi</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {onlineCount} Çevrimiçi
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Stüdyoyu kullanan diğer yöneticilerin anlık sayfa, operasyon ve çalışan uygulama telemetrisi
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
            <strong>Kurumsal Telemetri & Güvenlik Protokolü:</strong> Yöneticilerin stüdyo içi eylemleri R2 oturum havuzunda anlık senkronize edilir. 
            Çalışan uygulamalar listesi sistem çekirdeği servislerinden arındırılarak güvenli ve hafif şekilde raporlanır.
          </span>
        </div>

        {/* YÖNETİCİ KARTLARI LİSTESİ */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1 bg-[#0d1017]">
          {admins.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto text-gray-600 mb-2" />
              <p className="text-sm">Henüz aktif yönetici oturumu tespit edilmedi.</p>
              <span className="text-xs text-gray-600">Her 15 saniyede bir kalp atışı (heartbeat) R2 üzerinden taranır.</span>
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

                  {/* Orta Bölüm: Şu Anda Ne Yapıyor? */}
                  <div className="flex-1 md:px-4 py-2 md:py-0 border-t md:border-t-0 md:border-l border-[#1f2638] min-w-0">
                    <div className="text-[11px] text-gray-400 font-medium">Anlık İşlem & Konum:</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate">
                        {adm.current_page}
                      </span>
                      <span className="text-xs text-gray-300 truncate font-mono">
                        {adm.current_action}
                      </span>
                    </div>
                  </div>

                  {/* Sağ Bölüm: Çalışan Uygulamalar Butonu */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedAdmin(adm);
                        setProcessSearch("");
                        setProcessModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-[#182030] hover:bg-[#202b40] border border-[#2b3852] hover:border-amber-500/50 rounded-xl text-xs font-medium text-gray-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Bu yöneticinin bilgisayarında çalışan uygulamaları ve süreçleri incele"
                    >
                      <Cpu className="w-3.5 h-3.5 text-amber-400" />
                      <span>Çalışan Uygulamalar</span>
                      <span className="text-[10px] px-1 rounded bg-[#0d1017] text-gray-400 font-mono">
                        {adm.running_processes?.length || 0}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </button>
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

      {/* SÜREÇLER / ÇALIŞAN UYGULAMALAR MODALI */}
      {processModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#11141d] border border-[#2d374d] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Modal Başlık */}
            <div className="px-5 py-4 border-b border-[#21293b] flex items-center justify-between bg-[#151b28]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{selectedAdmin.username}</span>
                    <span className="text-xs text-gray-400 font-normal">
                      • Çalıştırılan Uygulamalar ({selectedAdmin.running_processes?.length || 0})
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {selectedAdmin.hostname} ({selectedAdmin.os})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setProcessModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1f2638] rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Arama Çubuğu */}
            <div className="p-3 bg-[#131824] border-b border-[#1f2738] flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400 ml-1" />
              <input
                type="text"
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
                placeholder="Uygulama veya işlem adı ara... (Örn: chrome, discord, studio)"
                className="bg-transparent border-0 outline-none text-xs text-white placeholder-gray-500 w-full"
              />
            </div>

            {/* Görev Yöneticisi Tablosu */}
            <div className="overflow-y-auto flex-1 p-2 bg-[#0d1017]">
              {filteredProcesses.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  Aramanıza uygun çalışan uygulama bulunamadı.
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-gray-400 border-b border-[#1b2233] text-[11px]">
                      <th className="py-2 px-3 font-semibold">Uygulama Adı</th>
                      <th className="py-2 px-3 font-semibold text-right">PID</th>
                      <th className="py-2 px-3 font-semibold text-right">Bellek (RAM)</th>
                      <th className="py-2 px-3 font-semibold text-center">Oturum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#151a26]">
                    {filteredProcesses.map((p, idx) => (
                      <tr key={idx} className="hover:bg-[#141a26] transition">
                        <td className="py-2 px-3 text-white font-sans font-medium flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <span className="truncate max-w-[280px]">{p.name}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-400">{p.pid}</td>
                        <td className="py-2 px-3 text-right text-amber-300 font-bold">{p.mem_usage}</td>
                        <td className="py-2 px-3 text-center text-gray-500 text-[10px]">{p.session_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Alt Bilgi */}
            <div className="px-4 py-2.5 bg-[#11141c] border-t border-[#1f2638] flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sistem Çekirdeği Filtrelendi
              </span>
              <button
                onClick={() => setProcessModalOpen(false)}
                className="px-3 py-1 bg-[#1a2233] hover:bg-[#253047] text-white rounded-lg text-xs transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

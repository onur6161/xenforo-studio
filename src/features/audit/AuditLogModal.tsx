import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileText,
  ShieldCheck,
  RefreshCw,
  X,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Cloud,
} from "lucide-react";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: number;
  username: string;
  action_type: string;
  target?: string;
  details: string;
  ip_or_device: string;
  severity: "info" | "success" | "warning" | "security" | "error" | string;
}

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string | null;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  sessionToken,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await invoke<AuditLogEntry[]>("get_audit_logs", {
        sessionToken,
        limit: 250,
        dateFilter: selectedDate,
        actionFilter: actionFilter === "all" ? null : actionFilter,
      });
      setLogs(res || []);
    } catch (e) {
      console.warn("Audit logları yüklenemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAuditLogs();
    }
  }, [isOpen, sessionToken, selectedDate, actionFilter]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (severityFilter !== "all" && log.severity !== severityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.username.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.action_type.toLowerCase().includes(q) ||
        (log.target && log.target.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gunnerius_audit_${selectedDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "success":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Başarılı
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-3 h-3" /> Uyarı
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400">
            <ShieldAlert className="w-3 h-3" /> Hata
          </span>
        );
      case "security":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <ShieldCheck className="w-3 h-3" /> Güvenlik
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <Info className="w-3 h-3" /> Bilgi
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#11141c] border border-[#2b3347] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ÜST BAŞLIK */}
        <div className="px-6 py-4 border-b border-[#1f2638] flex items-center justify-between bg-[#151a26]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Sistem & Yönetici Denetim Kütüğü (Audit Log)</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center gap-1.5">
                  <Cloud className="w-3 h-3" />
                  R2 Bulut Senkronizasyonu Aktif
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Uygulama içerisinde yöneticiler tarafından gerçekleştirilen tüm adımlar, aktarımlar ve dosya hareketleri
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              disabled={logs.length === 0}
              className="px-3 py-1.5 bg-[#182030] hover:bg-[#202b40] border border-[#2b3852] rounded-xl text-xs font-semibold text-gray-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Günün loglarını JSON olarak indir"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dışa Aktar</span>
            </button>
            <button
              onClick={loadAuditLogs}
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

        {/* FİLTRE VE ARAMA ÇUBUĞU */}
        <div className="px-6 py-3 bg-[#131824] border-b border-[#1f2738] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Yönetici, işlem veya dosya ara..."
              className="bg-transparent border-0 outline-none text-xs text-white placeholder-gray-500 w-full"
            />
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tarih Seçimi */}
            <div className="flex items-center gap-1.5 bg-[#0e121a] px-2.5 py-1.5 rounded-xl border border-[#212a3d]">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-gray-200 text-xs border-0 outline-none cursor-pointer"
              />
            </div>

            {/* Eylem Türü Filtresi */}
            <div className="flex items-center gap-1 bg-[#0e121a] px-2.5 py-1.5 rounded-xl border border-[#212a3d]">
              <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-transparent text-gray-200 text-xs border-0 outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#11141c]">Tüm Eylemler</option>
                <option value="R2_UPLOAD" className="bg-[#11141c]">R2 Yükleme</option>
                <option value="R2_DELETE" className="bg-[#11141c]">R2 Silme</option>
                <option value="R2_BATCH_DELETE" className="bg-[#11141c]">R2 Toplu Silme</option>
                <option value="R2_RENAME" className="bg-[#11141c]">R2 Yeniden Adlandır</option>
                <option value="TRANSFER_START" className="bg-[#11141c]">Bulut Aktarımı</option>
                <option value="LOGIN" className="bg-[#11141c]">Giriş İşlemleri</option>
                <option value="SETTINGS_SAVE" className="bg-[#11141c]">Ayar Güncelleme</option>
                <option value="USER_MODERATION" className="bg-[#11141c]">Üye Moderasyonu</option>
              </select>
            </div>

            {/* Durum / Önem Filtresi */}
            <div className="flex items-center gap-1 bg-[#0e121a] px-2.5 py-1.5 rounded-xl border border-[#212a3d]">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-gray-200 text-xs border-0 outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#11141c]">Tüm Durumlar</option>
                <option value="success" className="bg-[#11141c]">Başarılı</option>
                <option value="info" className="bg-[#11141c]">Bilgi</option>
                <option value="warning" className="bg-[#11141c]">Uyarı</option>
                <option value="security" className="bg-[#11141c]">Güvenlik</option>
                <option value="error" className="bg-[#11141c]">Hata</option>
              </select>
            </div>
          </div>
        </div>

        {/* LOG TABLOSU */}
        <div className="overflow-y-auto flex-1 p-4 bg-[#0d1017]">
          {filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto text-gray-600 mb-2" />
              <p className="text-sm">Seçilen kriterlere uygun denetim kaydı bulunamadı.</p>
              <span className="text-xs text-gray-600">Tarih: {selectedDate} • Bulut Klasörü: logs/audit/{selectedDate}.json</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-gray-400 border-b border-[#1b2233] text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Zaman Damgası</th>
                  <th className="py-2.5 px-3 font-semibold">Yönetici</th>
                  <th className="py-2.5 px-3 font-semibold">Eylem Türü</th>
                  <th className="py-2.5 px-3 font-semibold">Ayrıntılar & Hedef</th>
                  <th className="py-2.5 px-3 font-semibold">Cihaz</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151a26]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#131722] transition">
                    <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-white whitespace-nowrap">
                      {log.username}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[#182030] border border-[#25324d] text-amber-300 font-semibold text-[10px]">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-200 font-sans min-w-[260px] max-w-[420px]">
                      <div className="truncate">{log.details}</div>
                      {log.target && (
                        <div className="text-[10px] text-gray-500 font-mono truncate">{log.target}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 text-[11px] whitespace-nowrap">{log.ip_or_device}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {getSeverityBadge(log.severity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ALT DURUM BİLGİSİ */}
        <div className="px-6 py-3 border-t border-[#1f2638] bg-[#11141c] flex items-center justify-between text-xs text-gray-500 font-mono">
          <span>TOPLAM KAYIT: {filteredLogs.length}</span>
          <span>R2 DEPOLAMA: logs/audit/{selectedDate}.json</span>
          <span className="text-emerald-400">ŞİFRELİ DENETİM KÜTÜĞÜ</span>
        </div>
      </div>
    </div>
  );
};

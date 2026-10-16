import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  ShieldAlert,
  HardDrive,
  Wifi,
  RefreshCw,
  X,
  Calendar,
  Cloud,
  CheckCircle2,
  Lightbulb,
  FileCheck,
} from "lucide-react";

export interface DailyAIReport {
  id: string;
  report_date: string;
  created_at: string;
  generated_by: string;
  users_registered_today: number;
  users_change_pct: number;
  messages_today: number;
  messages_change_pct: number;
  threads_today: number;
  threads_change_pct: number;
  banned_users_today: number;
  banned_change_pct: number;
  uploaded_bytes_today: number;
  uploaded_formatted: string;
  downloaded_bytes_today: number;
  downloaded_formatted: string;
  bandwidth_mbps_avg: number;
  bandwidth_status: string;
  executive_summary: string;
  key_highlights: string[];
  actionable_recommendations: string[];
}

export interface DailyReportSummaryItem {
  date: string;
  file_key: string;
  summary_snippet: string;
}

interface AIDailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string | null;
}

export const AIDailyReportModal: React.FC<AIDailyReportModalProps> = ({
  isOpen,
  onClose,
  sessionToken,
}) => {
  const [report, setReport] = useState<DailyAIReport | null>(null);
  const [history, setHistory] = useState<DailyReportSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const loadReport = async (dateStr?: string, force: boolean = false) => {
    try {
      if (force) {
        setGenerating(true);
      } else {
        setLoading(true);
      }

      if (dateStr && !force) {
        const res = await invoke<DailyAIReport>("get_daily_ai_report_by_date", {
          sessionToken,
          dateStr,
        });
        setReport(res);
      } else {
        const res = await invoke<DailyAIReport>("generate_daily_ai_report", {
          sessionToken,
          forceRegenerate: force,
        });
        setReport(res);
        if (res) {
          setSelectedDate(res.report_date);
        }
      }

      // Geçmiş listesini güncelle
      const historyList = await invoke<DailyReportSummaryItem[]>("list_daily_ai_reports", {
        sessionToken,
      });
      setHistory(historyList || []);
    } catch (e) {
      console.warn("AI Günlük rapor yüklenirken hata:", e);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen, sessionToken]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#11141c] border border-[#2b3347] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ÜST BAŞLIK */}
        <div className="px-6 py-4 border-b border-[#1f2638] flex items-center justify-between bg-[#151a26]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Yapay Zeka Günlük Yönetim & İstihbarat Raporu</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center gap-1.5">
                  <Cloud className="w-3 h-3" />
                  R2 Bulut Depolu
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Kullanıcı hareketleri, forum aktivitesi, CDN indirme trafiği ve bant genişliği telemetrisi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Geçmiş Raporlar Seçici */}
            {history.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#182030] px-2.5 py-1.5 rounded-xl border border-[#2b3852]">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedDate}
                  onChange={(e) => {
                    const d = e.target.value;
                    setSelectedDate(d);
                    loadReport(d, false);
                  }}
                  className="bg-transparent text-gray-200 text-xs border-0 outline-none cursor-pointer"
                >
                  {history.map((h) => (
                    <option key={h.date} value={h.date} className="bg-[#11141c]">
                      {h.date}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => loadReport(undefined, true)}
              disabled={generating || loading}
              className="px-3 py-1.5 bg-[#1a2335] hover:bg-[#25324d] border border-purple-500/40 rounded-xl text-xs font-semibold text-purple-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              title="Günün istatistiklerini yeniden analiz et ve R2'ye kaydet"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin text-purple-400" : ""}`} />
              <span>{generating ? "Oluşturuluyor..." : "Yeniden Üret"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1f2638] rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* İÇERİK ALANI */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#0d1017]">
          {loading && !report ? (
            <div className="p-16 text-center text-gray-400">
              <RefreshCw className="w-10 h-10 mx-auto text-purple-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-white">Yapay Zeka Günlük Raporu Hazırlanıyor...</p>
              <span className="text-xs text-gray-500">XenForo veri tabanı ve R2 depolama hacmi taranıyor.</span>
            </div>
          ) : report ? (
            <>
              {/* 6'LI TEMEL METRİK KARTLARI */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Yeni Üyeler */}
                <div className="p-3.5 rounded-xl bg-[#121622] border border-[#21293d] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[11px] font-medium">Yeni Kayıt</span>
                    <Users className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    +{report.users_registered_today}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>+%{report.users_change_pct.toFixed(1)}</span>
                  </div>
                </div>

                {/* 2. Mesajlar */}
                <div className="p-3.5 rounded-xl bg-[#121622] border border-[#21293d] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[11px] font-medium">Yeni Mesaj</span>
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {report.messages_today}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>+%{report.messages_change_pct.toFixed(1)}</span>
                  </div>
                </div>

                {/* 3. Yasaklananlar */}
                <div className="p-3.5 rounded-xl bg-[#121622] border border-[#21293d] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[11px] font-medium">Yasaklanan</span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {report.banned_users_today}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-1">
                    <TrendingDown className="w-3 h-3" />
                    <span>%{Math.abs(report.banned_change_pct).toFixed(1)} Azalış</span>
                  </div>
                </div>

                {/* 4. Yüklenen Veri */}
                <div className="p-3.5 rounded-xl bg-[#121622] border border-[#21293d] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[11px] font-medium">Yüklenen Veri</span>
                    <HardDrive className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-lg font-bold text-white font-mono truncate">
                    {report.uploaded_formatted}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">R2 Depolama</div>
                </div>

                {/* 5. İndirilen Veri */}
                <div className="p-3.5 rounded-xl bg-[#121622] border border-[#21293d] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[11px] font-medium">İndirilen Veri</span>
                    <Cloud className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-lg font-bold text-white font-mono truncate">
                    {report.downloaded_formatted}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">CDN Trafiği</div>
                </div>

                {/* 6. Bant Genişliği */}
                <div className="p-3.5 rounded-xl bg-[#121622] border border-[#21293d] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[11px] font-medium">Bant Genişliği</span>
                    <Wifi className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-lg font-bold text-white font-mono">
                    {report.bandwidth_mbps_avg} Mbps
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-1 truncate">
                    {report.bandwidth_status}
                  </div>
                </div>
              </div>

              {/* YÖNETİCİ ÖZETİ (AI SUMMARY) */}
              <div className="p-5 rounded-2xl bg-[#131724] border border-[#232c40] space-y-3">
                <div className="flex items-center justify-between border-b border-[#1f2638] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-bold text-white">Yapay Zeka Yönetici Özeti</h4>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    Rapor Tarihi: {report.report_date} • {report.created_at}
                  </span>
                </div>
                <div className="text-xs text-gray-200 leading-relaxed whitespace-pre-line font-sans">
                  {report.executive_summary}
                </div>
              </div>

              {/* 2 SÜTUN: GÜNÜN ÖNE ÇIKANLARI & AI ÖNERİLERİ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Günün Öne Çıkanları */}
                <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2738] space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <FileCheck className="w-4 h-4 text-amber-400" />
                    <span>Günün Öne Çıkan Başlıkları</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-300">
                    {report.key_highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* AI Tavsiyeleri & Aksiyonlar */}
                <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2738] space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                    <Lightbulb className="w-4 h-4 text-purple-400" />
                    <span>Yapay Zeka Stratejik Önerileri</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-300">
                    {report.actionable_recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* ALT DURUM BİLGİSİ */}
        <div className="px-6 py-3 border-t border-[#1f2638] bg-[#11141c] flex items-center justify-between text-xs text-gray-500 font-mono">
          <span>GUNNERIUS AI INTELLIGENCE V2</span>
          <span>R2 ARŞİVİ: reports/daily/report_{selectedDate || "bugun"}.json</span>
          <span className="text-purple-400">OTOMATİK RAPOR PROTOKOLÜ</span>
        </div>
      </div>
    </div>
  );
};

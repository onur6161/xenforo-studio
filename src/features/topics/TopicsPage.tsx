import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  MessageSquare,
  FileText,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Search,
  Lightbulb,
  ThumbsUp,
  Layers,
  ChevronRight,
  ExternalLink,
  StickyNote,
  X,
  Check,
  Trash2,
  FileDown,
  Copy,
  AlertCircle,
  Zap,
  Info,
  ArrowUpDown,
} from "lucide-react";
import { useToast } from "../../components/Toast";

export interface ForumCategoryStat {
  node_id: number;
  title: string;
  description?: string;
  thread_count: number;
  message_count: number;
  active_in_period: number;
  views_estimate: number;
  engagement_rate: number;
  category_popularity_score: number;
  velocity_daily: number;
  trend_status: "surge" | "healthy" | "needs_improvement" | string;
  trend_status_label: string;
  trend_change_pct: number;
  ai_recommendation: string;
  last_activity_formatted: string;
}

export interface ForumPopularThread {
  thread_id: number;
  title: string;
  category_name: string;
  node_id: number;
  reply_count: number;
  view_count: number;
  reaction_score: number;
  author: string;
  post_date: number;
  last_post_date: number;
  last_post_date_formatted: string;
  age_days: number;
  popularity_score: number;
  velocity_replies_per_day: number;
  reaction_ratio: number;
  delta_replies_period: number;
  status_badge: string;
  status_color: string;
  forum_url: string;
}

export interface AIForumInsight {
  id: string;
  insight_type: "opportunity" | "warning" | "highlight" | string;
  title: string;
  description: string;
  badge_text: string;
  target_category?: string;
}

export interface AIForumReport {
  report_id: string;
  period: string;
  generated_at: string;
  title: string;
  executive_summary: string;
  top_growing_category: string;
  top_active_thread: string;
  total_analyzed_threads: number;
  total_analyzed_categories: number;
  action_recommendations: string[];
  markdown_content: string;
}

export interface ThreadNoteItem {
  thread_id: number;
  note: string;
  updated_at: string;
  author?: string;
}

export interface TopicsAnalyticsData {
  success: boolean;
  period: "daily" | "weekly" | "monthly" | "yearly" | string;
  total_categories: number;
  total_threads: number;
  total_messages: number;
  total_views: number;
  avg_engagement_rate: number;
  period_active_threads_count: number;
  categories: ForumCategoryStat[];
  popular_threads: ForumPopularThread[];
  ai_insights: AIForumInsight[];
}

type PeriodType = "daily" | "weekly" | "monthly" | "yearly";
type ViewTabType = "categories" | "threads";
type SortByType = "popularity" | "replies" | "views" | "reactions" | "velocity" | "recent";

export const TopicsPage: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<TopicsAnalyticsData | null>(null);
  const [period, setPeriod] = useState<PeriodType>("weekly");
  const [viewTab, setViewTab] = useState<ViewTabType>("categories");
  const [sortBy, setSortBy] = useState<SortByType>("popularity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "surge" | "healthy" | "needs_improvement">("all");
  const [expandedNodeId, setExpandedNodeId] = useState<number | null>(null);
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  // Not Yönetimi State'leri
  const [threadNotes, setThreadNotes] = useState<Record<string, ThreadNoteItem>>({});
  const [selectedThreadForNote, setSelectedThreadForNote] = useState<ForumPopularThread | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // AI Rapor Modalı State'leri
  const [aiReportModalOpen, setAiReportModalOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<AIForumReport | null>(null);

  const fetchNotes = async () => {
    try {
      const notes = await invoke<Record<string, ThreadNoteItem>>("get_thread_notes");
      setThreadNotes(notes || {});
    } catch (e) {
      console.error("Notlar yüklenemedi:", e);
    }
  };

  const fetchAnalytics = async (selectedPeriod: PeriodType = period) => {
    try {
      setLoading(true);
      setError(null);
      const res = await invoke<TopicsAnalyticsData>("get_topics_analytics", {
        period: selectedPeriod,
      });
      setData(res);
    } catch (err: any) {
      console.error("Konu analitiği çekilirken hata:", err);
      setError(typeof err === "string" ? err : "Forum analitik verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
    fetchNotes();
  }, [period]);

  const handlePeriodChange = (p: PeriodType) => {
    if (p === period) return;
    setPeriod(p);
  };

  const handleOpenThread = async (url: string) => {
    try {
      await invoke("open_external_url", { url });
      showToast("info", "Konu Açılıyor", "Varsayılan tarayıcınızda açılıyor...");
    } catch (e: any) {
      showToast("error", "URL Açılamadı", String(e));
    }
  };

  const handleOpenNoteModal = (thread: ForumPopularThread) => {
    setSelectedThreadForNote(thread);
    const existing = threadNotes[thread.thread_id.toString()];
    setCurrentNoteText(existing ? existing.note : "");
  };

  const handleSaveNote = async () => {
    if (!selectedThreadForNote) return;
    try {
      setSavingNote(true);
      await invoke("save_thread_note", {
        threadId: selectedThreadForNote.thread_id,
        note: currentNoteText.trim(),
        author: "Admin",
      });
      showToast("success", "Başarılı", "Konu notu başarıyla kaydedildi.");
      await fetchNotes();
      setSelectedThreadForNote(null);
    } catch (e: any) {
      showToast("error", "Kayıt Hatası", String(e));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (threadId: number) => {
    try {
      await invoke("delete_thread_note", { threadId });
      showToast("info", "Not Silindi", "Konu notu başarıyla kaldırıldı.");
      await fetchNotes();
      if (selectedThreadForNote?.thread_id === threadId) {
        setSelectedThreadForNote(null);
      }
    } catch (e: any) {
      showToast("error", "Silme Hatası", String(e));
    }
  };

  const handleGenerateReport = async (reportType: "weekly" | "monthly") => {
    try {
      setReportLoading(true);
      setAiReportModalOpen(true);
      const report = await invoke<AIForumReport>("get_ai_forum_report", { reportType });
      setActiveReport(report);
      showToast("success", "Rapor Hazır", `${report.title} başarıyla oluşturuldu.`);
    } catch (e: any) {
      showToast("error", "Rapor Hatası", String(e));
      setAiReportModalOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const copyReportToClipboard = () => {
    if (!activeReport) return;
    navigator.clipboard.writeText(activeReport.markdown_content);
    showToast("success", "Kopyalandı", "AI Raporu panoya kopyalandı!");
  };

  // Filtrelenmiş ve Sıralanmış Kategoriler
  const filteredCategories = useMemo(() => {
    return (data?.categories || []).filter((cat) => {
      const matchesSearch =
        cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === "all" || cat.trend_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data?.categories, searchQuery, statusFilter]);

  // Filtrelenmiş ve Sıralanmış Konular
  const sortedAndFilteredThreads = useMemo(() => {
    const list = (data?.popular_threads || []).filter((th) => {
      const q = searchQuery.toLowerCase();
      return (
        th.title.toLowerCase().includes(q) ||
        th.author.toLowerCase().includes(q) ||
        th.category_name.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "popularity":
          return b.popularity_score - a.popularity_score;
        case "replies":
          return b.reply_count - a.reply_count;
        case "views":
          return b.view_count - a.view_count;
        case "reactions":
          return b.reaction_score - a.reaction_score;
        case "velocity":
          return b.velocity_replies_per_day - a.velocity_replies_per_day;
        case "recent":
          return b.last_post_date - a.last_post_date;
        default:
          return b.popularity_score - a.popularity_score;
      }
    });
  }, [data?.popular_threads, searchQuery, sortBy]);

  const periodDescriptions: Record<PeriodType, string> = {
    daily: "Son 24 saat içinde güncellenen konular & kategori aktiviteleri",
    weekly: "Son 7 gün içinde aktif olan başlıklar ve etkileşim dağılımı",
    monthly: "Son 30 günün genel forum performansı ve ilgi odakları",
    yearly: "Son 365 günün kümülatif forum trendi",
  };

  return (
    <div className="space-y-6 pb-12">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. ÜST BAŞLIK & DÖNEM SEÇİCİ & AI RAPOR BUTONLARI */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Forum Etkileşim & Analitik Merkezi
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  CANLI REST API
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {periodDescriptions[period]}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Periyot Seçici */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            {(
              [
                { id: "daily", label: "Günlük" },
                { id: "weekly", label: "Haftalık" },
                { id: "monthly", label: "Aylık" },
                { id: "yearly", label: "Yıllık" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  period === p.id
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* AI Rapor Butonları */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateReport("weekly")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition shadow-sm"
              title="Haftalık Yönetici Strateji Raporu Oluştur"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Haftalık AI Raporu
            </button>
            <button
              onClick={() => handleGenerateReport("monthly")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition shadow-sm"
              title="Aylık Kapsamlı Yönetim Raporu Oluştur"
            >
              <FileDown className="w-3.5 h-3.5 text-purple-400" />
              Aylık AI Raporu
            </button>
          </div>

          <button
            onClick={() => fetchAnalytics(period)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/60 disabled:opacity-50"
            title="Verileri Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ADİL MATEMATİKSEL PUANLAMA BİLGİ KUTUSU */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              Gunnerius Adil Popülarite & Trend Algoritması (0 - 100 Puan)
              <button
                onClick={() => setShowFormulaInfo(!showFormulaInfo)}
                className="text-amber-400 hover:underline flex items-center gap-0.5 text-[11px]"
              >
                <Info className="w-3 h-3" />
                {showFormulaInfo ? "Gizle" : "Matematik Nasıl Çalışır?"}
              </button>
            </div>
            <p className="text-slate-400 mt-0.5">
              Yeni açılan konular eski konular karşısında ezilmez; Yüklenme Yaşı, Alınan Reaksiyon, Görüntülenme ve Cevap Hızı zaman sönümlemesiyle (Time-decay) harmanlanır.
            </p>
          </div>
        </div>

        {showFormulaInfo && (
          <div className="w-full mt-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-300 space-y-1.5 text-[11px]">
            <div>• <strong className="text-amber-300">Ham Güç (Raw):</strong> (Cevap × 16) + (Reaksiyon × 24) + (Görüntülenme × 0.18)</div>
            <div>• <strong className="text-amber-300">Zaman Sönümleme (Gravity):</strong> Ham Güç ÷ (Konu Yaşı + 0.8)<sup>0.68</sup> <em>(yeni konulara güçlü hız avantajı)</em></div>
            <div>• <strong className="text-amber-300">Güncellik Çarpanı:</strong> Son 4 saatte mesaj geldiyse <strong>×1.75</strong>, son 24 saatte <strong>×1.40</strong></div>
            <div>• <strong className="text-amber-300">Normalizasyon:</strong> Logaritmik transfer fonksiyonu ile adil <strong>0.0 - 100.0</strong> endeksine dönüştürülür.</div>
          </div>
        )}
      </div>

      {/* 2. DÖNEMSEL KPI KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">İncelenen Kategori</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? "..." : data?.total_categories ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
            Forum düğümleri taranıyor
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Dönem İçi Aktif Konu</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? "..." : (data?.period_active_threads_count ?? data?.popular_threads.length ?? 0)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Bu dönemde yanıt alan/açılan
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Toplam Forum Mesajı</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? "..." : (data?.total_messages ?? 0).toLocaleString("tr-TR")}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Gerçek veritabanı sayacı
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Ortalama Etkileşim Skoru</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? "..." : `%${data?.avg_engagement_rate ?? 0}`}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Konu / Mesaj aktivite oranı
          </div>
        </div>
      </div>

      {/* 3. AI STRATEJİ DANIŞMANI İÇGÖRÜLERİ */}
      {data?.ai_insights && data.ai_insights.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-indigo-900/40 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
              Yapay Zeka Forum Danışmanı İçgörüleri
            </div>
            <span className="text-xs text-slate-400 font-medium">
              XenForo Canlı Telemetri Analizi
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.ai_insights.map((ins) => (
              <div
                key={ins.id}
                className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/40 transition group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {ins.badge_text}
                    </span>
                    {ins.target_category && (
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                        {ins.target_category}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 mb-1 group-hover:text-amber-400 transition">
                    {ins.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {ins.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ANA SEKME GEÇİŞİ (KATEGORİLER vs KONULAR) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        {/* TAB SWITCHER */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewTab("categories")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              viewTab === "categories"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Layers className="w-4 h-4" />
            Kategoriler & Düğümler
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              viewTab === "categories" ? "bg-slate-950/30 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}>
              {filteredCategories.length}
            </span>
          </button>

          <button
            onClick={() => setViewTab("threads")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              viewTab === "threads"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Konular & Mesaj Akışı
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              viewTab === "threads" ? "bg-slate-950/30 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}>
              {sortedAndFilteredThreads.length}
            </span>
          </button>
        </div>

        {/* ARAMA VE SIRALAMA FİLTRESİ */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={viewTab === "categories" ? "Kategori ara..." : "Konu başlığı veya yazar ara..."}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 w-60"
            />
          </div>

          {viewTab === "threads" && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="popularity" className="bg-slate-900">🏆 Adil Popülarite Skoru</option>
                <option value="velocity" className="bg-slate-900">⚡ Günlük Hız (Mesaj/Gün)</option>
                <option value="replies" className="bg-slate-900">💬 En Çok Cevap</option>
                <option value="views" className="bg-slate-900">👁️ En Çok Görüntülenme</option>
                <option value="reactions" className="bg-slate-900">❤️ En Çok Reaksiyon</option>
                <option value="recent" className="bg-slate-900">⏱️ En Son Mesaj</option>
              </select>
            </div>
          )}

          {viewTab === "categories" && (
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="surge">Yükselişte Olanlar</option>
              <option value="healthy">İyi Seviyede Olanlar</option>
              <option value="needs_improvement">Geliştirme Gerekli</option>
            </select>
          )}
        </div>
      </div>

      {/* 5. GÖRÜNÜM A: KATEGORİLER TABLOSU & ANALİZİ */}
      {viewTab === "categories" && (
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Forum Kategori Popülarite & Etkileşim Raporu
            </span>
            <span className="text-xs text-slate-500">
              Toplam {filteredCategories.length} kategori listeleniyor
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Kategori / Düğüm Adı</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Toplam Konu</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Toplam Mesaj</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Dönem İçi Aktif</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Popülarite Endeksi</th>
                  <th className="py-3.5 px-4 font-semibold text-center">AI Durum Rozeti</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Eylem & Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Kriterlere uygun forum kategorisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => {
                    const isExpanded = expandedNodeId === cat.node_id;

                    const badgeColors = {
                      surge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                      healthy: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                      needs_improvement: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    }[cat.trend_status] || "bg-slate-800 text-slate-400 border-slate-700";

                    return (
                      <React.Fragment key={cat.node_id}>
                        <tr
                          onClick={() => setExpandedNodeId(isExpanded ? null : cat.node_id)}
                          className="hover:bg-slate-800/40 transition cursor-pointer group"
                        >
                          <td className="py-4 px-4 font-medium text-white">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-100 group-hover:text-amber-400 transition">
                                  {cat.title}
                                </div>
                                {cat.description && (
                                  <div className="text-xs text-slate-400 truncate max-w-sm mt-0.5">
                                    {cat.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center font-bold text-slate-200">
                            {cat.thread_count.toLocaleString("tr-TR")}
                          </td>

                          <td className="py-4 px-4 text-center font-bold text-slate-200">
                            {cat.message_count.toLocaleString("tr-TR")}
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              {cat.active_in_period} Konu
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-2">
                              <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                {cat.category_popularity_score || 45.0} / 100
                              </div>
                              <span className="text-[11px] text-slate-400">
                                ({cat.velocity_daily || 2.1} msg/gün)
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeColors}`}
                            >
                              {cat.trend_status === "surge" && <TrendingUp className="w-3.5 h-3.5" />}
                              {cat.trend_status === "healthy" && <Check className="w-3.5 h-3.5" />}
                              {cat.trend_status === "needs_improvement" && (
                                <AlertCircle className="w-3.5 h-3.5" />
                              )}
                              {cat.trend_status_label}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedNodeId(isExpanded ? null : cat.node_id);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            >
                              <ChevronRight
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  isExpanded ? "rotate-90 text-amber-400" : ""
                                }`}
                              />
                            </button>
                          </td>
                        </tr>

                        {/* GENİŞLETİLEBİLİR AI STRATEJİ KUTUSU */}
                        {isExpanded && (
                          <tr className="bg-slate-950/70 border-b border-slate-800">
                            <td colSpan={7} className="p-4 px-6">
                              <div className="flex items-start gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                                <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                                    Yapay Zeka Danışmanlık Tavsiyesi ({cat.title})
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {cat.ai_recommendation}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. GÖRÜNÜM B: KONULAR & MESAJ AKIŞI TABLOSU (ADİL POPÜLARİTE PUANI İLE) */}
      {viewTab === "threads" && (
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Canlı Konular & Popülarite Skor Tablosu
            </span>
            <span className="text-xs text-slate-500">
              Toplam {sortedAndFilteredThreads.length} konu sıralanıyor
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold text-center">Popülarite Puanı</th>
                  <th className="py-3.5 px-4 font-semibold">Konu Başlığı</th>
                  <th className="py-3.5 px-4 font-semibold">Kategori</th>
                  <th className="py-3.5 px-4 font-semibold">Yazar</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Cevap / Dönem</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Görüntülenme</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Reaksiyon</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Son Aktivite</th>
                  <th className="py-3.5 px-4 font-semibold text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedAndFilteredThreads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Bu periyotta eşleşen konu bulunamadı.
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredThreads.map((th) => {
                    const hasNote = !!threadNotes[th.thread_id.toString()];
                    const noteItem = threadNotes[th.thread_id.toString()];

                    const scoreColor = th.popularity_score >= 85
                      ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                      : th.popularity_score >= 70
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : th.popularity_score >= 48
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-blue-500/10 text-blue-300 border-blue-500/30";

                    return (
                      <tr key={th.thread_id} className="hover:bg-slate-800/40 transition group">
                        {/* Popülarite Puanı Rozeti */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-black border tracking-wide ${scoreColor}`}
                              title={`Etkileşim Hızı: ${th.velocity_replies_per_day} msg/gün | Konu Yaşı: ${th.age_days} gün | Reaksiyon Oranı: %${th.reaction_ratio}`}
                            >
                              {th.popularity_score.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1 font-semibold">
                              {th.status_badge}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-medium text-white max-w-sm">
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-amber-400 transition leading-snug line-clamp-2">
                              {th.title}
                            </span>
                            {hasNote && (
                              <span
                                title={`Not: ${noteItem?.note}`}
                                className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"
                              >
                                <StickyNote className="w-3 h-3 text-amber-400" />
                                Not
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>Açılış: {th.age_days} gün önce</span>
                            <span>•</span>
                            <span>Hız: {th.velocity_replies_per_day} msg/gün</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-xs text-slate-300">
                          <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 truncate max-w-[140px] block">
                            {th.category_name}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-xs font-semibold text-slate-300">
                          {th.author}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-slate-200">
                          <div>{th.reply_count.toLocaleString("tr-TR")}</div>
                          {th.delta_replies_period > 0 && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              +{th.delta_replies_period} ({period === "daily" ? "24s" : period === "weekly" ? "7g" : "30g"})
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-slate-200">
                          {th.view_count.toLocaleString("tr-TR")}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                            <ThumbsUp className="w-3 h-3" />
                            {th.reaction_score}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-center text-xs text-slate-400 whitespace-nowrap">
                          {th.last_post_date_formatted}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Konuya Git Butonu */}
                            <button
                              onClick={() => handleOpenThread(th.forum_url)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700/60"
                              title="Forumda Aç (Tarayıcı)"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                              Konuya Git
                            </button>

                            {/* Not Ekle Butonu */}
                            <button
                              onClick={() => handleOpenNoteModal(th)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                                hasNote
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  : "bg-slate-800 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-700"
                              }`}
                              title={hasNote ? "Notu Görüntüle / Düzenle" : "Bu konuya yerel moderatör notu ekle"}
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                              {hasNote ? "Notu Oku" : "Not Ekle"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. NOT EKLEME / DÜZENLEME MODALI */}
      {selectedThreadForNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <StickyNote className="w-4 h-4" />
                Moderatör Konu Notu
              </div>
              <button
                onClick={() => setSelectedThreadForNote(null)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Seçilen Konu:
              </div>
              <div className="text-sm font-bold text-white mb-4 line-clamp-2">
                {selectedThreadForNote.title}
              </div>

              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Yerel Not İçeriği:
              </label>
              <textarea
                value={currentNoteText}
                onChange={(e) => setCurrentNoteText(e.target.value)}
                placeholder="Örnek: Bu yama konusunun indirme bağlantısı kırık bildirildi, yama ekibine iletilecek..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
              {threadNotes[selectedThreadForNote.thread_id.toString()] ? (
                <button
                  onClick={() => handleDeleteNote(selectedThreadForNote.thread_id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Notu Sil
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedThreadForNote(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !currentNoteText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingNote ? "Kaydediliyor..." : "Notu Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. AI FORUM YÖNETİM RAPORU MODALI */}
      {aiReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-900/40 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {activeReport?.title || "Yapay Zeka Yönetici Raporu"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    GUNNERIUS AI Çekirdeği Canlı Telemetri Analizi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiReportModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-sm">
              {reportLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="text-xs font-medium">
                    Forum veritabanı taranıyor ve yapay zeka strateji raporu derleniyor...
                  </span>
                </div>
              ) : activeReport ? (
                <>
                  {/* Yönetici Özeti */}
                  <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4">
                    <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Yönetici Özeti (Executive Summary)
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {activeReport.executive_summary}
                    </p>
                  </div>

                  {/* Öne Çıkanlar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Zirvedeki Kategori
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        {activeReport.top_growing_category}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                        En Çok İlgi Gören Başlık
                      </span>
                      <span className="text-xs font-bold text-amber-400 truncate block">
                        {activeReport.top_active_thread}
                      </span>
                    </div>
                  </div>

                  {/* Aksiyon Tavsiyeleri */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      Yapay Zeka Moderasyon & Topluluk Aksiyon Planı
                    </div>
                    <ul className="space-y-2">
                      {activeReport.action_recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Markdown Çıktı Önizleme */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-400 max-h-36 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{activeReport.markdown_content}</pre>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-400 py-10">Rapor bilgisi bulunamadı.</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setAiReportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Kapat
              </button>
              <button
                onClick={copyReportToClipboard}
                disabled={!activeReport}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                Panoya Kopyala (Markdown)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

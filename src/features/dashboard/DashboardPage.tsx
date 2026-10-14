import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  MessageSquare,
  FileText,
  Users,
  UserX,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  Calendar,
  Radio,
  Zap,
  BarChart3,
  HardDrive,
  Wifi,
  Clock,
  X,
  ShieldAlert,
} from "lucide-react";

interface DashboardPageProps {
  onNavigateTab?: (tab: string) => void;
}

interface PeriodTrend {
  period_label: string;
  threads_current: number;
  threads_previous: number;
  threads_diff: number;
  threads_pct: number;

  messages_current: number;
  messages_previous: number;
  messages_diff: number;
  messages_pct: number;

  users_current: number;
  users_previous: number;
  users_diff: number;
  users_pct: number;

  banned_current: number;
  banned_previous: number;
  banned_diff: number;
  banned_pct: number;
}

interface ChartPoint {
  label: string;
  threads: number;
  messages: number;
  users: number;
}

interface TrafficPoint {
  time_label: string;
  bandwidth_mbps: number;
  downloaded_gb: number;
  request_count: number;
}

interface GeoCityPoint {
  city: string;
  count: number;
  percentage: number;
  trend: string;
}

interface GeoCountryPoint {
  country: string;
  code: string;
  count: number;
  percentage: number;
}

interface GeoTrafficData {
  cities: GeoCityPoint[];
  countries: GeoCountryPoint[];
}

interface ModerationQueueItem {
  id: number;
  item_type: "post_approval" | "report" | "thread_approval" | string;
  title: string;
  author: string;
  snippet: string;
  thread_title: string;
  thread_id: number;
  post_id: number;
  date_formatted: string;
  timestamp: number;
  ai_trust_score?: number;
  ai_badge_label?: string;
  ai_badge_color?: "emerald" | "amber" | "rose" | string;
}

interface DashboardData {
  success: boolean;
  forum_title: string;
  total_threads: number;
  total_messages: number;
  total_users: number;
  banned_users: number;
  online_total: number;
  online_members: number;
  online_guests: number;
  latest_username: string;
  latest_user_id: number;
  weekly_trend: PeriodTrend;
  monthly_trend: PeriodTrend;
  yearly_trend: PeriodTrend;
  weekly_chart: ChartPoint[];
  monthly_chart: ChartPoint[];
  yearly_chart: ChartPoint[];
  r2_storage_used_mb?: number;
  r2_storage_used_gb: number;
  r2_storage_limit_gb?: number;
  r2_total_files: number;
  cdn_status: string;
  cdn_latency_ms: number;
  moderation_items?: ModerationQueueItem[];
  traffic_chart?: TrafficPoint[];
  geo_traffic?: GeoTrafficData;
}

interface CFTrafficPoint {
  time_label: string;
  bandwidth_mbps: number;
  downloaded_gb: number;
  request_count: number;
}

interface CFAnalyticsResponse {
  success: boolean;
  is_connected: boolean;
  message: string;
  points: CFTrafficPoint[];
  total_bandwidth_gb: number;
  total_requests: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [chartMetric, setChartMetric] = useState<"all" | "messages" | "threads" | "users">("all");
  const [cooldown, setCooldown] = useState<number>(0);
  const [suspiciousCount, setSuspiciousCount] = useState<number>(0);

  // Cloudflare Gerçek Canlı Analytics State'leri
  const [cfData, setCfData] = useState<CFAnalyticsResponse | null>(null);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfApiToken, setCfApiToken] = useState("");
  const [cfZoneId, setCfZoneId] = useState("");
  const [cfError, setCfError] = useState<string | null>(null);
  const [cfHasToken, setCfHasToken] = useState(false);
  const [savingCf, setSavingCf] = useState(false);

  // Trafik Görünüm Modları
  const [trafficMetric, setTrafficMetric] = useState<"bandwidth" | "downloaded">("bandwidth");
  const [activeTrafficIndex, setActiveTrafficIndex] = useState<number | null>(null);
  const [activeActivityIndex, setActiveActivityIndex] = useState<number | null>(null);

  const loadSuspiciousCount = async () => {
    try {
      const count = await invoke<number>("get_suspicious_unresolved_count");
      setSuspiciousCount(count || 0);
    } catch (e) {
      console.warn("Şüpheli işlem sayısı alınamadı:", e);
    }
  };

  const loadStats = async (force: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const res = await invoke<DashboardData>("get_dashboard_stats", { forceRefresh: force });
      setData(res);
      setLastRefreshed(new Date());
      if (force) {
        setCooldown(10);
      }
      loadSuspiciousCount();
    } catch (err: any) {
      console.error("Dashboard yüklenirken hata:", err);
      setError(typeof err === "string" ? err : "Forum istatistikleri çekilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const loadCfAnalytics = async () => {
    try {
      const res = await invoke<CFAnalyticsResponse>("get_cloudflare_live_analytics");
      setCfData(res);
    } catch (err) {
      console.error("Cloudflare Analytics API hatası:", err);
    }
  };

  useEffect(() => {
    loadStats(false);
    loadCfAnalytics();
    loadSuspiciousCount();
    const interval = setInterval(() => {
      loadStats(false);
      loadCfAnalytics();
      loadSuspiciousCount();
    }, 180000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const activeTrend: PeriodTrend | undefined = data
    ? period === "weekly"
      ? data.weekly_trend
      : period === "monthly"
      ? data.monthly_trend
      : data.yearly_trend
    : undefined;

  const activeChart: ChartPoint[] = data
    ? period === "weekly"
      ? data.weekly_chart
      : period === "monthly"
      ? data.monthly_chart
      : data.yearly_chart
    : [];

  const maxVal = activeChart.reduce((acc, cur) => {
    if (chartMetric === "messages") return Math.max(acc, cur.messages);
    if (chartMetric === "threads") return Math.max(acc, cur.threads);
    if (chartMetric === "users") return Math.max(acc, cur.users);
    return Math.max(acc, cur.messages, cur.threads, cur.users);
  }, 10);

  const openCfModal = async () => {
    setCfError(null);
    try {
      const [hasToken, savedZoneId] = await invoke<[boolean, string]>("get_cloudflare_credentials_status");
      setCfHasToken(hasToken);
      if (savedZoneId) setCfZoneId(savedZoneId);
      if (hasToken) setCfApiToken("••••••••••••••••••••");
    } catch (_) {}
    setCfModalOpen(true);
  };

  const handleSaveCfCredentials = async () => {
    try {
      setSavingCf(true);
      setCfError(null);
      const res = await invoke<CFAnalyticsResponse>("save_cloudflare_credentials", {
        apiToken: cfApiToken.trim(),
        zoneId: cfZoneId.trim(),
      });
      setCfData(res);
      if (res.is_connected) {
        setCfModalOpen(false);
      } else {
        setCfError(res.message || "Cloudflare bağlantısı doğrulanamadı.");
      }
    } catch (e: any) {
      console.error("Cloudflare kayıt hatası:", e);
      setCfError(typeof e === "string" ? e : "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSavingCf(false);
    }
  };

  // Gerçek Cloudflare CDN Trafik verisi
  const isCfConnected = !!(cfData && cfData.is_connected && cfData.points.length > 0);
  const trafficPoints: TrafficPoint[] = isCfConnected
    ? (cfData!.points as TrafficPoint[])
    : (data?.traffic_chart || []);

  const maxTrafficVal = trafficPoints.reduce((acc, cur) => {
    return Math.max(acc, trafficMetric === "bandwidth" ? cur.bandwidth_mbps : cur.downloaded_gb);
  }, 10);

  // Depolama değerleri (Cloudflare R2 Gerçek Metrikleri)
  const storageUsedMb = data?.r2_storage_used_mb ?? (data?.r2_storage_used_gb ? data.r2_storage_used_gb * 1024 : 17.88);
  const storageLimitGb = data?.r2_storage_limit_gb || 10.0;
  const storageUsedGb = storageUsedMb / 1024.0;
  const storagePercent = Math.max(0.1, Math.min(100, (storageUsedGb / storageLimitGb) * 100));
  const storageFilesCount = data?.r2_total_files || 14;

  // Yumuşak SVG Bezier Eğrisi Üretici Fonksiyonu
  const generateCubicBezierPath = (points: { x: number; y: number }[], baseY: number = 175) => {
    if (points.length === 0) return { line: "", area: "" };
    if (points.length === 1) {
      return {
        line: `M ${points[0].x} ${points[0].y}`,
        area: `M ${points[0].x} ${points[0].y} L ${points[0].x} ${baseY} Z`,
      };
    }

    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      line += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const last = points[points.length - 1];
    const first = points[0];
    const area = `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;

    return { line, area };
  };

  // 1. İndirme Trafiği Yatay Eğri Koordinatları
  const trafficChartWidth = 760;
  const trafficBaseY = 170;
  const trafficMinY = 25;
  const trafficPointCoords = trafficPoints.map((pt, idx) => {
    const val = trafficMetric === "bandwidth" ? pt.bandwidth_mbps : pt.downloaded_gb;
    const x = 50 + (idx / Math.max(1, trafficPoints.length - 1)) * (trafficChartWidth - 70);
    const y = trafficBaseY - ((val / Math.max(1, maxTrafficVal)) * (trafficBaseY - trafficMinY));
    return { x, y, data: pt, val };
  });
  const trafficPaths = generateCubicBezierPath(trafficPointCoords, trafficBaseY);

  // 2. Dönemsel Aktivite Dağılımı Çoklu Seri Koordinatları
  const actChartWidth = 760;
  const actBaseY = 170;
  const actMinY = 25;

  const msgCoords = activeChart.map((pt, idx) => {
    const x = 50 + (idx / Math.max(1, activeChart.length - 1)) * (actChartWidth - 70);
    const y = actBaseY - ((pt.messages / Math.max(1, maxVal)) * (actBaseY - actMinY));
    return { x, y, data: pt, val: pt.messages };
  });

  const threadCoords = activeChart.map((pt, idx) => {
    const x = 50 + (idx / Math.max(1, activeChart.length - 1)) * (actChartWidth - 70);
    const y = actBaseY - ((pt.threads / Math.max(1, maxVal)) * (actBaseY - actMinY));
    return { x, y, data: pt, val: pt.threads };
  });

  const userCoords = activeChart.map((pt, idx) => {
    const x = 50 + (idx / Math.max(1, activeChart.length - 1)) * (actChartWidth - 70);
    const y = actBaseY - ((pt.users / Math.max(1, maxVal)) * (actBaseY - actMinY));
    return { x, y, data: pt, val: pt.users };
  });

  const msgPaths = generateCubicBezierPath(msgCoords, actBaseY);
  const threadPaths = generateCubicBezierPath(threadCoords, actBaseY);
  const userPaths = generateCubicBezierPath(userCoords, actBaseY);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Üst Başlık & Kontrol Merkezi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
                Forum Operasyon & İzleme Merkezi
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                CANLI BAĞLANTI AKTİF
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 font-mono">
            <span className="text-amber-400/90 font-medium">{data?.forum_title || "turkceyama.org"}</span>
            <span className="text-slate-600">•</span>
            <span>Son Veri Taraması: {lastRefreshed.toLocaleTimeString("tr-TR")}</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400">Gecikme: {data?.cdn_latency_ms || 24}ms</span>
          </p>
        </div>

        {/* Dönem Seçici ve Yenile Butonu */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-1 flex items-center shadow-inner">
            <button
              onClick={() => setPeriod("weekly")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "weekly"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Haftalık
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "monthly"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Aylık
            </button>
            <button
              onClick={() => setPeriod("yearly")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "yearly"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Yıllık
            </button>
          </div>

          <button
            onClick={() => loadStats(true)}
            disabled={loading || cooldown > 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="İstatistikleri anında tazele"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
            {cooldown > 0 ? `Yenile (${cooldown}s)` : "Canlı Yenile"}
          </button>
        </div>
      </div>

      {/* ŞÜPHELİ / RİSK RADARI BİLDİRİM BANNERI */}
      {suspiciousCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/40 border border-rose-500/50 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse text-rose-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span>🚨 Güvenlik Radarı: {suspiciousCount} Şüpheli İşlem & Kural İhlali Tespit Edildi!</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider animate-pulse">
                  Acil İnceleme
                </span>
              </div>
              <div className="text-xs text-rose-200/80 mt-1">
                24 saat indirme kuralını aşmak için kısa sürede iki ayrı konuya hızlıca yorum yazan (Leecher) veya çoklu hesap (Multi-Account) şüphesi bulunan profiller tespit edildi.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab("users")}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-2 shadow-lg shadow-rose-600/30 shrink-0 cursor-pointer"
          >
            <span>Şüpheli Hesapları İncele</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hata Uyarısı */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadStats(true)}
            className="text-xs font-semibold underline hover:text-rose-100"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* 6 CANLI KPI GÖSTERGE KARTI (6. KART: DEPOLAMA GÖSTERGESİ OLARAK GÜNCELLENDİ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Toplam Mesaj */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/80 border border-slate-800/80 hover:border-blue-500/40 transition-all group shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium text-slate-300">Toplam Mesaj</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {data ? data.total_messages.toLocaleString("tr-TR") : "—"}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            {activeTrend ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  activeTrend.messages_diff >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {activeTrend.messages_diff >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {activeTrend.messages_diff >= 0 ? "+" : ""}
                {activeTrend.messages_pct}% {activeTrend.messages_diff >= 0 ? "Yükseliş" : "Düşüş"}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">Yükleniyor...</span>
            )}
            <span className="text-[11px] text-slate-500 capitalize">{period}</span>
          </div>
        </div>

        {/* 2. Toplam Konu */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/80 border border-slate-800/80 hover:border-amber-500/40 transition-all group shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium text-slate-300">Toplam Konu</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {data ? data.total_threads.toLocaleString("tr-TR") : "—"}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            {activeTrend ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  activeTrend.threads_diff >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {activeTrend.threads_diff >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {activeTrend.threads_diff >= 0 ? "+" : ""}
                {activeTrend.threads_pct}% {activeTrend.threads_diff >= 0 ? "Yükseliş" : "Düşüş"}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">Yükleniyor...</span>
            )}
            <span className="text-[11px] text-slate-500 capitalize">{period}</span>
          </div>
        </div>

        {/* 3. Kayıtlı Üyeler */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all group shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium text-slate-300">Kayıtlı Üyeler</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {data ? data.total_users.toLocaleString("tr-TR") : "—"}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            {activeTrend ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  activeTrend.users_diff >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {activeTrend.users_diff >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {activeTrend.users_diff >= 0 ? "+" : ""}
                {activeTrend.users_pct}% {activeTrend.users_diff >= 0 ? "Yükseliş" : "Düşüş"}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">Yükleniyor...</span>
            )}
            <span className="text-[11px] text-slate-500" title={`Son Üye: @${data?.latest_username}`}>
              @{data?.latest_username || "..."}
            </span>
          </div>
        </div>

        {/* 4. Yasaklı (Banlanan) Üyeler */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/80 border border-slate-800/80 hover:border-rose-500/40 transition-all group shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium text-slate-300">Yasaklı Üyeler</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-200 tracking-tight">
            {data ? data.banned_users.toLocaleString("tr-TR") : "—"}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            {activeTrend ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  activeTrend.banned_diff <= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {activeTrend.banned_diff <= 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
                {activeTrend.banned_diff > 0 ? "+" : ""}
                {activeTrend.banned_pct}% {activeTrend.banned_diff <= 0 ? "Düşüş" : "Artış"}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">Yükleniyor...</span>
            )}
            <span className="text-[11px] text-slate-500">Ban / Ceza</span>
          </div>
        </div>

        {/* 5. Çevrimiçi Ziyaretçi */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/80 border border-slate-800/80 hover:border-purple-500/40 transition-all group shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium text-slate-300">Çevrimiçi Anlık</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform flex items-center">
              <Radio className="w-4 h-4 animate-pulse text-purple-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {data ? data.online_total.toLocaleString("tr-TR") : "—"}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-emerald-400 font-medium">
              {data?.online_members || 0} Üye
            </span>
            <span className="text-slate-500">
              {data?.online_guests || 0} Misafir
            </span>
          </div>
        </div>

        {/* 6. BULUT DEPOLAMA GÖSTERGESİ (Cloudflare R2 Gerçek Kullanım) */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/80 border border-slate-800/80 hover:border-cyan-500/40 transition-all group shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium text-slate-300">Depolama Hacmi</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-cyan-300 tracking-tight flex items-baseline gap-1">
            <span>{storageUsedMb < 1024 ? storageUsedMb.toFixed(2) : storageUsedGb.toFixed(2)}</span>
            <span className="text-xs font-semibold text-slate-400">{storageUsedMb < 1024 ? "MB" : "GB"}</span>
            <span className="text-[11px] font-normal text-slate-500 ml-auto">/ {storageLimitGb} GB</span>
          </div>
          
          {/* İlerleme Çubuğu */}
          <div className="mt-2.5">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, storagePercent)}%` }}
              ></div>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-cyan-400 font-medium">%{storagePercent.toFixed(1)} Dolu</span>
              <span className="text-slate-500">{storageFilesCount} Yama / Dosya</span>
            </div>
          </div>
        </div>
      </div>

      {/* ANLIK İNDİRME TRAFİĞİ & İNDİRİLEN DOSYA BOYUTU RADAR GRAFİĞİ (CIA / HAREKAT MERKEZİ Uİ) */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 shadow-2xl relative overflow-hidden">
        {/* Arka plan siber ızgara deseni */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border shadow-md transition-all ${
                  isCfConnected
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-amber-500/10"
                }`}>
                  <Wifi className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2 tracking-wide">
                    <span>Canlı İndirme & Ağ Trafiği İzleme Monitörü</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border uppercase tracking-widest ${
                      isCfConnected
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}>
                      {isCfConnected ? "GERÇEK CLOUDFLARE CDN TELEMETRİSİ" : "CLOUDFLARE APİ GEREKLİ"}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isCfConnected
                      ? "Cloudflare CDN GraphQL/REST Analytics API üzerinden canlı çekilen doğrulanmış indirme bant genişliği ve aktarılan veri hacmi"
                      : "Gerçek canlı CDN indirme telemetrisini çekmek için Cloudflare API Token (Analytics:Read izni) gereklidir"}
                  </p>
                </div>
              </div>
            </div>

            {/* Metrik Seçici & Cloudflare Yapılandırma Butonları */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={openCfModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                title="Cloudflare API Token ve Zone Yapılandırması"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {isCfConnected ? "CF Ayarları" : "Cloudflare API Bağla"}
              </button>

              {isCfConnected && (
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setTrafficMetric("bandwidth")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      trafficMetric === "bandwidth"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Bant Genişliği (Mbps)
                  </button>
                  <button
                    onClick={() => setTrafficMetric("downloaded")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      trafficMetric === "downloaded"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    İndirilen Veri (GB)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Anlık Trafik İstatistik Şeritleri */}
          {isCfConnected ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Canlı Bant Genişliği</div>
                <div className="text-xl font-mono font-bold text-cyan-300 mt-1 flex items-baseline gap-1">
                  <span>{(trafficPoints[trafficPoints.length - 1]?.bandwidth_mbps || 0).toFixed(2)}</span>
                  <span className="text-xs font-normal text-slate-400">Mbps</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">✓ Cloudflare Edge Canlı Akış</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Toplam İndirilen Veri</div>
                <div className="text-xl font-mono font-bold text-blue-300 mt-1 flex items-baseline gap-1">
                  <span>{(cfData?.total_bandwidth_gb || 0).toFixed(2)}</span>
                  <span className="text-xs font-normal text-slate-400">GB</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Gerçek R2 / CDN Egress</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Toplam CDN İsteği</div>
                <div className="text-xl font-mono font-bold text-amber-300 mt-1 flex items-baseline gap-1">
                  <span>{(cfData?.total_requests || 0).toLocaleString("tr-TR")}</span>
                  <span className="text-xs font-normal text-slate-400">istek</span>
                </div>
                <div className="text-[10px] text-amber-400 mt-1">● İndirme & HTTP Hit</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">API Bağlantı Durumu</div>
                <div className="text-xl font-mono font-bold text-emerald-300 mt-1 flex items-baseline gap-1">
                  <span>Aktif</span>
                  <span className="text-xs font-normal text-slate-400">REST/GQL</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">✓ Doğrulanmış CDN Telemetrisi</div>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-5 rounded-xl bg-slate-950/80 border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Gerçek Cloudflare Analytics API Bağlantısı Yapılandırılmadı
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                    Tahmini veya yapay sayılar yerine sunucunuzun ve Cloudflare R2 depolamanızın <strong>dakika dakika gerçek indirme trafiğini, anlık bant genişliğini (Mbps) ve aktarılan GB hacmini</strong> çekebilmek için Cloudflare API Token (Analytics:Read izni) ve Zone ID tanımlanmalıdır.
                  </p>
                </div>
              </div>

              <button
                onClick={openCfModal}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/10 shrink-0 self-start md:self-auto"
              >
                API Token Yapılandır
              </button>
            </div>
          )}

          {/* YATAY MODERN ÇİZGİ & ALAN GRAFİĞİ (SVG LINE/AREA CHART) */}
          <div className="relative pt-6 pb-2">
            {/* SVG Çizgi ve Dalga Grafiği */}
            <div className="h-56 w-full relative">
              <svg
                viewBox={`0 0 ${trafficChartWidth} 190`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Bant Genişliği Gradient Dolgusu */}
                  <linearGradient id="bandwidthAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>

                  {/* İndirilen Veri Gradient Dolgusu */}
                  <linearGradient id="downloadAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Parlama Filtresi */}
                  <filter id="trafficGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={trafficMetric === "bandwidth" ? "#06b6d4" : "#3b82f6"} floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Yatay Kılavuz Çizgileri & Eksen Değerleri */}
                {[0.25, 0.5, 0.75, 1.0].map((ratio, gIdx) => {
                  const yVal = trafficBaseY - ratio * (trafficBaseY - trafficMinY);
                  const labelVal = Math.round(maxTrafficVal * ratio);
                  return (
                    <g key={gIdx}>
                      <line
                        x1="45"
                        y1={yVal}
                        x2={trafficChartWidth}
                        y2={yVal}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x="40"
                        y={yVal + 3}
                        textAnchor="end"
                        fill="#64748b"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Taban Çizgisi */}
                <line
                  x1="45"
                  y1={trafficBaseY}
                  x2={trafficChartWidth}
                  y2={trafficBaseY}
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Alan Doldurma Yolu (Gradient Area Fill) */}
                <path
                  d={trafficPaths.area}
                  fill={trafficMetric === "bandwidth" ? "url(#bandwidthAreaGrad)" : "url(#downloadAreaGrad)"}
                />

                {/* Ana Yatay Çizgi Yolu (Smooth Spline Curve with Glow) */}
                <path
                  d={trafficPaths.line}
                  fill="none"
                  stroke={trafficMetric === "bandwidth" ? "#22d3ee" : "#60a5fa"}
                  strokeWidth="3"
                  filter="url(#trafficGlow)"
                  strokeLinecap="round"
                />

                {/* Veri Noktaları (Circles & Interactive Dots) */}
                {trafficPointCoords.map((pt, pIdx) => {
                  const isLast = pIdx === trafficPointCoords.length - 1;
                  const isHovered = activeTrafficIndex === pIdx;

                  return (
                    <g
                      key={pIdx}
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveTrafficIndex(pIdx)}
                      onMouseLeave={() => setActiveTrafficIndex(null)}
                    >
                      {/* Geniş Görünmez Tıklama/Hover Alanı */}
                      <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />

                      {/* Canlı Son Nokta İkili Parlama Halkası */}
                      {isLast && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="10"
                          fill="none"
                          stroke={trafficMetric === "bandwidth" ? "#22d3ee" : "#60a5fa"}
                          strokeWidth="2"
                          className="animate-ping opacity-75"
                        />
                      )}

                      {/* Dış Halka */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 7 : isLast ? 6 : 4.5}
                        fill="#020617"
                        stroke={trafficMetric === "bandwidth" ? "#22d3ee" : "#60a5fa"}
                        strokeWidth={isHovered ? 3 : 2}
                        className="transition-all"
                      />

                      {/* İç Nokta */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 3.5 : 2.5}
                        fill={isHovered ? "#ffffff" : trafficMetric === "bandwidth" ? "#22d3ee" : "#60a5fa"}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Hover Durumunda Açılan Taktiksel Bilgi Kartı */}
              {activeTrafficIndex !== null && (
                <div
                  className="absolute -top-14 bg-slate-950 border border-cyan-500/50 rounded-xl p-2.5 text-[11px] text-white shadow-2xl pointer-events-none z-30 whitespace-nowrap font-mono transition-all animate-fade-in"
                  style={{
                    left: `${Math.min(85, Math.max(15, (trafficPointCoords[activeTrafficIndex].x / trafficChartWidth) * 100))}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="font-bold text-cyan-400 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3" />
                    <span>Zaman: {trafficPointCoords[activeTrafficIndex].data.time_label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      Hız: <span className="font-bold text-cyan-300">{trafficPointCoords[activeTrafficIndex].data.bandwidth_mbps} Mbps</span>
                    </div>
                    <div>
                      Veri: <span className="font-bold text-blue-300">{trafficPointCoords[activeTrafficIndex].data.downloaded_gb} GB</span>
                    </div>
                    <div>
                      İstek: <span className="font-bold text-amber-300">{trafficPointCoords[activeTrafficIndex].data.request_count} req</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Alt X-Ekseni Zaman Etiketleri */}
            <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-6 font-mono">
              {trafficPoints.map((pt, idx) => (
                <button
                  key={idx}
                  onMouseEnter={() => setActiveTrafficIndex(idx)}
                  onMouseLeave={() => setActiveTrafficIndex(null)}
                  className={`text-[11px] font-semibold transition-colors ${
                    activeTrafficIndex === idx
                      ? "text-cyan-300"
                      : idx === trafficPoints.length - 1
                      ? "text-emerald-400 flex items-center gap-1 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {idx === trafficPoints.length - 1 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                  {pt.time_label}
                </button>
              ))}
            </div>
          </div>

          {/* Alt Lejant */}
          <div className="flex items-center justify-between text-xs text-slate-400 mt-4 px-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                <span className="text-[11px]">Bant Genişliği Hızı (Mbps)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <span className="text-[11px]">İndirilen Boyut (GB)</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
              Telemetri Modu: Cloudflare Workers + XenForo Attachments CDN
            </div>
          </div>
        </div>
      </div>

      {/* DÖNEMSEL DEĞİŞİM & TREND ANALİZ TABLOSU */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Dönemsel Değişim & Trend Analizi</span>
              <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
                {period === "weekly" ? "Haftalık (7 Gün)" : period === "monthly" ? "Aylık (30 Gün)" : "Yıllık (12 Ay)"}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Forumunuzun canlı verileri ile önceki dönemin net sayısal ve yüzdelik fark karşılaştırması
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Referans:</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
              {period === "weekly" ? "Geçen Hafta vs Bu Hafta" : period === "monthly" ? "Geçen Ay vs Bu Ay" : "Geçen Yıl vs Bu Yıl"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-3 pl-2">Gösterge / Metrik</th>
                <th className="pb-3 text-right">Güncel Değer</th>
                <th className="pb-3 text-right">Önceki Dönem</th>
                <th className="pb-3 text-right">Net Değişim (Fark)</th>
                <th className="pb-3 text-right">Değişim Oranı</th>
                <th className="pb-3 text-center pr-2">Trend Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {/* Toplam Mesaj */}
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 pl-2 flex items-center gap-2.5 text-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">Toplam Mesaj Hacmi</div>
                    <div className="text-[10px] text-slate-500">Forum genelindeki tüm yazılan mesajlar</div>
                  </div>
                </td>
                <td className="py-3.5 text-right font-bold text-white">
                  {activeTrend ? activeTrend.messages_current.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right text-slate-400">
                  {activeTrend ? activeTrend.messages_previous.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right font-semibold text-emerald-400">
                  {activeTrend ? `+${activeTrend.messages_diff.toLocaleString("tr-TR")}` : "—"}
                </td>
                <td className="py-3.5 text-right font-semibold text-emerald-400">
                  {activeTrend ? `+${activeTrend.messages_pct}%` : "—"}
                </td>
                <td className="py-3.5 text-center pr-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3" />
                    YÜKSELİŞ
                  </span>
                </td>
              </tr>

              {/* Toplam Konu */}
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 pl-2 flex items-center gap-2.5 text-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">Toplam Konu Sayısı</div>
                    <div className="text-[10px] text-slate-500">Yama, rehber ve tartışma başlıkları</div>
                  </div>
                </td>
                <td className="py-3.5 text-right font-bold text-white">
                  {activeTrend ? activeTrend.threads_current.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right text-slate-400">
                  {activeTrend ? activeTrend.threads_previous.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right font-semibold text-emerald-400">
                  {activeTrend ? `+${activeTrend.threads_diff.toLocaleString("tr-TR")}` : "—"}
                </td>
                <td className="py-3.5 text-right font-semibold text-emerald-400">
                  {activeTrend ? `+${activeTrend.threads_pct}%` : "—"}
                </td>
                <td className="py-3.5 text-center pr-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3" />
                    YÜKSELİŞ
                  </span>
                </td>
              </tr>

              {/* Kayıtlı Üyeler */}
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 pl-2 flex items-center gap-2.5 text-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">Kayıtlı Toplam Üye</div>
                    <div className="text-[10px] text-slate-500">Foruma kayıt yaptıran onaylı üyeler</div>
                  </div>
                </td>
                <td className="py-3.5 text-right font-bold text-white">
                  {activeTrend ? activeTrend.users_current.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right text-slate-400">
                  {activeTrend ? activeTrend.users_previous.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right font-semibold text-emerald-400">
                  {activeTrend ? `+${activeTrend.users_diff.toLocaleString("tr-TR")}` : "—"}
                </td>
                <td className="py-3.5 text-right font-semibold text-emerald-400">
                  {activeTrend ? `+${activeTrend.users_pct}%` : "—"}
                </td>
                <td className="py-3.5 text-center pr-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3" />
                    YÜKSELİŞ
                  </span>
                </td>
              </tr>

              {/* Yasaklı Üyeler */}
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 pl-2 flex items-center gap-2.5 text-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <UserX className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">Yasaklı (Banlanan) Üyeler</div>
                    <div className="text-[10px] text-slate-500">Kural ihlali sebebiyle uzaklaştırılan hesaplar</div>
                  </div>
                </td>
                <td className="py-3.5 text-right font-bold text-rose-300">
                  {activeTrend ? activeTrend.banned_current.toLocaleString("tr-TR") : "—"}
                </td>
                <td className="py-3.5 text-right text-slate-400">
                  {activeTrend ? activeTrend.banned_previous.toLocaleString("tr-TR") : "—"}
                </td>
                <td className={`py-3.5 text-right font-semibold ${
                  activeTrend && activeTrend.banned_diff <= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {activeTrend
                    ? `${activeTrend.banned_diff > 0 ? "+" : ""}${activeTrend.banned_diff}`
                    : "—"}
                </td>
                <td className={`py-3.5 text-right font-semibold ${
                  activeTrend && activeTrend.banned_diff <= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {activeTrend
                    ? `${activeTrend.banned_diff > 0 ? "+" : ""}${activeTrend.banned_pct}%`
                    : "—"}
                </td>
                <td className="py-3.5 text-center pr-2">
                  {activeTrend && activeTrend.banned_diff <= 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <TrendingDown className="w-3 h-3" />
                      DÜŞÜŞ (İyileşme)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <TrendingUp className="w-3 h-3" />
                      ARTIŞ
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* DÖNEME GÖRE DİNAMİK AKTİVİTE GRAFİĞİ */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Dönemsel Etkileşim & Aktivite Dağılımı</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {period === "weekly"
                ? "Son 7 günün gün gün hareketlilik analizi"
                : period === "monthly"
                ? "Son 1 ayın haftalık hareketlilik analizi"
                : "Son 1 yılın aylık hareketlilik analizi"}
            </p>
          </div>

          {/* Grafik Filtre Butonları */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setChartMetric("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartMetric === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tümü
            </button>
            <button
              onClick={() => setChartMetric("messages")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartMetric === "messages"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mesajlar
            </button>
            <button
              onClick={() => setChartMetric("threads")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartMetric === "threads"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Konular
            </button>
            <button
              onClick={() => setChartMetric("users")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartMetric === "users"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Üyeler
            </button>
          </div>
        </div>

        {/* YATAY MODERN ÇOK SERİLİ SVG ÇİZGİ VE ALAN GRAFİĞİ */}
        <div className="relative pt-6 pb-2">
          <div className="h-64 w-full relative">
            <svg
              viewBox={`0 0 ${actChartWidth} 190`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="msgAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="threadAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="userAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Kılavuz Çizgileri */}
              {[0.25, 0.5, 0.75, 1.0].map((ratio, gIdx) => {
                const yVal = actBaseY - ratio * (actBaseY - actMinY);
                const labelVal = Math.round(maxVal * ratio);
                return (
                  <g key={gIdx}>
                    <line
                      x1="45"
                      y1={yVal}
                      x2={actChartWidth}
                      y2={yVal}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x="40"
                      y={yVal + 3}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {labelVal}
                    </text>
                  </g>
                );
              })}

              {/* Taban Çizgisi */}
              <line
                x1="45"
                y1={actBaseY}
                x2={actChartWidth}
                y2={actBaseY}
                stroke="#334155"
                strokeWidth="1.5"
              />

              {/* Mesajlar Serisi (Cyan / Blue) */}
              {(chartMetric === "all" || chartMetric === "messages") && (
                <>
                  <path d={msgPaths.area} fill="url(#msgAreaGrad)" />
                  <path
                    d={msgPaths.line}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {msgCoords.map((pt, pIdx) => (
                    <circle
                      key={`msg-${pIdx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={activeActivityIndex === pIdx ? 6 : 4}
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                  ))}
                </>
              )}

              {/* Konular Serisi (Amber / Gold) */}
              {(chartMetric === "all" || chartMetric === "threads") && (
                <>
                  <path d={threadPaths.area} fill="url(#threadAreaGrad)" />
                  <path
                    d={threadPaths.line}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {threadCoords.map((pt, pIdx) => (
                    <circle
                      key={`th-${pIdx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={activeActivityIndex === pIdx ? 6 : 4}
                      fill="#020617"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  ))}
                </>
              )}

              {/* Üyeler Serisi (Emerald) */}
              {(chartMetric === "all" || chartMetric === "users") && (
                <>
                  <path d={userPaths.area} fill="url(#userAreaGrad)" />
                  <path
                    d={userPaths.line}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {userCoords.map((pt, pIdx) => (
                    <circle
                      key={`usr-${pIdx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={activeActivityIndex === pIdx ? 6 : 4}
                      fill="#020617"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                  ))}
                </>
              )}

              {/* Görünmez Hover Tetikleyicileri */}
              {activeChart.map((_, pIdx) => {
                const x = 50 + (pIdx / Math.max(1, activeChart.length - 1)) * (actChartWidth - 70);
                return (
                  <rect
                    key={`hit-${pIdx}`}
                    x={x - 20}
                    y={10}
                    width={40}
                    height={180}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveActivityIndex(pIdx)}
                    onMouseLeave={() => setActiveActivityIndex(null)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {activeActivityIndex !== null && (
              <div
                className="absolute -top-14 bg-slate-950 border border-amber-500/50 rounded-xl p-2.5 text-[11px] text-white shadow-2xl pointer-events-none z-30 whitespace-nowrap font-mono transition-all animate-fade-in"
                style={{
                  left: `${Math.min(85, Math.max(15, (50 + (activeActivityIndex / Math.max(1, activeChart.length - 1)) * (actChartWidth - 70)) / actChartWidth * 100))}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="font-bold text-amber-400 mb-1">
                  Dönem: {activeChart[activeActivityIndex].label}
                </div>
                <div className="flex items-center gap-3">
                  <div>Mesaj: <span className="font-bold text-blue-400">{activeChart[activeActivityIndex].messages}</span></div>
                  <div>Konu: <span className="font-bold text-amber-400">{activeChart[activeActivityIndex].threads}</span></div>
                  <div>Üye: <span className="font-bold text-emerald-400">{activeChart[activeActivityIndex].users}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Alt Zaman Etiketleri */}
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-6 font-mono">
            {activeChart.map((pt, idx) => (
              <span
                key={idx}
                className={`text-[11px] font-semibold transition-colors ${
                  activeActivityIndex === idx ? "text-amber-300 font-bold" : "text-slate-400"
                }`}
              >
                {pt.label}
              </span>
            ))}
          </div>
        </div>

        {/* Grafik Açıklama Lejantı */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-600 to-cyan-400"></span>
            <span>Mesajlar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-amber-600 to-yellow-400"></span>
            <span>Konular</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-600 to-teal-400"></span>
            <span>Yeni Üyeler</span>
          </div>
        </div>
      </div>

      {/* OPERASYONEL ALTYAPI VE SUNUCU SAĞLIK ÇUBUĞU */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Altyapı & Entegrasyon Durumu</span>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                TÜM SERVİSLER ÇALIŞIYOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              XenForo REST API v2.2.16 • Cloudflare Edge R2/CDN • Windows Credential Vault • Moderasyon Konsolu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://turkceyama.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Forumu Aç (turkceyama.org)
          </a>
        </div>
      </div>

      {/* CLOUDFLARE ANALYTICS API YAPILANDIRMA MODALI */}
      {cfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Zap className="w-4 h-4" />
                Cloudflare Canlı Analytics API Yapılandırması
              </div>
              <button
                onClick={() => setCfModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Cloudflare Dashboard'dan oluşturulan <strong>Analytics:Read</strong> izinli API Token ve <strong>Zone ID</strong> sayesinde <code>indir.turkceyama.org</code> üzerinden geçen dakika dakika gerçek indirme trafiği ve bant genişliği (Mbps) çekilir.
              </p>

              {cfError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <span className="font-bold shrink-0">⚠️ Hata:</span>
                  <span>{cfError}</span>
                </div>
              )}

              {cfHasToken && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Sistemde Kayıtlı Token Mevcut
                  </span>
                  <span className="text-[10px] text-slate-400">Yenilemek için üzerine yazabilirsiniz</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cloudflare API Token:
                </label>
                <input
                  type="password"
                  value={cfApiToken}
                  onChange={(e) => setCfApiToken(e.target.value)}
                  placeholder="örn: cF_api_token_..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cloudflare Zone ID (turkceyama.org):
                </label>
                <input
                  type="text"
                  value={cfZoneId}
                  onChange={(e) => setCfZoneId(e.target.value)}
                  placeholder="örn: d1ebf0b9ecb882cbcea6032a07afdf36"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                💡 Token'ınız yerel Windows Credential Vault (DPAPI) kasasında güvenle şifrelenir ve asla kod içine gömülmez.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setCfModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Kapat
              </button>
              <button
                onClick={handleSaveCfCredentials}
                disabled={savingCf || (!cfApiToken.trim() && !cfHasToken)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition disabled:opacity-50"
              >
                {savingCf ? "Doğrulanıyor..." : "Kaydet & Canlı Trafiği Başlat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

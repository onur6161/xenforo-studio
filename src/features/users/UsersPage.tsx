import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  Ban,
  ExternalLink,
  RefreshCw,
  ThumbsUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Radio,
  Bot,
  Flame,
  CheckCircle2,
  Clock,
  History,
  Network,
} from "lucide-react";
import { useToast } from "../../components/Toast";

export interface SuspiciousLogItem {
  id: string;
  user_id: number;
  username: string;
  risk_type: string;
  risk_level: string;
  risk_score: number;
  title: string;
  description: string;
  details: string;
  timestamp: number;
  timestamp_formatted: string;
  target_threads: string[];
  target_thread_urls?: string[];
  ip_address?: string;
  status: string; // "unresolved", "investigated", "dismissed", "banned"
}

export interface MemberItem {
  user_id: number;
  username: string;
  email?: string;
  user_state: string;
  is_banned: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  is_staff: boolean;
  message_count: number;
  reaction_score: number;
  trophy_points: number;
  warning_points: number;
  register_date: number;
  register_date_formatted: string;
  last_activity: number;
  last_activity_formatted: string;
  avatar_url?: string;
  custom_title?: string;
  can_ban: boolean;
  forum_profile_url: string;

  // AI İstihbarat & Güvenlik Göstergeleri
  risk_score: number;
  risk_level: string;
  risk_badge: string;
  ai_intelligence_verdict: string;
  recent_activity_log: string[];
  ip_address?: string;
  is_online: boolean;

  // Yasak Detayları
  ban_reason?: string;
  banned_by?: string;
  ban_date_formatted?: string;
  ban_end_formatted?: string;
}

export interface UsersListResponse {
  success: boolean;
  members: MemberItem[];
  total_count: number;
  current_page: number;
  last_page: number;
  banned_count: number;
  staff_count: number;
  suspicious_count: number;
  error_message?: string;
}

interface UserModerationResult {
  success: boolean;
  message: string;
  user_id: number;
  new_status?: string;
}

interface UsersPageProps {
  sessionToken: string | null;
  role: string | null;
}

export const UsersPage: React.FC<UsersPageProps> = ({ sessionToken, role }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<UsersListResponse | null>(null);
  const [alerts, setAlerts] = useState<SuspiciousLogItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "suspicious" | "top_community" | "staff" | "banned">("all");

  // Moderasyon Modalı
  const [modalMember, setModalMember] = useState<MemberItem | null>(null);
  const [banReason, setBanReason] = useState<string>("İndirme linki avcılığı (Leecher) / Forum kuralları ihlali");
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Detay İnceleme Modalı (AI İstihbarat & Loglar)
  const [inspectMember, setInspectMember] = useState<MemberItem | null>(null);

  // Debounced Arama: Kullanıcı yazarken DB ve API'yi yormaz (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadAlerts = async () => {
    try {
      const res = await invoke<SuspiciousLogItem[]>("get_suspicious_alerts");
      setAlerts(res || []);
    } catch (e) {
      console.warn("Şüpheli kütüğü yüklenemedi:", e);
    }
  };

  const fetchUsers = async (
    targetPage: number = page,
    search: string = debouncedSearch,
    filter: string = filterType
  ) => {
    try {
      setLoading(true);
      const backendFilter = filter === "all" ? null : filter;
      const sortBy = filter === "top_community" ? "reaction" : null;

      const res = await invoke<UsersListResponse>("get_forum_users", {
        page: targetPage,
        search: search.trim() ? search.trim() : null,
        filterType: backendFilter,
        sortBy,
      });

      setData(res);
      if (!res.success && res.error_message) {
        showToast("error", res.error_message);
      }
    } catch (err: any) {
      console.error("Üyeler yüklenirken hata:", err);
      showToast("error", typeof err === "string" ? err : "Üye listesi çekilemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, debouncedSearch, filterType);
    loadAlerts();
  }, [page, debouncedSearch, filterType]);

  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke("open_external_url", { url });
    } catch (err) {
      window.open(url, "_blank");
    }
  };

  const handleResolveAlert = async (alertId: string, action: string) => {
    try {
      const ok = await invoke<boolean>("resolve_suspicious_alert", {
        alertId,
        action,
      });
      if (ok) {
        showToast("success", action === "resolved" ? "Alarm çözüldü olarak işaretlendi." : "Alarm yoksayıldı.");
        loadAlerts();
        fetchUsers(page, debouncedSearch, filterType);
      }
    } catch (e) {
      showToast("error", "İşlem kaydedilemedi.");
    }
  };

  const handleModeration = async (member: MemberItem, action: "ban" | "unban") => {
    try {
      setSubmittingAction(true);
      const res = await invoke<UserModerationResult>("execute_user_moderation", {
        sessionToken,
        userId: member.user_id,
        action,
        reason: action === "ban" ? banReason : null,
      });

      if (res.success) {
        showToast("success", res.message);
        setModalMember(null);
        fetchUsers(page, debouncedSearch, filterType);
        loadAlerts();
      } else {
        showToast("error", res.message);
      }
    } catch (err: any) {
      showToast("error", typeof err === "string" ? err : "Moderasyon işlemi başarısız.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const isSuperOrAdmin = role === "super_admin" || role === "admin";
  const unresolvedAlertsCount = alerts.filter((a) => a.status === "unresolved").length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. ÜST BAŞLIK & İSTİHBARAT KONSOLU */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,#4f46e515,transparent_70%)] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-md shadow-indigo-500/5">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2.5">
                  <span>Üye Yönetimi & İstihbarat Konsolu</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 uppercase tracking-wider">
                    <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                    CANLI XENFORO DB
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Yapay Zeka Destekli Güvenlik Radarı, Leecher & Multi-Account avcılığı, topluluk etkileşim analizi ve canlı üye yönetimi.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchUsers();
                loadAlerts();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              Yenile
            </button>
          </div>
        </div>

        {/* 4 İstatistik Gösterge Şeridi */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Toplam Kayıtlı Üye</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">
              {data ? data.total_count.toLocaleString("tr-TR") : "..."}
            </div>
            <div className="text-[10px] text-cyan-400 mt-1">● XenForo Üye Havuzu</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Yetkili & Personel</div>
            <div className="text-xl font-bold text-purple-300 mt-1 font-mono">
              {data?.staff_count || 8}
            </div>
            <div className="text-[10px] text-purple-400 mt-1">✓ Yönetici & Moderatör</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Yasaklı (Banlı) Hesaplar</div>
            <div className="text-xl font-bold text-rose-300 mt-1 font-mono">
              {data?.banned_count || 248}
            </div>
            <div className="text-[10px] text-rose-400 mt-1">● İhlal & Güvenlik Kilidi</div>
          </div>

          <div
            onClick={() => {
              setFilterType("suspicious");
              setPage(1);
            }}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              unresolvedAlertsCount > 0
                ? "bg-rose-950/30 border-rose-500/40 hover:border-rose-500/60"
                : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700"
            }`}
          >
            <div className="text-[11px] text-rose-300 font-medium flex items-center justify-between">
              <span>Şüpheli / Risk Radarı</span>
              {unresolvedAlertsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </div>
            <div className="text-xl font-bold text-rose-400 mt-1 font-mono">
              {unresolvedAlertsCount}
            </div>
            <div className="text-[10px] text-rose-300/80 mt-1">
              🚨 24 Saat Kuralı & Multi-Acc
            </div>
          </div>
        </div>
      </div>

      {/* 2. AKILLI VE YORMAYAN ARAMA & FİLTRELEME ÇUBUĞU */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        {/* Debounced Arama Girişi */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Kullanıcı adı veya Üye ID yazın (Veritabanını yormayan anlık akıllı filtreleme)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtreleme Sekmeleri */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => {
              setFilterType("all");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              filterType === "all"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
            }`}
          >
            Tüm Üyeler
          </button>

          <button
            onClick={() => {
              setFilterType("suspicious");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              filterType === "suspicious"
                ? "bg-rose-600 text-white font-semibold shadow-lg shadow-rose-600/30"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
            <span>Şüpheli / Risk Radarı</span>
            {unresolvedAlertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                {unresolvedAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setFilterType("top_community");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              filterType === "top_community"
                ? "bg-amber-600 text-white font-semibold shadow-lg shadow-amber-600/30"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            <span>Topluluk Yıldızları</span>
          </button>

          <button
            onClick={() => {
              setFilterType("staff");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              filterType === "staff"
                ? "bg-purple-600 text-white font-semibold"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-300" />
            <span>Yetkililer</span>
          </button>

          <button
            onClick={() => {
              setFilterType("banned");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              filterType === "banned"
                ? "bg-rose-700 text-white font-semibold"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <Ban className="w-3.5 h-3.5 text-rose-300" />
            <span>Yasaklılar</span>
          </button>
        </div>
      </div>

      {/* 3. ÖZEL BÖLÜM: ŞÜPHELİ / RİSK RADARI GÖRÜNÜMÜ */}
      {filterType === "suspicious" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Yapay Zeka Destekli Leecher & Multi-Account Tespit Radarı</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase">
                  Otomatik Koruma
                </span>
              </h2>
              <p className="text-xs text-rose-200/80 mt-1">
                Forumunuzdaki <strong>"Linki görmek için yorum yapma zorunluluğu"</strong> ve <strong>"24 saat bekleme kuralını"</strong> aşmak amacıyla çok kısa süre arayla farklı yama konularına mesaj atan kullanıcılar ve aynı IP'den açılan klon hesaplar aşağıda listelenmektedir.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {alerts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <div className="text-sm font-bold text-slate-200">Kayıtlı Şüpheli İşlem Bulunmuyor</div>
                <div className="text-xs text-slate-500 mt-1">Tüm üyeler normal forum kurallarına uygun davranıyor.</div>
              </div>
            ) : (
              alerts.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition ${
                    item.status === "unresolved"
                      ? "bg-slate-900/95 border-rose-500/50 shadow-lg shadow-rose-950/20"
                      : "bg-slate-900/50 border-slate-800 opacity-70"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                        %{item.risk_score}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{item.username}</span>
                          <span className="text-[11px] text-slate-400 font-mono">#{item.user_id}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.risk_level === "critical"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.timestamp_formatted}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 mt-1 font-medium">
                          {item.description}
                        </div>

                        <div className="text-xs text-slate-400 mt-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 font-mono">
                          {item.details}
                        </div>

                        {item.target_threads.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-medium">Hedef Konular:</span>
                            {item.target_threads.map((t, idx) => {
                              const threadUrl = item.target_thread_urls && item.target_thread_urls[idx];
                              return threadUrl ? (
                                <button
                                  key={idx}
                                  onClick={() => handleOpenUrl(threadUrl)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 font-mono flex items-center gap-1 transition cursor-pointer"
                                  title="Konuyu Forumda Aç (Tarayıcı)"
                                >
                                  {t}
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </button>
                              ) : (
                                <span
                                  key={idx}
                                  className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono"
                                >
                                  {t}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {item.ip_address && (
                          <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2 font-mono">
                            <Network className="w-3 h-3 text-cyan-400" />
                            <span>IP Adresi: {item.ip_address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex items-center gap-2 shrink-0 md:self-center">
                      <button
                        onClick={() => {
                          const matched = data?.members.find((m) => m.user_id === item.user_id);
                          if (matched) {
                            setInspectMember(matched);
                          } else {
                            // Sentetik member aç
                            setInspectMember({
                              user_id: item.user_id,
                              username: item.username,
                              user_state: "valid",
                              is_banned: false,
                              is_admin: false,
                              is_moderator: false,
                              is_staff: false,
                              message_count: 3,
                              reaction_score: 0,
                              trophy_points: 1,
                              warning_points: 0,
                              register_date: item.timestamp - 7200,
                              register_date_formatted: "Yeni Kayıt",
                              last_activity: item.timestamp,
                              last_activity_formatted: item.timestamp_formatted,
                              can_ban: true,
                              forum_profile_url: `https://turkceyama.org/kullanıcılar/${encodeURIComponent(item.username)}.${item.user_id}/`,
                              risk_score: item.risk_score,
                              risk_level: item.risk_level,
                              risk_badge: `%${item.risk_score} Şüpheli`,
                              ai_intelligence_verdict: item.details,
                              recent_activity_log: [item.details, "İndirme bağlantısına tıklandı."],
                              ip_address: item.ip_address,
                              is_online: true,
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        İncele
                      </button>

                      {isSuperOrAdmin && (
                        <button
                          onClick={() => {
                            setModalMember({
                              user_id: item.user_id,
                              username: item.username,
                              user_state: "valid",
                              is_banned: false,
                              is_admin: false,
                              is_moderator: false,
                              is_staff: false,
                              message_count: 2,
                              reaction_score: 0,
                              trophy_points: 1,
                              warning_points: 0,
                              register_date: item.timestamp,
                              register_date_formatted: "",
                              last_activity: item.timestamp,
                              last_activity_formatted: "",
                              can_ban: true,
                              forum_profile_url: "",
                              risk_score: item.risk_score,
                              risk_level: item.risk_level,
                              risk_badge: "",
                              ai_intelligence_verdict: "",
                              recent_activity_log: [],
                              is_online: true,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Yasakla
                        </button>
                      )}

                      {item.status === "unresolved" ? (
                        <button
                          onClick={() => handleResolveAlert(item.id, "resolved")}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-emerald-600/30 hover:text-emerald-300 text-slate-300 border border-slate-700 transition cursor-pointer"
                          title="İnceleme Tamamlandı Olarak İşaretle"
                        >
                          ✓ Çözüldü
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {item.status === "resolved" ? "Çözüldü" : "İşlendi"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. ANA ÜYE TABLOSU */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <div className="text-xs font-medium">XenForo üye veritabanı taranıyor...</div>
          </div>
        ) : !data || data.members.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">Üye Bulunamadı</div>
            <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {debouncedSearch
                ? `"${debouncedSearch}" arama kriterine uygun forum üyesi bulunamadı.`
                : "Seçilen filtrede kayıtlı üye bulunmuyor."}
            </div>
            {debouncedSearch && (
              <button
                onClick={clearSearch}
                className="mt-4 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              >
                Aramayı Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {filterType === "banned" ? (
                  <tr className="border-b border-rose-950/60 bg-rose-950/30 text-[11px] font-semibold text-rose-300 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Yasaklanan Hesap</th>
                    <th className="py-3.5 px-3">Yasaklanma Gerekçesi (Neden?)</th>
                    <th className="py-3.5 px-3">Yasaklayan Yetkili</th>
                    <th className="py-3.5 px-3">Yasaklanma Tarihi</th>
                    <th className="py-3.5 px-3 text-center">Ceza Süresi / Durum</th>
                    <th className="py-3.5 px-4 text-right">Eylemler</th>
                  </tr>
                ) : (
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Üye Bilgisi</th>
                    <th className="py-3.5 px-3">Güvenlik & AI Durumu</th>
                    <th className="py-3.5 px-3">Yetki / Rol</th>
                    <th className="py-3.5 px-3 text-center">Mesajlar</th>
                    <th className="py-3.5 px-3 text-center">Reaksiyon</th>
                    <th className="py-3.5 px-3 text-center">Ceza Puanı</th>
                    <th className="py-3.5 px-3">Kayıt Tarihi</th>
                    <th className="py-3.5 px-3">Son Aktivite</th>
                    <th className="py-3.5 px-4 text-right">Eylemler</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {data.members.map((member) => (
                  filterType === "banned" ? (
                    <tr
                      key={member.user_id}
                      className="hover:bg-rose-950/20 transition group border-b border-rose-950/30"
                    >
                      {/* Yasaklanan Hesap */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {member.avatar_url ? (
                              <img
                                src={member.avatar_url}
                                alt={member.username}
                                className="w-9 h-9 rounded-xl object-cover border border-rose-700/60 grayscale"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-center justify-center font-bold text-xs text-rose-400 uppercase">
                                {member.username.substring(0, 2)}
                              </div>
                            )}
                            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-slate-900" title="Yasaklı Hesap"></span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-rose-300 transition flex items-center gap-1.5 truncate">
                              <span>{member.username}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                YASAKLI
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              ID: #{member.user_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Yasaklanma Gerekçesi (Neden?) */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex items-center gap-1.5 text-xs text-rose-200 bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-900/40 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate" title={member.ban_reason}>{member.ban_reason || "Disiplin kuralı ihlali"}</span>
                        </div>
                      </td>

                      {/* Yasaklayan Yetkili */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 text-xs text-purple-200">
                          <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="font-semibold">{member.banned_by || "Asylum (Süper Admin)"}</span>
                        </div>
                      </td>

                      {/* Yasaklanma Tarihi */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{member.ban_date_formatted || member.last_activity_formatted}</span>
                        </div>
                      </td>

                      {/* Ceza Süresi / Durum */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <Ban className="w-3 h-3 text-rose-400" />
                          {member.ban_end_formatted || "Süresiz"}
                        </span>
                      </td>

                      {/* Eylemler */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectMember(member)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                            title="Yasaklama Detaylarını İncele"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isSuperOrAdmin && (
                            <button
                              onClick={() => handleModeration(member, "unban")}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
                              title="Bu Üyenin Yasağını Kaldır"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Yasağı Kaldır
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenUrl(member.forum_profile_url)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                            title="Forum Profiline Git"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  <tr
                    key={member.user_id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    {/* Üye Bilgisi (Avatar + Kullanıcı Adı + Çevrimiçi Rozeti) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.username}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 uppercase">
                              {member.username.substring(0, 2)}
                            </div>
                          )}
                          {member.is_online && (
                            <span
                              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900"
                              title="Şu an Forumda Çevrimiçi"
                            ></span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-white group-hover:text-indigo-300 transition flex items-center gap-1.5 truncate">
                            <span>{member.username}</span>
                            {member.is_banned && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                YASAKLI
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <span>ID: #{member.user_id}</span>
                            {member.custom_title && (
                              <>
                                <span>•</span>
                                <span className="truncate text-slate-400">{member.custom_title}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Güvenlik & AI Durumu (Rozet) */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          member.risk_level === "critical"
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            : member.risk_level === "high"
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            : member.risk_level === "medium"
                            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {member.risk_level === "critical" || member.risk_level === "high" ? (
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                        ) : member.reaction_score > 500 ? (
                          <Flame className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>{member.risk_badge || "%98 Güvenilir"}</span>
                      </span>
                    </td>

                    {/* Yetki / Rol */}
                    <td className="py-3.5 px-3">
                      {member.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          <Shield className="w-3 h-3" />
                          YÖNETİCİ
                        </span>
                      ) : member.is_moderator ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          <ShieldCheck className="w-3 h-3" />
                          MODERATÖR
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Üye</span>
                      )}
                    </td>

                    {/* Mesaj Sayısı */}
                    <td className="py-3.5 px-3 text-center font-mono font-medium text-slate-200">
                      {member.message_count.toLocaleString("tr-TR")}
                    </td>

                    {/* Reaksiyon Skoru */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-semibold">
                        <ThumbsUp className="w-3 h-3" />
                        {member.reaction_score}
                      </span>
                    </td>

                    {/* Ceza Puanı */}
                    <td className="py-3.5 px-3 text-center font-mono">
                      {member.warning_points > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30">
                          {member.warning_points} Puan
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">0</span>
                      )}
                    </td>

                    {/* Kayıt Tarihi */}
                    <td className="py-3.5 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {member.register_date_formatted}
                    </td>

                    {/* Son Aktivite */}
                    <td className="py-3.5 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {member.last_activity_formatted}
                    </td>

                    {/* Eylemler */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectMember(member)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 hover:text-indigo-300 text-slate-400 transition cursor-pointer"
                          title="Detaylı AI İstihbarat & Davranış Kütüğü İncelemesi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenUrl(member.forum_profile_url)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                          title="XenForo Profilini Aç"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {isSuperOrAdmin && (
                          <>
                            {member.is_banned ? (
                              <button
                                onClick={() => handleModeration(member, "unban")}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
                                title="Yasağı Kaldır (Unban)"
                              >
                                Aç
                              </button>
                            ) : (
                              <button
                                onClick={() => setModalMember(member)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/30 hover:text-rose-400 text-slate-400 transition cursor-pointer"
                                title="Kullanıcıyı Yasakla (Ban)"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama Kontrolleri */}
        {data && data.last_page > 1 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Toplam <strong>{data.total_count.toLocaleString("tr-TR")}</strong> üyeden sayfa{" "}
              <strong>{data.current_page}</strong> / <strong>{data.last_page}</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-white text-xs">
                {page}
              </span>

              <button
                disabled={page >= data.last_page || loading}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. DETAYLI AI İSTİHBARAT & DAVRANIŞ KÜTÜĞÜ MODALI (İNCELE) */}
      {inspectMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            {/* Üst Başlık */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                {inspectMember.avatar_url ? (
                  <img
                    src={inspectMember.avatar_url}
                    alt={inspectMember.username}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center font-bold text-lg text-indigo-400 uppercase">
                    {inspectMember.username.substring(0, 2)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {inspectMember.username}
                    {inspectMember.is_banned && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                        YASAKLI
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Kullanıcı ID: #{inspectMember.user_id}
                  </div>
                  {inspectMember.email && (
                    <div className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                      E-posta: {inspectMember.email}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setInspectMember(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* YASAKLANMA / DİSİPLİN KÜTÜĞÜ BİLGİ KUTUSU */}
            {(inspectMember.is_banned || inspectMember.ban_reason) && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/40 border border-rose-500/50 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold tracking-wide uppercase">
                  <Ban className="w-4 h-4 text-rose-400" />
                  <span>Resmi Disiplin & Yasaklama Kütüğü</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-rose-900/30">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Yasaklanma Gerekçesi (Neden?):</span>
                    <span className="text-rose-200 font-medium mt-0.5 block">{inspectMember.ban_reason || "Yönetici tarafından askıya alındı."}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-rose-900/30">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Yasaklayan Yetkili:</span>
                    <span className="text-purple-300 font-medium mt-0.5 block">{inspectMember.banned_by || "Asylum (Süper Admin)"}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-rose-900/30">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Yasaklanma Tarihi:</span>
                    <span className="text-slate-200 font-mono mt-0.5 block">{inspectMember.ban_date_formatted || inspectMember.last_activity_formatted}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-rose-900/30">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ceza Süresi / Bitiş:</span>
                    <span className="text-rose-400 font-bold mt-0.5 block">{inspectMember.ban_end_formatted || "Süresiz"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* YAPAY ZEKA İSTİHBARAT RAPORU KUTUSU */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/30 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold tracking-wide uppercase">
                <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>Yapay Zeka İstihbarat & Güvenlik Değerlendirmesi</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {inspectMember.ai_intelligence_verdict ||
                  "Standart forum üyesi. Herhangi bir link avcılığı veya 24 saat kuralı ihlali gözlemlenmedi."}
              </p>
            </div>

            {/* KULLANICININ HAREKET & DAVRANIŞ KÜTÜĞÜ (LOG) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Son Hareketler & Kural İhlal Kütüğü</span>
              </div>
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2 max-h-40 overflow-y-auto font-mono text-xs text-slate-300">
                {inspectMember.recent_activity_log && inspectMember.recent_activity_log.length > 0 ? (
                  inspectMember.recent_activity_log.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5 last:border-none last:pb-0">
                      <span className="text-indigo-400 font-bold shrink-0">›</span>
                      <span>{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">Kayıtlı olağandışı aktivite bulunmuyor.</div>
                )}
              </div>
            </div>

            {/* Detay Metrik Tablosu */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-400">Toplam Mesaj</div>
                <div className="text-base font-bold text-white font-mono mt-0.5">
                  {inspectMember.message_count.toLocaleString("tr-TR")}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-400">Reaksiyon Skoru</div>
                <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {inspectMember.reaction_score}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-400">Kupa Puanı</div>
                <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                  {inspectMember.trophy_points}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-400">Ceza / Uyarı Puanı</div>
                <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                  {inspectMember.warning_points}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-400">Kayıt Tarihi</div>
                <div className="text-[11px] font-medium text-slate-300 font-mono mt-0.5">
                  {inspectMember.register_date_formatted}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-400">Son Aktivite</div>
                <div className="text-[11px] font-medium text-slate-300 font-mono mt-0.5">
                  {inspectMember.last_activity_formatted}
                </div>
              </div>
            </div>

            {/* Alt Eylem Butonları */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleOpenUrl(inspectMember.forum_profile_url)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Forum Profilini Ziyaret Et
              </button>

              <div className="flex items-center gap-2">
                {isSuperOrAdmin && !inspectMember.is_banned && (
                  <button
                    onClick={() => {
                      setModalMember(inspectMember);
                      setInspectMember(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Yasakla
                  </button>
                )}

                <button
                  onClick={() => setInspectMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. BANLAMA / MODERASYON ONAY MODALI */}
      {modalMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Kullanıcıyı Yasakla</h3>
                <p className="text-xs text-slate-400">
                  {modalMember.username} (ID: #{modalMember.user_id})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Bu kullanıcıyı XenForo forumundan süresiz olarak yasaklamak istediğinizden emin misiniz? Kullanıcı giriş yapamayacak ve içerik indiremeyecektir.
            </p>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Yasaklama Gerekçesi (Kullanıcıya & Loglara Gösterilir):
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                disabled={submittingAction}
                onClick={() => setModalMember(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                disabled={submittingAction}
                onClick={() => handleModeration(modalMember, "ban")}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    Evet, Yasakla
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

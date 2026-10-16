import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Cloud,
  ArrowDownUp,
  Settings,
  Sparkles,
  ExternalLink,
  LogIn,
  LogOut,
  ShieldAlert,
  RefreshCw,
  Rocket,
  Lock,
  Palette,
  Compass,
  Search,
} from "lucide-react";
import { CommandPaletteModal } from "./components/CommandPaletteModal";
import { ChecksumModal } from "./components/ChecksumModal";
import { SettingsPage } from "./features/settings/SettingsPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ReleaseHubPage } from "./features/release/ReleaseHubPage";
import { TopicsPage } from "./features/topics/TopicsPage";
import { UsersPage } from "./features/users/UsersPage";
import { R2FilesPage } from "./features/files/R2FilesPage";
import { TransfersPage } from "./features/transfers/TransfersPage";
import { UpdateModal } from "./features/updater/UpdateModal";
import { AuthModal } from "./features/auth/AuthModal";
import { LoginPage } from "./features/auth/LoginPage";
import { invoke } from "@tauri-apps/api/core";
import { SplashScreen } from "./features/splash/SplashScreen";
import { ForumUser } from "./features/auth/types";
import { OnboardingModal } from "./components/OnboardingModal";
import { PrivacySecurityModal } from "./components/PrivacySecurityModal";
import { InteractiveTourGuide } from "./components/InteractiveTourGuide";
import { ProfileThemeModal } from "./components/ProfileThemeModal";
import { CorporateAvatar } from "./components/CorporateAvatar";
import { FloatingTransferBar } from "./components/FloatingTransferBar";
import { ToastProvider } from "./components/Toast";
import packageJson from "../package.json";
import { AdminTrackerModal } from "./features/admins/AdminTrackerModal";
import { AuditLogModal } from "./features/audit/AuditLogModal";
import { AIDailyReportModal } from "./features/reports/AIDailyReportModal";
import "./App.css";

const MainApp: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [user, setUser] = useState<ForumUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [tourGuideOpen, setTourGuideOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminTrackerOpen, setAdminTrackerOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [aiReportOpen, setAiReportOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [checksumModalOpen, setChecksumModalOpen] = useState(false);

  // Kurumsal Avatar Tercihleri (Kalıcı Kayıt)
  const [avatarColor, setAvatarColor] = useState<string>(() => {
    return localStorage.getItem("gunnerius_avatar_color") || "#d4af37";
  });
  const [avatarEmblem, setAvatarEmblem] = useState<string>(() => {
    return localStorage.getItem("gunnerius_avatar_emblem") || "shield";
  });

  // İlk Kullanıcı için Otomatik Öğretici Rehber Tetikleme (İsteyen Hemen Atlayabilir)
  useEffect(() => {
    const isCompleted = localStorage.getItem("gunnerius_tour_completed");
    if (!isCompleted) {
      const timer = setTimeout(() => {
        setTourGuideOpen(true);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleColorChange = (newColor: string) => {
    setAvatarColor(newColor);
    localStorage.setItem("gunnerius_avatar_color", newColor);
  };

  const handleEmblemChange = (newEmblem: string) => {
    setAvatarEmblem(newEmblem);
    localStorage.setItem("gunnerius_avatar_emblem", newEmblem);
  };

  useEffect(() => {
    // 1. Production Güvenlik Kilidi: Sağ tık (Öğeyi Denetle) ve F12 kısayollarını engelle
    const handleContextMenu = (e: MouseEvent) => {
      if (!import.meta.env.DEV) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && e.key === "u")
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    // 2. Telemetri & Crash / Hata Yakalayıcı (gunnerius_errors.log kütüğüne otomatik yazar)
    const handleError = (event: ErrorEvent) => {
      invoke("log_client_error", {
        errorMessage: event.message || "Bilinmeyen frontend hatası",
        stackTrace: event.error?.stack || null,
        context: "WindowErrorEvent",
      }).catch(() => {});
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      invoke("log_client_error", {
        errorMessage: String(event.reason || "Unhandled Promise Rejection"),
        stackTrace: null,
        context: "UnhandledPromiseRejection",
      }).catch(() => {});
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // 3. GÜVENLİ OTURUM YÖNETİMİ (Windows Credential Vault / Keyring)
    // Asla düz metin localStorage kullanılmaz! Tokenlar in-memory ve kısa ömürlüdür.
    invoke<any>("restore_saved_session")
      .then((res) => {
        if (res && res.success && res.user && res.role && res.session_token) {
          const isSuper = res.role === "super_admin";
          const isAdmin = isSuper || res.role === "admin";
          const u: ForumUser = {
            user_id: res.user.user_id,
            username: res.user.username,
            avatar_url: res.user.avatar_url,
            is_super_admin: isSuper,
            is_admin: isAdmin,
            is_moderator: true,
            is_staff: true,
          };
          setUser(u);
          setRole(res.role);
          setSessionToken(res.session_token);
        }
      })
      .catch((e) => {
        console.warn("Oturum geri yükleme kontrolü:", e);
      });

    // 4. OTOMATİK ACCESS TOKEN YENİLEME (HER 10 DAKİKADA BİR)
    // 15 dakikalık kısa ömürlü token dolmadan önce arka planda yenilenir
    const refreshTimer = setInterval(() => {
      invoke<any>("refresh_session_token")
        .then((res) => {
          if (res && res.success && res.session_token) {
            setSessionToken(res.session_token);
          }
        })
        .catch(() => {});
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      clearInterval(refreshTimer);
    };
  }, []);

  // 5. CANLI YÖNETİCİ & SÜREÇ HEARTBEAT SENKRONİZASYONU (Her 15 saniyede bir R2'ye oturum bildirimi)
  useEffect(() => {
    if (!user || !sessionToken) return;

    const actionMap: Record<string, string> = {
      dashboard: "Genel Durum & Telemetri İncelemesi",
      files: "Cloudflare R2 Dosya Yönetimi",
      transfers: "Aktarım Kuyruğu & Stream Senkronizasyonu",
      topics: "XenForo Konular & Yapay Zeka Analizi",
      users: "Üye Yönetimi & Güvenlik Denetimi",
      release: "Sürüm & Dağıtım Merkezi (R2)",
      settings: "Sunucu & Bağlantı Ayarları",
    };

    const sendHeartbeat = () => {
      invoke("update_admin_heartbeat", {
        sessionToken,
        currentPage: activeTab,
        currentAction: actionMap[activeTab] || "Stüdyo Gezintisi",
        avatarColor,
        avatarEmblem,
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [user, sessionToken, activeTab, avatarColor, avatarEmblem]);

  const handleLoginSuccess = (loggedInUser: ForumUser, userRole: string, token?: string) => {
    setUser(loggedInUser);
    setRole(userRole);
    if (token) {
      setSessionToken(token);
    }
  };

  const handleLogout = () => {
    if (sessionToken) {
      invoke("logout_user", { sessionToken }).catch(() => {});
    } else {
      invoke("logout_user", {}).catch(() => {});
    }
    setUser(null);
    setRole(null);
    setSessionToken(null);
  };

  // 1. BAŞLANGIÇ ANİMASYONU (SPLASH SCREEN)
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // 2. GİRİŞ ZORUNLULUĞU (STRICT AUTH BARRIER)
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-[#0f1115] text-[#f3f4f6] select-none overflow-hidden font-sans">
      {/* SOL MENÜ (SIDEBAR) */}
      <aside className="w-72 bg-[#14171e] border-r border-[#2b303c] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Başlık */}
          <div className="h-18 px-6 flex items-center gap-3 border-b border-[#2b303c]">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#d4af37]/50 shadow-md shadow-[#d4af37]/25 p-0.5 bg-[#12151c] shrink-0">
              <img src="/logo.jpg" alt="GUNNERIUS Logo" className="w-full h-full object-cover rounded-lg" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm tracking-wider text-white flex items-center gap-1.5 font-mono">
                GUNNERIUS <span className="text-[#d4af37] text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/35 tracking-normal">Portal</span>
              </div>
              <div className="text-[11px] text-gray-400">Forum Yönetim Portalı</div>
            </div>
          </div>

          {/* Menü Öğeleri */}
          <nav className="p-4 space-y-1.5">
            <button
              data-tour="sidebar-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                  : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Genel Durum
              <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">CANLI</span>
            </button>

            <button
              onClick={() => setActiveTab("topics")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "topics"
                  ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                  : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Konular & Mesajlar
              <span className="ml-auto text-[10px] text-purple-400 bg-purple-950/40 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono font-bold">AI ANALİZ</span>
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "users"
                  ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                  : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
              }`}
            >
              <Users className="w-4 h-4" />
              Üye Yönetimi
              <span className="ml-auto text-[10px] text-indigo-400 bg-indigo-950/40 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono font-bold">CANLI DB</span>
            </button>

            <button
              data-tour="sidebar-files"
              onClick={() => setActiveTab("files")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "files"
                  ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                  : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
              }`}
            >
              <Cloud className="w-4 h-4" />
              R2 Bulut Dosyaları
              <span className="ml-auto text-[10px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold">CANLI R2</span>
            </button>

            <button
              data-tour="sidebar-transfers"
              onClick={() => setActiveTab("transfers")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "transfers"
                  ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                  : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
              }`}
            >
              <ArrowDownUp className="w-4 h-4 text-[#d4af37]" />
              Aktarım Kuyruğu
              <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono font-bold">STREAM</span>
            </button>

            {/* YALNIZCA SÜPER ADMİN / ADMİN GÖREBİLİR */}
            {(role === "super_admin" || role === "admin") && (
              <>
                <div className="pt-3 pb-1 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Sistem (Yönetici)
                </div>

                {role === "super_admin" && (
                  <button
                    onClick={() => setActiveTab("release")}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      activeTab === "release"
                        ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                        : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
                    }`}
                  >
                    <Rocket className="w-4 h-4 text-[#d4af37]" />
                    Sürüm & Dağıtım
                    <span className="ml-auto text-[10px] text-[#d4af37] bg-[#d4af37]/15 border border-[#d4af37]/30 px-1.5 py-0.5 rounded font-mono font-bold">R2</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === "settings"
                      ? "bg-[#d4af37]/15 text-[#d4af37] font-semibold border border-[#d4af37]/30"
                      : "text-gray-400 hover:text-white hover:bg-[#1e232e]"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Ayarlar & Bağlantılar
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Alt Bilgi & Oturum Kartı */}
        <div className="p-4 border-t border-[#2b303c] bg-[#111319]">
          {user ? (
            <div className="flex items-center justify-between">
              <div
                data-tour="theme-profile"
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-3 min-w-0 cursor-pointer p-1 -m-1 rounded-xl hover:bg-[#181d28] transition group"
                title="Profil ve Görünüm Ayarları"
              >
                <CorporateAvatar
                  size="md"
                  color={avatarColor}
                  emblem={avatarEmblem}
                  username={user.username}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-amber-400 transition truncate">
                    {user.username}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {role === "super_admin" ? "Süper Yönetici" : role === "admin" ? "Yönetici" : "Moderatör"}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-[#1e232e] rounded-lg transition cursor-pointer"
                title="Oturumu Güvenle Kapat"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-2 px-3 bg-[#1c2230] hover:bg-[#252c3d] border border-[#d4af37]/30 hover:border-[#d4af37] text-xs font-semibold text-[#d4af37] rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Yetkili Girişi Yap
            </button>
          )}

          <div className="mt-3 pt-2.5 border-t border-[#1e232e] flex items-center justify-between text-[11px] text-gray-500">
            <span className="font-mono font-semibold text-gray-400">GUNNERIUS Studio v{packageJson.version}</span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Aktif
            </span>
          </div>
        </div>
      </aside>

      {/* SAĞ ANA İÇERİK */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0f1115]">
        {/* ÜST BİLGİ ÇUBUĞU */}
        <header className="h-18 px-6 border-b border-[#2b303c] flex items-center justify-between bg-[#14171e]/70 backdrop-blur-md shrink-0 gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-gray-400">Aktif Sayfa:</span>
            <span className="text-sm font-semibold text-white">
              {activeTab === "release" && "Sürüm & Dağıtım"}
              {activeTab === "settings" && "Ayarlar & Bağlantılar"}
              {activeTab === "dashboard" && "Genel Durum"}
              {activeTab === "topics" && "Konular & Mesajlar"}
              {activeTab === "users" && "Üye Yönetimi"}
              {activeTab === "files" && "R2 Bulut Dosyaları"}
              {activeTab === "transfers" && "Aktarım Kuyruğu"}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {/* Hızlı Komut Paleti (Ctrl + K) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-[#2e3648] hover:border-amber-500/40 rounded-xl text-xs text-gray-300 hover:text-white transition cursor-pointer shadow-sm group shrink-0"
              title="Hızlı Komut Paleti ve Arama (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
              <span className="hidden xl:inline font-medium">Komutlar</span>
              <kbd className="text-[9px] font-mono bg-[#11141c] border border-[#2b3345] px-1.5 py-0.5 rounded text-gray-400">
                ⌘K
              </kbd>
            </button>

            {/* Canlı Yönetici Takibi & Süreç İzleme Butonu */}
            <button
              data-tour="topbar-admins"
              onClick={() => setAdminTrackerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-cyan-500/30 rounded-xl text-xs text-cyan-300 hover:text-white transition cursor-pointer shadow-sm"
              title="Çevrimiçi yöneticilerin anlık işlemlerini ve çalışan süreçlerini izle"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Yöneticiler</span>
            </button>

            {/* Denetim Kütüğü (Audit Log) Butonu */}
            <button
              data-tour="topbar-audit"
              onClick={() => setAuditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-indigo-500/30 rounded-xl text-xs text-indigo-300 hover:text-white transition cursor-pointer shadow-sm"
              title="R2 Bulut Entegre Detaylı Sistem Denetim Kütüğü (Audit Log)"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Denetim Kütüğü</span>
            </button>

            {/* AI Günlük Yönetici Raporu Butonu */}
            <button
              data-tour="topbar-ai-report"
              onClick={() => setAiReportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-purple-500/30 rounded-xl text-xs text-purple-300 hover:text-white transition cursor-pointer shadow-sm"
              title="Yapay Zeka Günlük Yönetici İstihbarat & İstatistik Raporu"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Günlük Rapor</span>
            </button>

            {/* İnteraktif Öğretici İlerleme Rehberi Butonu */}
            <button
              onClick={() => setTourGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-amber-500/40 rounded-xl text-xs text-amber-300 hover:text-white transition cursor-pointer shadow-sm"
              title="İnteraktif Öğretici İlerleme Rehberini Başlat"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Öğretici Rehber</span>
            </button>

            {/* Güvenlik & İzinler Butonu */}
            <button
              onClick={() => setPrivacyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-emerald-500/30 rounded-xl text-xs text-emerald-300 hover:text-white transition cursor-pointer shadow-sm"
              title="Veri Güvenliği, Yetki Matrisi ve Hata Kütüğü"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Güvenlik</span>
            </button>

            {/* Profil & Tema Ayarları Rozeti */}
            {user ? (
              <button
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-[#2b364a] rounded-xl text-xs transition cursor-pointer"
                title="Kurumsal Profil ve Görünüm Ayarlarını Aç"
              >
                <CorporateAvatar
                  size="sm"
                  color={avatarColor}
                  emblem={avatarEmblem}
                  username={user.username}
                />
                <span className="text-gray-300">
                  <strong className="text-white">{user.username}</strong>
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold border"
                  style={{
                    backgroundColor: `${avatarColor}15`,
                    color: avatarColor,
                    borderColor: `${avatarColor}35`,
                  }}
                >
                  {role === "super_admin" ? "Süper Admin" : role === "admin" ? "Yönetici" : "Moderatör"}
                </span>
                <Palette className="w-3 h-3 text-gray-400 ml-0.5" />
              </button>
            ) : null}

            <button
              onClick={() => setUpdateTrigger((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a3b] border border-[#2b364a] rounded-xl text-xs text-gray-300 hover:text-white transition cursor-pointer"
              title="Cloudflare R2 üzerinden güncellemeleri kontrol et"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Güncellemeleri Denetle</span>
            </button>

            <a
              href="https://turkceyama.org"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#d4af37] transition"
            >
              <span>turkceyama.org</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </header>

        {/* İÇERİK ALANI */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {/* 1. GENEL DURUM (DASHBOARD) */}
          <div className={activeTab === "dashboard" ? "block" : "hidden"}>
            <DashboardPage onNavigateTab={(tab) => setActiveTab(tab)} />
          </div>

          {/* 2. KONULAR & MESAJLAR (YAPAY ZEKA ANALİTİĞİ) */}
          <div className={activeTab === "topics" ? "block" : "hidden"}>
            <TopicsPage />
          </div>

          {/* 3. ÜYE YÖNETİMİ & İSTİHBARAT KONSOLU */}
          <div className={activeTab === "users" ? "block" : "hidden"}>
            <UsersPage sessionToken={sessionToken} role={role} />
          </div>

          {/* 4. R2 BULUT DOSYALARI & YAMA DEPOLAMA (FAZ 1) */}
          <div className={activeTab === "files" ? "block" : "hidden"}>
            <R2FilesPage sessionToken={sessionToken} role={role} />
          </div>

          {/* 5. AKTARIM KUYRUĞU & SENKRONİZASYON (FAZ 2) */}
          <div className={activeTab === "transfers" ? "block" : "hidden"}>
            <TransfersPage
              sessionToken={sessionToken}
              role={role}
              onNavigateToR2={(_folder) => {
                setActiveTab("files");
              }}
            />
          </div>

          {/* 6. SÜRÜM & DAĞITIM MERKEZİ (CLOUDFLARE R2 & YEDEK ARŞİVİ) */}
          <div className={activeTab === "release" ? "block" : "hidden"}>
            <ReleaseHubPage
              sessionToken={sessionToken}
              role={role}
              onOpenAuthModal={() => setAuthModalOpen(true)}
            />
          </div>

          {/* 7. AYARLAR & BAĞLANTILAR */}
          <div className={activeTab === "settings" ? "block" : "hidden"}>
            {role === "super_admin" || role === "admin" ? (
              <SettingsPage sessionToken={sessionToken} />
            ) : (
              <div className="p-16 text-center text-gray-500">
                <ShieldAlert className="w-12 h-12 mx-auto text-rose-500 mb-3" />
                <h3 className="text-lg font-bold text-gray-300">Yetkisiz Erişim</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  Bu sayfaya ve sunucu kimlik ayarlarına yalnızca Forum Süper Yöneticisi erişebilir. Personel ve moderatörler için bu alan kilitlidir.
                </p>
              </div>
            )}
          </div>

          {/* 8. DİĞER MODÜLLER (GEÇİCİ) */}
          {activeTab !== "settings" &&
            activeTab !== "dashboard" &&
            activeTab !== "release" &&
            activeTab !== "topics" &&
            activeTab !== "users" &&
            activeTab !== "files" &&
            activeTab !== "transfers" && (
              <div className="p-12 text-center text-gray-500">
                <Sparkles className="w-10 h-10 mx-auto text-[#d4af37] mb-3 opacity-60" />
                <h3 className="text-lg font-bold text-gray-300">Bu modül sıradaki fazlarda aktifleşecektir</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Lütfen soldaki <strong>Genel Durum</strong>, <strong>Konular & Mesajlar</strong> veya <strong>Üye Yönetimi</strong> sekmesini kullanın.
                </p>
              </div>
            )}
        </div>
      </main>

      {/* Yetkili Giriş Modalı */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Onboarding İlk Giriş Rehberi Modalı */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />

      {/* Veri Güvenliği, Yetki Matrisi & Crash Logger Modalı */}
      <PrivacySecurityModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        currentUserRole={role}
      />

      {/* İnteraktif Spotlight Öğretici Rehberi */}
      <InteractiveTourGuide
        isOpen={tourGuideOpen}
        onClose={() => setTourGuideOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Kurumsal Profil & Tema Ayarları Modalı */}
      <ProfileThemeModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        role={role}
        avatarColor={avatarColor}
        onColorChange={handleColorChange}
        avatarEmblem={avatarEmblem}
        onEmblemChange={handleEmblemChange}
      />

      {/* Global Kayan Aktarım Çubuğu (Tüm Sekmelerde Aktif) */}
      <FloatingTransferBar
        currentTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Otomatik & Manuel Güncelleme Modalı */}
      <UpdateModal manualCheckTrigger={updateTrigger} />

      {/* Canlı Yönetici Takibi & Süreç İzleme Modalı */}
      <AdminTrackerModal
        isOpen={adminTrackerOpen}
        onClose={() => setAdminTrackerOpen(false)}
        sessionToken={sessionToken}
        currentUsername={user?.username}
      />

      {/* Sistem & Yönetici Denetim Kütüğü (Audit Log) Modalı */}
      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        sessionToken={sessionToken}
      />

      {/* Yapay Zeka Günlük Yönetici İstihbarat Raporu Modalı */}
      <AIDailyReportModal
        isOpen={aiReportOpen}
        onClose={() => setAiReportOpen(false)}
        sessionToken={sessionToken}
      />

      {/* Hızlı Komut Paleti (Ctrl + K) Modalı */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenAdminTracker={() => setAdminTrackerOpen(true)}
        onOpenAuditLogs={() => setAuditModalOpen(true)}
        onOpenAiReport={() => setAiReportOpen(true)}
        onOpenTourGuide={() => setTourGuideOpen(true)}
        onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onOpenChecksumModal={() => setChecksumModalOpen(true)}
        role={role}
      />

      {/* Dosya Doğrulama & SHA-256 Checksum Modalı */}
      <ChecksumModal
        isOpen={checksumModalOpen}
        onClose={() => setChecksumModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
};

export default App;

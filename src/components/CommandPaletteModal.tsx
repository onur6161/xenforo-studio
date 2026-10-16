import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Users,
  Cloud,
  ArrowDownUp,
  Settings,
  Rocket,
  Lock,
  Sparkles,
  Compass,
  Palette,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";

export interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: "Gezinti" | "Hızlı Eylem" | "Sistem & Araçlar";
  icon: React.ReactNode;
  badge?: string;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onOpenAdminTracker: () => void;
  onOpenAuditLogs: () => void;
  onOpenAiReport: () => void;
  onOpenTourGuide: () => void;
  onOpenPrivacyModal: () => void;
  onOpenProfileModal: () => void;
  onOpenChecksumModal?: () => void;
  role?: string | null;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenAdminTracker,
  onOpenAuditLogs,
  onOpenAiReport,
  onOpenTourGuide,
  onOpenPrivacyModal,
  onOpenProfileModal,
  onOpenChecksumModal,
  role,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin";

  const commands: CommandItem[] = [
    // GEZİNTİ
    {
      id: "nav-dashboard",
      title: "Genel Durum (Dashboard)",
      description: "Forum ve bulut sistemi anlık istatistikleri ve telemetri",
      category: "Gezinti",
      icon: <LayoutDashboard className="w-4 h-4 text-emerald-400" />,
      badge: "CANLI",
      action: () => {
        onNavigate("dashboard");
        onClose();
      },
    },
    {
      id: "nav-topics",
      title: "Konular & Mesajlar",
      description: "Forum konularını incele, yapay zeka içerik analizi yap",
      category: "Gezinti",
      icon: <MessageSquare className="w-4 h-4 text-purple-400" />,
      badge: "AI ANALİZ",
      action: () => {
        onNavigate("topics");
        onClose();
      },
    },
    {
      id: "nav-users",
      title: "Üye Yönetimi",
      description: "Kullanıcı listesi, yetkilendirme, yasaklama ve güvenlik",
      category: "Gezinti",
      icon: <Users className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onNavigate("users");
        onClose();
      },
    },
    {
      id: "nav-files",
      title: "R2 Bulut Dosyaları",
      description: "Cloudflare R2 nesne yöneticisi, yama yükleme ve dosya keşfi",
      category: "Gezinti",
      icon: <Cloud className="w-4 h-4 text-amber-400" />,
      badge: "R2",
      action: () => {
        onNavigate("files");
        onClose();
      },
    },
    {
      id: "nav-transfers",
      title: "Aktarım Kuyruğu",
      description: "Devam eden indirme ve Cloudflare R2 aktarım süreçleri",
      category: "Gezinti",
      icon: <ArrowDownUp className="w-4 h-4 text-cyan-400" />,
      badge: "STREAM",
      action: () => {
        onNavigate("transfers");
        onClose();
      },
    },
    ...(isSuperAdmin
      ? [
          {
            id: "nav-release",
            title: "Sürüm & Dağıtım Merkezi",
            description: "Yeni stüdyo sürümlerini derle, imzala ve R2'ye dağıt",
            category: "Gezinti" as const,
            icon: <Rocket className="w-4 h-4 text-[#d4af37]" />,
            badge: "SÜPER ADMİN",
            action: () => {
              onNavigate("release");
              onClose();
            },
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: "nav-settings",
            title: "Ayarlar & Bağlantılar",
            description: "XenForo API, Cloudflare R2, hız limiti ve sistem ayarları",
            category: "Gezinti" as const,
            icon: <Settings className="w-4 h-4 text-gray-300" />,
            action: () => {
              onNavigate("settings");
              onClose();
            },
          },
        ]
      : []),

    // HIZLI EYLEMLER
    {
      id: "act-admin-tracker",
      title: "Canlı Yönetici Takibi & Operasyonlar",
      description: "Stüdyodaki diğer yöneticilerin anlık sayfa ve işlemlerini gör",
      category: "Hızlı Eylem",
      icon: <Users className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onOpenAdminTracker();
        onClose();
      },
    },
    {
      id: "act-audit-logs",
      title: "Denetim Kütüğü (Audit Log)",
      description: "R2 bulut entegre detaylı sistem ve güvenlik işlem geçmişi",
      category: "Hızlı Eylem",
      icon: <Lock className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onOpenAuditLogs();
        onClose();
      },
    },
    {
      id: "act-ai-report",
      title: "AI Günlük Yönetici Raporu",
      description: "Yapay zeka ile günlük forum istatistikleri ve aktivite özeti",
      category: "Hızlı Eylem",
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      badge: "YAPAY ZEKA",
      action: () => {
        onOpenAiReport();
        onClose();
      },
    },
    {
      id: "act-tour-guide",
      title: "İnteraktif Öğretici Rehber",
      description: "GUNNERIUS Studio kullanım özelliklerini adım adım öğren",
      category: "Hızlı Eylem",
      icon: <Compass className="w-4 h-4 text-amber-400" />,
      action: () => {
        onOpenTourGuide();
        onClose();
      },
    },
    {
      id: "act-privacy",
      title: "Güvenlik, İzinler & Hata Kütüğü",
      description: "Veri güvenliği protokolleri, oturum vaultu ve hata logları",
      category: "Sistem & Araçlar",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onOpenPrivacyModal();
        onClose();
      },
    },
    {
      id: "act-profile",
      title: "Profil & Tema Görünümü",
      description: "Kurumsal avatar rengi ve rozet amblemini özelleştir",
      category: "Sistem & Araçlar",
      icon: <Palette className="w-4 h-4 text-pink-400" />,
      action: () => {
        onOpenProfileModal();
        onClose();
      },
    },
    {
      id: "act-checksum",
      title: "Dosya Doğrulama & SHA-256 Checksum",
      description: "Yama dosyalarının SHA-256 kodunu hesapla ve forum için BBCode üret",
      category: "Sistem & Araçlar",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      badge: "GÜVENLİK",
      action: () => {
        onOpenChecksumModal?.();
        onClose();
      },
    },
    {
      id: "act-transfer-tuning",
      title: "Ağ & Aktarım Hızlandırma Ayarları",
      description: "Bant genişliği limiti, paralel parçacık ve chunk ayarları",
      category: "Sistem & Araçlar",
      icon: <Zap className="w-4 h-4 text-yellow-400" />,
      action: () => {
        onNavigate("settings");
        onClose();
      },
    },
  ];

  const filtered = commands.filter((c) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="bg-[#12151c] border border-[#2e3648] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ARAMA GİRDİ ALANI */}
        <div className="relative flex items-center px-5 py-4 border-b border-[#222938] bg-[#161a24]">
          <Search className="w-5 h-5 text-gray-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bir sayfa veya işlem arayın... (Örn: R2, Ayarlar, Rapor, Önbellek)"
            className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-white p-1 text-xs"
            >
              Temizle
            </button>
          ) : (
            <span className="text-[10px] font-mono text-gray-400 px-2 py-0.5 rounded bg-[#1c2230] border border-[#2b3547]">
              ESC
            </span>
          )}
        </div>

        {/* SONUÇ LİSTESİ */}
        <div className="p-2 overflow-y-auto divide-y divide-transparent">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              "{query}" ile eşleşen bir sayfa veya komut bulunamadı.
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition text-xs my-0.5 ${
                    isSelected
                      ? "bg-[#d4af37]/15 border border-[#d4af37]/40 text-white"
                      : "hover:bg-[#1a202c] text-gray-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 transition ${
                        isSelected
                          ? "bg-[#d4af37]/25 text-[#d4af37]"
                          : "bg-[#181d28] text-gray-400"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{item.title}</span>
                        {item.badge && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#242b3b] border border-[#343e54] text-gray-300">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] text-gray-500 hidden sm:inline">
                      {item.category}
                    </span>
                    {isSelected && (
                      <ArrowRight className="w-4 h-4 text-[#d4af37] animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ALT KISAYOL İPUÇLARI */}
        <div className="px-5 py-2.5 border-t border-[#1e2534] bg-[#12151c] flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-[#1b212f] rounded border border-[#2b3547] text-gray-400 text-[10px]">
                ↑↓
              </kbd>{" "}
              Gezin
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[#1b212f] rounded border border-[#2b3547] text-gray-400 text-[10px]">
                ENTER
              </kbd>{" "}
              Aç
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[#1b212f] rounded border border-[#2b3547] text-gray-400 text-[10px]">
                ESC
              </kbd>{" "}
              Kapat
            </span>
          </div>
          <span className="font-mono text-gray-400">GUNNERIUS Hızlı Erişim</span>
        </div>
      </div>
    </div>
  );
};

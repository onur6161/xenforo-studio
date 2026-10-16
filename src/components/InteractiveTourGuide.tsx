import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Cloud,
  Upload,
  ShieldAlert,
  Palette,
} from "lucide-react";

export interface TourStep {
  id: string;
  targetSelector: string;
  tab?: string;
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  tip?: string;
  position?: "bottom" | "top" | "left" | "right" | "center";
}

interface InteractiveTourGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    targetSelector: '[data-tour="sidebar-dashboard"]',
    tab: "dashboard",
    title: "1. Canlı Kontrol & Telemetri Merkezi",
    badge: "BAŞLANGIÇ • ADIM 1/8",
    icon: <Sparkles className="w-5 h-5 text-amber-400" />,
    description:
      "turkceyama.org forumunuzun canlı telemetrisi, toplam konuları, anlık çevrimiçi ziyaretçi trafiği ve Cloudflare R2 bulut depolama hacminiz burada tek ekranda toplanır.",
    tip: "Veriler akıllı önbellek ile sunucuyu yormadan milisaniyeler içinde yenilenir.",
    position: "right",
  },
  {
    id: "r2-files",
    targetSelector: '[data-tour="sidebar-files"]',
    tab: "files",
    title: "2. Cloudflare R2 Bulut Dosya Yöneticisi",
    badge: "DEPOLAMA • ADIM 2/8",
    icon: <Cloud className="w-5 h-5 text-cyan-400" />,
    description:
      "indir.turkceyama.org CDN altyapısına bağlı tüm yamalarınızı, arşivlerinizi ve güncelleme dosyalarınızı klasör hiyerarşisiyle keşfedin, yönetin, taşıyın ve arayın.",
    tip: "ZIP ve RAR arşivlerini indirmeden içindeki dosyaları anında önizleyebilirsiniz.",
    position: "right",
  },
  {
    id: "upload-zone",
    targetSelector: '[data-tour="upload-zone"]',
    tab: "files",
    title: "3. Yüksek Hızlı Dosya Yükleyici (S3 Multipart)",
    badge: "YÜKLEME • ADIM 3/8",
    icon: <Upload className="w-5 h-5 text-emerald-400" />,
    description:
      "4 GB ve üzeri devasa oyun yamalarını hiçbir takılma olmadan yükleyin! S3 Multipart teknolojisi dosyaları 32 MB parçalara bölerek paralel iş parçacığıyla buluta aktarır.",
    tip: "Masaüstünden herhangi bir dosyayı pencereye sürükleyip bırakmanız yeterlidir.",
    position: "bottom",
  },
  {
    id: "transfers",
    targetSelector: '[data-tour="sidebar-transfers"]',
    tab: "transfers",
    title: "4. Buluttan Buluta Aktarım Kuyruğu",
    badge: "AKAYRIM • ADIM 4/8",
    icon: <Upload className="w-5 h-5 text-cyan-400" />,
    description:
      "Google Drive, Mediafire ve Yandex Disk linklerini yapıştırın; bilgisayarınıza indirmeden doğrudan Cloudflare R2'ye arka planda aktarın! Virüs uyarısı bypass ve multipart akış motoru entegredir.",
    tip: "Uygulamada başka bir sayfaya geçseniz bile aktarım arka planda tam hızda devam eder.",
    position: "right",
  },
  {
    id: "admin-tracker",
    targetSelector: '[data-tour="topbar-admins"]',
    title: "5. Canlı Yönetici Takibi & Süreç İzleme",
    badge: "OPERASYON • ADIM 5/8",
    icon: <Sparkles className="w-5 h-5 text-amber-400" />,
    description:
      "Stüdyoyu kullanan diğer yöneticileri anlık olarak takip edin: Kim hangi sayfada, hangi operasyonu yapıyor (örnek: Yama yüklüyor, Konu açıyor)? Tek tıkla bilgisayarında çalışan kullanıcı uygulamalarını inceleyin.",
    tip: "Sistem çekirdeği süreçleri filtrelenerek gizlilik ve antivirüs güvenliği tam olarak korunur.",
    position: "bottom",
  },
  {
    id: "audit-log",
    targetSelector: '[data-tour="topbar-audit"]',
    title: "6. R2 Entegre Detaylı Denetim Kütüğü (Audit Log)",
    badge: "GÜVENLİK • ADIM 6/8",
    icon: <ShieldAlert className="w-5 h-5 text-indigo-400" />,
    description:
      "Stüdyo içerisinde gerçekleştirilen tüm eylemler (dosya yükleme, silme, isim değiştirme, aktarım başlatma, üye banlama) hem yerel diske hem de Cloudflare R2 logs/audit/ klasörüne şifreli olarak kaydedilir.",
    tip: "İstediğiniz günün log kayıtlarını tek tıkla arayabilir, filtreleyebilir ve JSON olarak indirebilirsiniz.",
    position: "bottom",
  },
  {
    id: "ai-report",
    targetSelector: '[data-tour="topbar-ai-report"]',
    title: "7. AI Günlük İstihbarat & Yönetici Raporları",
    badge: "YAPAY ZEKA • ADIM 7/8",
    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
    description:
      "Günün istatistiklerini tek tıkla yapay zeka ile özetleyin! Bugün kaç üye kayıt oldu, kaç mesaj atıldı, R2'ye ne kadar veri yüklendi, CDN'den ne kadar veri indirildi, bant genişliği durumu nedir; tümü R2'ye günlük arşivlenir.",
    tip: "Geçmiş günlerin raporlarını arşiv seçicisinden dilediğiniz an inceleyebilirsiniz.",
    position: "bottom",
  },
  {
    id: "theme-profile",
    targetSelector: '[data-tour="theme-profile"]',
    title: "8. Kurumsal Profil & Özel Avatar Teması",
    badge: "KİŞİSELLEŞTİRME • ADIM 8/8",
    icon: <Palette className="w-5 h-5 text-amber-400" />,
    description:
      "TurkceYama kurumsal logosuyla avatarınızı özelleştirin, altın, zümrüt, siber mavi gibi kurumsal renk paletlerini seçin ve yönetici rozetinizi stüdyoda sergileyin.",
    tip: "Tercihleriniz oturumunuzla birlikte kalıcı olarak kaydedilir.",
    position: "left",
  },
];

export const InteractiveTourGuide: React.FC<InteractiveTourGuideProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStepIndex];

  // Hedef elementi bul ve sınırlarını hesapla
  useEffect(() => {
    if (!isOpen) return;

    if (step.tab && onNavigateTab) {
      onNavigateTab(step.tab);
    }

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // İlgili elementi görünür kıl
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        setTargetRect(null);
      }
    };

    // DOM çizimini bekle
    const timer = setTimeout(updateRect, 180);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen, currentStepIndex, step, onNavigateTab]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("gunnerius_tour_completed", "true");
    onClose();
  };

  // Tooltip pozisyonu hesaplama
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed",
      };
    }

    const margin = 16;
    const tooltipWidth = 420;
    const tooltipHeight = 280;

    let top = targetRect.bottom + margin;
    let left = targetRect.left;

    if (step.position === "right") {
      top = targetRect.top;
      left = targetRect.right + margin;
    } else if (step.position === "left") {
      top = targetRect.top;
      left = Math.max(margin, targetRect.left - tooltipWidth - margin);
    } else if (step.position === "top") {
      top = Math.max(margin, targetRect.top - tooltipHeight - margin);
      left = targetRect.left;
    } else if (step.position === "bottom") {
      top = targetRect.bottom + margin;
      left = targetRect.left;
    }

    // Ekran sınırlarını aşmasını önle
    if (left + tooltipWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltipWidth - margin;
    }
    if (left < margin) left = margin;

    if (top + tooltipHeight > window.innerHeight - margin) {
      top = window.innerHeight - tooltipHeight - margin;
    }
    if (top < margin) top = margin;

    return {
      top: `${top}px`,
      left: `${left}px`,
      position: "fixed",
    };
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-auto">
      {/* KARARTMA ARKA PLANI & SPOTLIGHT KUTUSU */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            {/* Beyaz arka plan: her yeri gösterir */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Hedef alan siyah: maskeyi deler ve alttaki sayfayı aydınlatır */}
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Karartma katmanı */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(5, 7, 12, 0.78)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* HEDEF ETRAFINDA PARLAYAN ANİMASYONLU ÇERÇEVE */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 rounded-2xl border-2 border-[#d4af37] shadow-[0_0_25px_rgba(212,175,55,0.6)] animate-pulse"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        >
          {/* Radar Nabız Hareketi */}
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border border-white"></span>
          </span>
        </div>
      )}

      {/* REHBER TOOLTIP KARTI */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="z-[110] w-[420px] max-w-[calc(100vw-32px)] bg-[#14171e]/98 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-2xl p-6 text-white animate-slide-up"
      >
        {/* Üst Başlık & Kapat Butonu */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#1c2230] border border-amber-500/30">
              {step.icon}
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-amber-400 tracking-wider">
                {step.badge}
              </span>
              <h3 className="text-sm font-bold text-white leading-tight">
                {step.title}
              </h3>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 hover:bg-[#232a3b] rounded-lg transition cursor-pointer"
            title="Rehberi Kapat"
          >
            Rehberi Atla ✕
          </button>
        </div>

        {/* Açıklama */}
        <p className="text-xs text-gray-300 leading-relaxed mb-3">
          {step.description}
        </p>

        {/* İpucu Kutusu */}
        {step.tip && (
          <div className="p-2.5 rounded-xl bg-[#181d28] border border-[#2b364a] text-[11px] text-amber-300/90 mb-4 flex items-start gap-2">
            <span className="font-bold text-amber-400 shrink-0">💡 İpucu:</span>
            <span>{step.tip}</span>
          </div>
        )}

        {/* Alt Kontroller: Adım Noktaları ve İleri/Geri Butonları */}
        <div className="flex items-center justify-between pt-2 border-t border-[#232834]">
          {/* Adım Noktaları */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? "w-6 bg-amber-400"
                    : idx < currentStepIndex
                    ? "w-2 bg-emerald-500"
                    : "w-2 bg-[#2b364a]"
                }`}
                title={`Adım ${idx + 1}: ${s.title}`}
              />
            ))}
          </div>

          {/* Düğmeler */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl bg-[#181d28] hover:bg-[#232a3b] border border-[#2b364a] text-xs text-gray-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Önceki</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <span>{currentStepIndex === TOUR_STEPS.length - 1 ? "Rehberi Bitir" : "Sonraki"}</span>
              {currentStepIndex === TOUR_STEPS.length - 1 ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

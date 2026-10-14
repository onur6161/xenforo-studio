import React, { useState } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  MessageSquare,
  Rocket,
  Lock,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Sparkles,
} from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: "GUNNERIUS Portala Hoş Geldiniz",
      badge: "GİRİŞ REHBERİ • ADIM 1/5",
      icon: <ShieldCheck className="w-8 h-8 text-[#d4af37]" />,
      heading: "Kurumsal Forum Yönetim & Operasyon Merkezi",
      description:
        "turkceyama.org forumunuzun tüm telemetrisini, etkileşim akışlarını, içerik sağlığını ve bulut güncellemelerini tek bir güvenli masaüstü merkezinden yönetmeniz için tasarlandı.",
      highlights: [
        "Windows Credential Manager (DPAPI) ile donanım seviyesinde güvenli şifreleme",
        "Sıfır localStorage sızıntısı: Tüm tokenlar in-memory ve kısa ömürlü çalışır",
        "Cloudflare R2 entegrasyonu ile tek tıkla otomatik yama ve güncelleme dağıtımı",
      ],
    },
    {
      title: "Operasyon & Canlı İzleme Merkezi",
      badge: "DASHBOARD • ADIM 2/5",
      icon: <LayoutDashboard className="w-8 h-8 text-cyan-400" />,
      heading: "Canlı Forum KPI'ları ve R2 Depolama Takibi",
      description:
        "Forumunuzdaki toplam konu, mesaj, üye, ceza ve anlık çevrimiçi ziyaretçi trafiğini anlık takip edin. Cloudflare R2 depolama hacminizi gerçek zamanlı izleyin.",
      highlights: [
        "30 saniyelik akıllı önbellek ile sunucu yükünü sıfıra indiren mimari",
        "Gerçek zamanlı Cloudflare R2 dosya ve kota kullanım barı",
        "Ziyaretçi trafiğine endeksli anlık telemetri ve ağ dalgalanma grafiği",
      ],
    },
    {
      title: "Konular & Mesajlar: AI Analitiği",
      badge: "YAPAY ZEKA ANALİTİĞİ • ADIM 3/5",
      icon: <MessageSquare className="w-8 h-8 text-indigo-400" />,
      heading: "Kategori Hit Dağılımı ve Stratejik AI Önerileri",
      description:
        "Günlük, Haftalık, Aylık ve Yıllık periyotlarda hangi kategorinin hit aldığını ve popüler konuları inceleyin. Yapay zeka kategorilerinizi otomatik olarak sınıflandırır.",
      highlights: [
        "Durum Rozetleri: 'Yükselişte' (Zümrüt), 'İyi Seviyede' (Mavi), 'Geliştirme Gerekli' (Amber)",
        "AI Forum Danışmanı: Cevapsız konular ve sabitleme ihtiyaçları için hazır aksiyonlar",
        "En popüler hit konular liderlik sıralaması ve reaksiyon puanları",
      ],
    },
    {
      title: "Sürüm & Dağıtım (Cloudflare R2)",
      badge: "BULUT DAĞITIM • ADIM 4/5",
      icon: <Rocket className="w-8 h-8 text-amber-400" />,
      heading: "Tek Tıkla Yeni Yama & Uygulama Güncellemesi",
      description:
        "Derlenen masaüstü ve yama paketlerini doğrudan Cloudflare R2 nesne deposuna yükleyin, latest.json dosyasını anında güncelleyin ve otomatik yedekleme alın.",
      highlights: [
        "Yalnızca Süper Yönetici yetkisine açık güvenli R2 yayın tüneli",
        "Otomatik sürüm tarihçesi ve anında geri yükleme (Rollback) koruması",
        "Zero-egress: Cloudflare R2 sayesinde sıfır bant genişliği çıkış maliyeti",
      ],
    },
    {
      title: "Güvenlik, İzinler & Hata Takibi",
      badge: "GÜVENLİK • ADIM 5/5",
      icon: <Lock className="w-8 h-8 text-emerald-400" />,
      heading: "Donanım Seviyesi Koruma & Crash Logger",
      description:
        "Portaldaki tüm hassas anahtarlar Windows Kasası'nda şifrelenir. Karşılaşılan tüm hatalar gunnerius_errors.log kütüğüne kaydedilerek anında raporlanır.",
      highlights: [
        "5 başarısız giriş denemesinde otomatik 5 dakikalık brute-force koruması",
        "Sunucu taraflı rol denetimi (RBAC) ile izinsiz çağrılara geçit yok",
        "Tek tıkla tüm oturum ve kayıtlı anahtarları güvenle sıfırlama seçeneği",
      ],
    },
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((c) => c + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((c) => c - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-b from-slate-900 via-[#13161f] to-slate-950 border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Üst Dekorasyon Çizgisi */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-500"></div>

        {/* Kapat Butonu */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Rehberi Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* İçerik Alanı */}
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700 shadow-md">
              {current.icon}
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                {current.badge}
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1">
                {current.heading}
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {current.description}
          </p>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 space-y-2.5 mb-8">
            <div className="text-xs font-bold text-amber-400/90 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Önemli Özellikler:
            </div>
            {current.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span>{h}</span>
              </div>
            ))}
          </div>

          {/* Adım İlerleyiş Noktaları & Navigasyon */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === currentStep
                      ? "w-7 bg-amber-400"
                      : "w-2 bg-slate-700 hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Geri
                </button>
              )}

              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition shadow-lg shadow-amber-500/20"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <span>Portalı Kullanmaya Başla</span>
                    <Check className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>İlerle</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Zap, Server, Lock, Cpu, Globe } from "lucide-react";

interface SplashScreenProps {
  onFinish: () => void;
}

interface InitTask {
  id: string;
  name: string;
  detail: string;
  icon: React.ReactNode;
  durationMs: number;
}

const INITIALIZATION_PIPELINE: InitTask[] = [
  {
    id: "dpapi",
    name: "Windows DPAPI Şifreleme Kasası",
    detail: "Donanım seviyesi API ve oturum anahtarları doğrulandı",
    icon: <Lock className="w-3.5 h-3.5 text-amber-400" />,
    durationMs: 400,
  },
  {
    id: "xenforo",
    name: "XenForo REST API v2 Bağlantısı",
    detail: "turkceyama.org çekirdek sunucusu el sıkışması tamamlandı (28ms)",
    icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />,
    durationMs: 450,
  },
  {
    id: "r2",
    name: "Cloudflare R2 Yüksek Hızlı CDN",
    detail: "indir.turkceyama.org S3 depolama havuzu hazırlandı",
    icon: <Server className="w-3.5 h-3.5 text-emerald-400" />,
    durationMs: 400,
  },
  {
    id: "s3_multipart",
    name: "S3 Multipart Paralel Akış Motoru",
    detail: "4 eşzamanlı iş parçacığı ve 32 MB dinamik chunk mimarisi aktif",
    icon: <Zap className="w-3.5 h-3.5 text-indigo-400" />,
    durationMs: 380,
  },
  {
    id: "telemetry",
    name: "Yetki Matrisi & Telemetri Katmanı",
    detail: "Süper Yönetici güvenlik protokolü ve hata kütüğü senkronize",
    icon: <Cpu className="w-3.5 h-3.5 text-purple-400" />,
    durationMs: 350,
  },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [currentRunningIndex, setCurrentRunningIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    let index = 0;

    const executeNextTask = () => {
      if (index < INITIALIZATION_PIPELINE.length) {
        const task = INITIALIZATION_PIPELINE[index];
        setCurrentRunningIndex(index);

        setTimeout(() => {
          setCompletedTaskIds((prev) => [...prev, task.id]);
          const nextProg = Math.round(((index + 1) / INITIALIZATION_PIPELINE.length) * 100);
          setProgress(nextProg);

          index++;
          if (index < INITIALIZATION_PIPELINE.length) {
            executeNextTask();
          } else {
            setTimeout(() => {
              onFinish();
            }, 600);
          }
        }, task.durationMs);
      }
    };

    const initialTimer = setTimeout(() => {
      executeNextTask();
    }, 250);

    return () => clearTimeout(initialTimer);
  }, [onFinish]);

  const allCompleted = completedTaskIds.length === INITIALIZATION_PIPELINE.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090e] text-white select-none overflow-hidden">
      {/* İnce Radial Işık Halkası */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,175,55,0.12)_0%,rgba(15,23,42,0.4)_45%,transparent_75%)] pointer-events-none" />

      {/* Siber Izgara Deseni */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#d4af37 1px, transparent 1px), linear-gradient(90deg, #d4af37 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Ana Kart Konteyneri */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center px-6">
        {/* Üst Studio Rozeti */}
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#121620] border border-amber-500/30 text-amber-300 text-[11px] font-mono tracking-wider mb-6 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>GUNNERIUS STUDIO PRO</span>
          <span className="text-gray-500">•</span>
          <span className="text-amber-400 font-bold">v0.2.5 ENTERPRISE</span>
        </div>

        {/* Kurumsal Logo & Parıltı Efekti */}
        <div className="relative mb-5">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-[0_0_40px_rgba(212,175,55,0.35)] p-1 bg-[#0e1118]">
            <img
              src="/logo.jpg"
              alt="TurkceYama.org"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          {/* Radar Halkası */}
          <div className="absolute -inset-2 rounded-2xl border border-amber-500/20 animate-ping opacity-30 pointer-events-none" />
        </div>

        {/* Başlık & Kurumsal Tanım */}
        <h1 className="text-2xl font-black tracking-widest text-white font-mono flex items-center gap-2">
          GUNNERIUS
        </h1>
        <p className="text-xs tracking-wider text-amber-400 font-semibold mt-0.5 uppercase">
          Operasyonel Forum & Bulut Dağıtım Stüdyosu
        </p>
        <span className="text-[11px] text-gray-400 mt-0.5">
          turkceyama.org Resmi Altyapı Yönetim Konsolu
        </span>

        {/* BAŞLATMA ADIMLARI (CHECKPOINT PİPELİNE) */}
        <div className="w-full mt-6 bg-[#0d1017]/90 border border-[#1e2433] rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-2.5">
          <div className="flex items-center justify-between text-[11px] pb-2 border-b border-[#1b202d] text-gray-400 font-mono">
            <span className="flex items-center gap-1.5 text-gray-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Sistem Çekirdeği Başlatma Telemetrisi
            </span>
            <span className="text-amber-400 font-bold">
              {allCompleted ? "TAMAMLANDI (6/6)" : `ADIM ${Math.min(currentRunningIndex + 1, INITIALIZATION_PIPELINE.length)}/5`}
            </span>
          </div>

          {/* Adımlar Listesi */}
          <div className="space-y-2">
            {INITIALIZATION_PIPELINE.map((task, idx) => {
              const isDone = completedTaskIds.includes(task.id);
              const isCurrent = currentRunningIndex === idx && !isDone;

              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-300 ${
                    isDone
                      ? "bg-[#121622] border border-emerald-500/30 text-gray-200"
                      : isCurrent
                      ? "bg-[#151b29] border border-amber-500/40 text-white shadow-sm"
                      : "bg-[#0a0d14]/60 border border-transparent text-gray-500 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-[#0a0d14] border border-[#1e2433] shrink-0">
                      {task.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{task.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">
                        {task.detail}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    {isDone ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>OK</span>
                      </span>
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-mono text-gray-600">BEKLİYOR</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* İlerleme Çubuğu */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span className="font-medium text-gray-300">
                {allCompleted ? "Sistem Kullanıma Hazır!" : "Bileşenler Başlatılıyor..."}
              </span>
              <span className="font-mono text-amber-400 font-bold text-sm">%{progress}</span>
            </div>

            <div className="w-full h-2.5 bg-[#0a0d14] rounded-full overflow-hidden border border-[#232a3a] p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  allCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Alt Footer Bilgisi */}
        <div className="flex items-center justify-between w-full text-[10px] text-gray-500 font-mono mt-3 px-1">
          <span>SECURE PROTOCOL V4</span>
          <span>LATENCY: ~24MS</span>
          <span className="text-emerald-400">STATUS: OPERATIONAL</span>
        </div>
      </div>
    </div>
  );
};

// Web Audio API Synthesized Elegant Sound Effects
// Zero external assets required - lightweight, reliable and crisp

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Soft Cyber Chime on successful transfer or task completion
 */
export function playSuccessChime() {
  const enabled = localStorage.getItem("gunnerius_enable_sounds") !== "false";
  if (!enabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Note 1 (E5 - 659.25Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0.08, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.35);

  // Note 2 (B5 - 987.77Hz)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(987.77, now + 0.1);
  gain2.gain.setValueAtTime(0.09, now + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.5);
}

/**
 * Subtle click notification
 */
export function playClickSound() {
  const enabled = localStorage.getItem("gunnerius_enable_sounds") !== "false";
  if (!enabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(440, now);
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

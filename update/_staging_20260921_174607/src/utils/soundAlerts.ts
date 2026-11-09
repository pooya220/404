// Custom Sound Synthesizer & Audio Alert Engine for Gaming Club Management
// Supports both synthesized Web Audio API tones (100% reliable without external network)
// and custom audio presets or audio frequencies.

export type SoundType = 'beep' | 'chime' | 'digital' | 'radar' | 'urgent' | 'bell';

export const SOUND_OPTIONS: { id: SoundType; label: string; description: string }[] = [
  { id: 'chime', label: 'ملایم (چایم دوتایی)', description: 'صدای دلنشین دو مرحله‌ای دو دیز و سل' },
  { id: 'digital', label: 'دیجیتال (ساعت مچی/آرپژ)', description: 'صدای مدرن بازی‌های دیجیتال سه بوقی' },
  { id: 'beep', label: 'بوق استاندارد (Beep)', description: 'صدای کلاسیک هشدار استاندارد تایمر' },
  { id: 'radar', label: 'رادار سونار (پینگ فضایی)', description: 'پینگ با فرکانس نزولی و طنین‌دار' },
  { id: 'urgent', label: 'هشدار فوری (چند ضربه‌ای تند)', description: 'چهار ضربه متوالی با فرکانس بالا برای جلب توجه' },
  { id: 'bell', label: 'زنگ زنگوله‌ای بوفه (Bell)', description: 'زنگ سنتی فلزی با ماندگاری ملایم' },
];

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a synthesized sound alert with volume control (0 to 100)
 * Uses dynamic compression and higher gain multipliers for loud, clear acoustics in noisy club environments.
 */
export function playAlertSound(type: SoundType = 'chime', volume: number = 80) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Normalizing volume: 0..100 -> 0..1, scaled logarithmically for human hearing
    const rawVolume = Math.max(5, Math.min(100, volume || 80)) / 100;
    // Perceptual loudness boost
    const normalizedVol = Math.pow(rawVolume, 0.7);

    // Dynamics compressor to maximize volume and punch without distortion/clipping
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(10, ctx.currentTime);
    compressor.ratio.setValueAtTime(6, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.12, ctx.currentTime);
    compressor.connect(ctx.destination);

    const masterGain = ctx.createGain();
    // High master boost for gaming environment
    masterGain.gain.setValueAtTime(normalizedVol * 1.8, ctx.currentTime);
    masterGain.connect(compressor);

    const now = ctx.currentTime;

    switch (type) {
      case 'beep': {
        // Piercing dual-tone beep for strong audibility
        [880, 1760].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(idx === 0 ? 0.9 : 0.4, now + 0.02);
          gain.gain.setValueAtTime(idx === 0 ? 0.9 : 0.4, now + 0.28);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now);
          osc.stop(now + 0.45);
        });
        break;
      }

      case 'digital': {
        // 3 loud, crisp digital beeps (high contrast square/triangle mix)
        [0, 0.12, 0.24].forEach((delay, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(1174.66 + idx * 220, now + delay); // D6, E6, F#6

          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.85, now + delay + 0.015);
          gain.gain.setValueAtTime(0.85, now + delay + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.11);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now + delay);
          osc.stop(now + delay + 0.12);
        });
        break;
      }

      case 'chime': {
        // Resonant chime bells with rich harmonics and full body
        const notes = [
          { freq: 659.25, time: 0, dur: 0.45 },    // E5
          { freq: 880.00, time: 0.18, dur: 0.7 },  // A5
        ];

        notes.forEach(({ freq, time, dur }) => {
          // Fundamental
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(freq, now + time);

          gain1.gain.setValueAtTime(0, now + time);
          gain1.gain.linearRampToValueAtTime(0.9, now + time + 0.02);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

          osc1.connect(gain1);
          gain1.connect(masterGain);

          osc1.start(now + time);
          osc1.stop(now + time + dur + 0.02);

          // Octave harmonic for brightness & punch
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(freq * 2, now + time);

          gain2.gain.setValueAtTime(0, now + time);
          gain2.gain.linearRampToValueAtTime(0.4, now + time + 0.015);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + time + dur * 0.6);

          osc2.connect(gain2);
          gain2.connect(masterGain);

          osc2.start(now + time);
          osc2.stop(now + time + dur + 0.02);
        });
        break;
      }

      case 'radar': {
        // High penetrating sonar sweep with sustain
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.55);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.95, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.65);
        break;
      }

      case 'urgent': {
        // 4 loud, piercing urgent alarm pulses with sawtooth + square bite
        [0, 0.11, 0.22, 0.33].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(1480, now + delay);

          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.85, now + delay + 0.01);
          gain.gain.setValueAtTime(0.85, now + delay + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now + delay);
          osc.stop(now + delay + 0.1);
        });
        break;
      }

      case 'bell': {
        // Clear metallic shop counter bell (3 harmonizing frequencies)
        const harmonics = [
          { freq: 1760, gainVal: 0.7, decay: 0.8 },
          { freq: 2640, gainVal: 0.45, decay: 0.6 },
          { freq: 3520, gainVal: 0.35, decay: 0.4 },
        ];

        harmonics.forEach(({ freq, gainVal, decay }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now);
          osc.stop(now + decay + 0.05);
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Failed to play alert sound:', err);
  }
}

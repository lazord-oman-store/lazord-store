/**
 * Lightweight, zero-dependency Web Audio API chime for new incoming orders.
 * Safely handles browser autoplay policies without throwing or logging errors.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

function getOrCreateAudioContext(): AudioContext | null {
  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

/**
 * Must be called from a user interaction (click/keydown) to unlock Web Audio
 * cleanly in browsers with strict autoplay policies.
 */
export async function unlockOrderAudioContext(): Promise<boolean> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === 'running';
}

/**
 * Plays a soft, warm two-note chime (E5 -> B5) when AudioContext is unlocked.
 * Never throws or produces unhandled promise rejections if autoplay is blocked.
 */
export async function playOrderChime(options?: {
  fromUserGesture?: boolean;
}): Promise<boolean> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    if (!options?.fromUserGesture) {
      // Respect browser autoplay restriction silently until owner interacts
      return false;
    }
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }

  if (ctx.state !== 'running') {
    return false;
  }

  try {
    const now = ctx.currentTime;
    // Soft, pleasant luxury chime: warm fifth interval (E5 -> B5)
    const notes = [
      { freq: 659.25, start: 0, duration: 0.34, peak: 0.065 },
      { freq: 987.77, start: 0.14, duration: 0.48, peak: 0.055 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(note.peak, now + note.start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    return true;
  } catch {
    return false;
  }
}

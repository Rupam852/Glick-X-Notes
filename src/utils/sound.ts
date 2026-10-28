/**
 * Ultra-lightweight Web Audio API synthesizer for app micro-interactions
 * Zero asset dependencies, 0 latency, battery friendly
 */

class SoundEffects {
  private ctx: AudioContext | null = null;

  private async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    // Sound effects state stored in local storage
    return localStorage.getItem('glick_sound_enabled') === 'true';
  }

  public setEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('glick_sound_enabled', enabled ? 'true' : 'false');
  }

  // Crisp friendly pop (Craft / iOS reaction style)
  public async playPop(force: boolean = false) {
    if (!force && !this.isEnabled()) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.09);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      // Ignore audio autoplay restrictions
    }
  }

  // Golden chime when pinning/favoriting a note
  public async playPin(force: boolean = false) {
    if (!force && !this.isEnabled()) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [659.25, 987.77].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + (i * 0.05);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch (e) {
      // Ignore
    }
  }

  // Soft switch/checkbox tick
  public async playTick(force: boolean = false) {
    if (!force && !this.isEnabled()) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {
      // Ignore
    }
  }

  // Subtle action swoosh / trash sound
  public async playSwoosh(force: boolean = false) {
    if (!force && !this.isEnabled()) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      // Ignore
    }
  }
}

export const sound = new SoundEffects();

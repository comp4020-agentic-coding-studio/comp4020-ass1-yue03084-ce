// The camera's two noises, synthesised. Off by default and behind a toggle,
// because sound that arrives unasked on a page about a *silent* chemical
// process is a trick, not an explanation — but the shutter and the motor are
// the two moments the reader has a memory of, and hearing them is what makes
// the ejection feel like a machine doing something rather than a div moving.
//
// No audio files: an AudioContext is a handful of nodes, and a build with no
// binary assets is a build with nothing to 404 on the deployed base path.

export interface Sound {
  setEnabled(on: boolean): void;
  /** The clack of the mirror and the shutter, ~90ms. */
  shutter(): void;
  /** The film motor, for as long as the print takes to come out. */
  motor(seconds: number): void;
}

export function makeSound(): Sound {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let on = false;

  // Constructed on first use, not on load: a context created without a gesture
  // starts suspended in Chrome, and one created on every page view is a
  // background audio graph nobody asked for.
  function wake(): AudioContext | null {
    if (!on) return null;
    ctx ??= new AudioContext();
    void ctx.resume();
    return ctx;
  }

  function noiseBuffer(ac: AudioContext): AudioBuffer {
    if (noise) return noise;
    const buf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    return buf;
  }

  return {
    setEnabled(next: boolean): void {
      on = next;
      if (!next && ctx) void ctx.suspend();
    },

    shutter(): void {
      const ac = wake();
      if (!ac) return;
      const t = ac.currentTime;

      // A shutter is a broadband knock: filtered noise with an envelope short
      // enough that the ear reads it as one event rather than as a hiss.
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      const band = ac.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 2400;
      band.Q.value = 0.8;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.32, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(band).connect(gain).connect(ac.destination);
      src.start(t);
      src.stop(t + 0.12);

      // ...with a low thump under it, which is the body, not the shutter.
      const body = ac.createOscillator();
      body.type = "sine";
      body.frequency.setValueAtTime(180, t);
      body.frequency.exponentialRampToValueAtTime(70, t + 0.08);
      const bg = ac.createGain();
      bg.gain.setValueAtTime(0.18, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      body.connect(bg).connect(ac.destination);
      body.start(t);
      body.stop(t + 0.14);
    },

    motor(seconds: number): void {
      const ac = wake();
      if (!ac) return;
      const t = ac.currentTime;

      // A geared motor is a buzz with a rough edge: a sawtooth for the pitch,
      // low-passed noise for the gear mesh, both fading in and out so it
      // starts and stops instead of appearing.
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(52, t);
      osc.frequency.linearRampToValueAtTime(58, t + seconds);
      const tone = ac.createGain();
      tone.gain.setValueAtTime(0.0001, t);
      tone.gain.linearRampToValueAtTime(0.06, t + 0.08);
      tone.gain.setValueAtTime(0.06, t + seconds - 0.15);
      tone.gain.linearRampToValueAtTime(0.0001, t + seconds);
      osc.connect(tone).connect(ac.destination);
      osc.start(t);
      osc.stop(t + seconds + 0.05);

      const grain = ac.createBufferSource();
      grain.buffer = noiseBuffer(ac);
      grain.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const gg = ac.createGain();
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.linearRampToValueAtTime(0.05, t + 0.08);
      gg.gain.setValueAtTime(0.05, t + seconds - 0.15);
      gg.gain.linearRampToValueAtTime(0.0001, t + seconds);
      grain.connect(lp).connect(gg).connect(ac.destination);
      grain.start(t);
      grain.stop(t + seconds + 0.05);
    },
  };
}

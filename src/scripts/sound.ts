// The camera's two noises, synthesised. Off by default and behind a toggle,
// because sound that arrives unasked on a page about a *silent* chemical
// process is a trick, not an explanation — but the shutter and the motor are
// the two moments the reader has a memory of, and hearing them is what makes
// the ejection feel like a machine doing something rather than a div moving.
//
// No audio files: an AudioContext is a handful of nodes, and a build with no
// binary assets is a build with nothing to 404 on the deployed base path.
//
// Everything here is built out of noise and filters rather than out of tones.
// That is the whole design rule and it is worth stating, because the obvious
// way to make a camera noise — an oscillator with a fast envelope — produces a
// beep, and a beep is the one thing a mechanism does not sound like. A real
// shutter is a broadband knock: a lot of frequencies at once, gone in a
// fiftieth of a second. Noise through a bandpass is that. An oscillator is a
// pitch, and the ear names a pitch instead of naming an object.

/** Where the ejection animation stalls, as fractions of its duration.
 *
 *  These are the two flat spots in `@keyframes eject` in global.css — the film
 *  motor is a stepper against a spring, so the print grabs, moves, catches,
 *  moves. The motor's gain dips through each of them, because a whir that runs
 *  flat while the print visibly stops is two machines rather than one.
 *
 *  This is a second copy of a number that lives in the stylesheet, which is
 *  exactly the thing that goes stale. It cannot be one copy — CSS keyframes and
 *  an AudioParam schedule have no shared representation — so `spec/sound.test.ts`
 *  reads the keyframes and asserts the flat spots are still where this says they
 *  are. Move a keyframe and that test fails, which is the only reason this is
 *  allowed to be written down twice. */
export const EJECT_PAUSES: readonly (readonly [number, number])[] = [
  [0.14, 0.2],
  [0.5, 0.56],
];

/** Everything goes through this. Quiet enough that a reader in headphones who
 *  did not expect audio is not punished for turning it on. */
const MASTER = 0.15;

export interface Sound {
  setEnabled(on: boolean): void;
  /** The clack of the mechanism, two transients, ~120ms end to end. */
  shutter(): void;
  /** The film motor, for as long as the print takes to come out. */
  motor(seconds: number): void;
}

export function makeSound(): Sound {
  let ctx: AudioContext | null = null;
  let bus: GainNode | null = null;
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

  /** The one output stage, so the mix is set in a single place rather than
   *  smeared across six gain values that drift apart when one is edited. */
  function output(ac: AudioContext): GainNode {
    if (bus) return bus;
    bus = ac.createGain();
    bus.gain.value = MASTER;
    bus.connect(ac.destination);
    return bus;
  }

  // Half a second of white noise, reused by everything. Half a second rather
  // than the thirty milliseconds a click needs, for two reasons: the motor
  // loops this same buffer, and a click can take a random window out of it, so
  // the two transients of one press are thirty milliseconds of *different*
  // noise instead of the identical sample played twice.
  function noiseBuffer(ac: AudioContext): AudioBuffer {
    if (noise) return noise;
    const buf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    return buf;
  }

  /** One transient: thirty milliseconds of noise, banded around 3kHz, with an
   *  attack too fast to hear as a fade and a decay short enough that the ear
   *  reads one event rather than a hiss. This is the sound; the sine below is
   *  only its body. */
  function burst(ac: AudioContext, at: number, level: number): void {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);

    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 3000;
    // Wide enough to stay a knock. Past about Q=4 the band starts ringing and
    // the click acquires a pitch, which is the failure this whole file is
    // written to avoid.
    band.Q.value = 1.2;

    const g = ac.createGain();
    // Ramped from a floor rather than from zero: exponentialRamp cannot start
    // at 0, and a linear attack this short is audibly softer than the knock
    // wants to be.
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);

    src.connect(band).connect(g).connect(output(ac));
    src.start(at, Math.random() * 0.4, 0.03);
    src.stop(at + 0.05);
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

      // Two transients, because a mechanism has two: the blades opening under
      // the press, and seventy milliseconds later the mechanism letting go.
      // One click sounds like a button. Two sound like something with parts.
      burst(ac, t, 0.7);
      burst(ac, t + 0.07, 0.42);

      // The body under the knock — the camera's shell moving, not the shutter.
      // Nine cycles of 150Hz is short enough to land as a thump rather than as
      // a note, and it is what stops the click sounding like a fingernail on
      // glass.
      //
      // 0.09 rather than the 0.25 this started at, and the difference is the
      // whole complaint about the old sound. Peak amplitudes lie about balance
      // here: a sine spends its life near its peak, while a noise burst of the
      // same peak is far quieter on average, so a body set by eye against the
      // burst ends up carrying the click. Measured as band energy, 0.25 put four
      // times as much power under 250Hz as in the 2-4.5kHz knock — a low tone
      // with some hiss on it, which is exactly the thing being replaced.
      const body = ac.createOscillator();
      body.type = "sine";
      body.frequency.value = 150;
      const bg = ac.createGain();
      bg.gain.setValueAtTime(0.09, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      body.connect(bg).connect(output(ac));
      body.start(t);
      body.stop(t + 0.07);
    },

    motor(seconds: number): void {
      const ac = wake();
      if (!ac) return;
      const t = ac.currentTime;
      const end = t + seconds;

      // A geared motor is a buzz with a rough edge: a sawtooth for the pitch of
      // the gear train, quiet noise for the paper dragging over it, and one
      // lowpass over both so they sound like one object rather than two sources
      // that happen to be playing together.
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400;

      const level = ac.createGain();
      lp.connect(level).connect(output(ac));

      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(85, t);
      // A motor under a load that is coming off it: the pitch creeps up as the
      // print clears the rollers. Dead-steady is the tell that it is synthetic.
      osc.frequency.linearRampToValueAtTime(94, end);
      const oscGain = ac.createGain();
      oscGain.gain.value = 0.7;
      osc.connect(oscGain).connect(lp);
      osc.start(t);
      osc.stop(end + 0.05);

      const grain = ac.createBufferSource();
      grain.buffer = noiseBuffer(ac);
      grain.loop = true;
      const grainGain = ac.createGain();
      grainGain.gain.value = 0.5;
      grain.connect(grainGain).connect(lp);
      grain.start(t);
      grain.stop(end + 0.05);

      // Gears, not a hum. Eight cycles a second of a few percent depth is the
      // difference between a mechanism feeding paper and a mains buzz. It is
      // connected *to the gain AudioParam*, so it rides on top of the envelope
      // below instead of replacing it — including through the dips, where a
      // real mechanism keeps turning while the paper is caught.
      const lfo = ac.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 8;
      const depth = ac.createGain();
      depth.gain.value = 0.012;
      lfo.connect(depth).connect(level.gain);
      lfo.start(t);
      lfo.stop(end + 0.05);

      // In over 100ms, out over 200ms, so it starts and stops rather than
      // appearing and vanishing.
      const HOLD = 0.09;
      const DIP = 0.05;
      level.gain.setValueAtTime(0.0001, t);
      level.gain.linearRampToValueAtTime(HOLD, t + 0.1);

      // ...and a dip through each place the print visibly stops. The ramps are
      // deliberately slower than the stall itself: a motor bogging down and
      // picking up again is a slope, and a step here would read as a second
      // click rather than as the same motor labouring.
      for (const [from, to] of EJECT_PAUSES) {
        const a = t + from * seconds;
        const b = t + to * seconds;
        level.gain.setValueAtTime(HOLD, a - 0.04);
        level.gain.linearRampToValueAtTime(DIP, a + 0.02);
        level.gain.setValueAtTime(DIP, b - 0.02);
        level.gain.linearRampToValueAtTime(HOLD, b + 0.06);
      }

      level.gain.setValueAtTime(HOLD, end - 0.2);
      level.gain.linearRampToValueAtTime(0.0001, end);
    },
  };
}

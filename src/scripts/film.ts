// The model, with no DOM in it. Everything the page shows is a function of one
// number — how far the visitor has pushed the clock — so the claims the piece
// makes about Polaroid film can be tested without rendering anything.

export type TeamId = "cyan" | "magenta" | "yellow";

export const TEAMS: readonly TeamId[] = ["cyan", "magenta", "yellow"];

export interface Scene {
  readonly id: string;
  readonly label: string;
  /** Dyes whose home layer caught light, so they develop it and stop moving. */
  readonly stuck: readonly TeamId[];
}

/** One rule, four readings of it: light of a colour exposes the layer
 *  sensitive to that colour, and that layer's dye is the one held back. The
 *  two ends are what make it a rule rather than a trick — white light exposes
 *  everything, so nothing arrives and the print stays white; the dark exposes
 *  nothing, so every dye arrives and the print goes black. */
export const SCENES: readonly Scene[] = [
  { id: "red", label: "A red apple", stuck: ["cyan"] },
  { id: "green", label: "A green leaf", stuck: ["magenta"] },
  { id: "blue", label: "Blue sky", stuck: ["yellow"] },
  { id: "white", label: "White paper", stuck: ["cyan", "magenta", "yellow"] },
];

export const RED_APPLE: Scene = SCENES[0];

export function sceneById(id: string | null | undefined): Scene {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}

// Fractions of the scrub, not seconds. The gap between dyeDone and clearStart
// is the point of the whole piece: the colour is already in place and the
// background has not started to clear, so there is nothing to see yet.
export const TIMELINE = {
  runStart: 0.06,
  stuckHalt: 0.18,
  // Small on purpose: a stuck dye has to halt *inside* its own layer, or the
  // diagram says it got caught somewhere it never was.
  stuckReach: 0.055,
  dyeDone: 0.4,
  clearStart: 0.42,
  clearDone: 0.92,
} as const;

// APPROXIMATE. The shape (dye first, background much later) is the mechanism;
// these seconds are a plausible reading of it, not a sourced measurement.
// Verify against Polaroid's own figures before treating the numbers as fact.
export const FULL_SECONDS = 900;
export const TIME_CURVE = 2.5;

// How much of a channel a fully-arrived dye removes. Real dyes are not perfect
// filters, and a hard 1.0 renders as electric primaries that no Polaroid has
// ever produced.
const DENSITY = 0.88;

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Progress through a window: 0 before it, 1 after it. */
export function ramp(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}

export interface Frame {
  /** 0–1 per dye: how much of it has reached the receiving layer. */
  readonly arrived: Record<TeamId, number>;
  /** 0–1: how far the opaque reagent has turned white. */
  readonly clear: number;
  /** What the dye mix alone looks like, ignoring the backdrop. */
  readonly dye: readonly [number, number, number];
  /** What a person looking at the photo actually sees. */
  readonly photo: readonly [number, number, number];
}

export function develop(t: number, scene: Scene): Frame {
  const clear = ramp(t, TIMELINE.clearStart, TIMELINE.clearDone);

  const arrived = {} as Record<TeamId, number>;
  for (const team of TEAMS) {
    arrived[team] = scene.stuck.includes(team)
      ? ramp(t, TIMELINE.runStart, TIMELINE.stuckHalt) * TIMELINE.stuckReach
      : ramp(t, TIMELINE.runStart, TIMELINE.dyeDone);
  }

  // Subtractive: cyan takes red, magenta takes green, yellow takes blue. A dye
  // that got stuck never reaches the top, so its channel survives — which is
  // why the picture is made of the dye that had no work to do.
  const channels = [
    1 - arrived.cyan * DENSITY,
    1 - arrived.magenta * DENSITY,
    1 - arrived.yellow * DENSITY,
  ] as const;

  const to255 = (c: number): number => Math.round(c * 255);
  return {
    arrived,
    clear,
    dye: [to255(channels[0]), to255(channels[1]), to255(channels[2])],
    // The backdrop is what changes late: black reagent going white.
    photo: [to255(clear * channels[0]), to255(clear * channels[1]), to255(clear * channels[2])],
  };
}

export function elapsedSeconds(t: number): number {
  return FULL_SECONDS * t ** TIME_CURVE;
}

export function formatClock(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins} min` : `${mins} min ${secs}s`;
}

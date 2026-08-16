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

/** One rule, five readings of it: light of a colour exposes the layer
 *  sensitive to that colour, and that layer's dye is the one held back. The
 *  two ends are what make it a rule rather than a trick — white light exposes
 *  everything, so nothing arrives and the print stays white; the dark exposes
 *  nothing, so every dye arrives and the print goes black.
 *
 *  The cake is the only one that stalls two dyes without stalling all three,
 *  which is the reading the first four were missing: its sponge is bright in
 *  red and green and dark in blue, so cyan and magenta both run out of road and
 *  yellow does not — a secondary colour out of the same rule that gives the
 *  other four their primaries. This one number is the *whole frame* as one
 *  colour, and the frame is a stack of six; what the reader is actually meant to
 *  do with the cake is drag the slice marker down it, where the canvas answers
 *  the rule separately at every height. */
export const SCENES: readonly Scene[] = [
  { id: "red", label: "A red apple", stuck: ["cyan"] },
  { id: "green", label: "A green leaf", stuck: ["magenta"] },
  { id: "blue", label: "Blue sky", stuck: ["yellow"] },
  { id: "white", label: "White paper", stuck: ["cyan", "magenta", "yellow"] },
  { id: "cake", label: "A slice of cake", stuck: ["cyan", "magenta"] },
];

export const RED_APPLE: Scene = SCENES[0];

export function sceneById(id: string | null | undefined): Scene {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}

// --- the clock ------------------------------------------------------------

// APPROXIMATE. The shape — dye first, background much later — is the mechanism;
// these seconds are a plausible reading of it, not a sourced measurement.
// Verify against Polaroid's own figures before treating the numbers as fact.
export const FULL_SECONDS = 900;

// Track position is the square root of time, so time is position squared. Half
// the travel buys the first 225 seconds, which is where every dye curve below
// does its moving; the back half of the track is the slow background clear,
// where a whole minute looks like almost nothing. The clock keeps reporting
// true elapsed time, so the curve costs the reader no accuracy — only the
// evenness of the scale, which was buying them nothing.
export const TIME_CURVE = 2;

/** Seconds at which each dye is half-way home. Yellow's layer sits nearest the
 *  receiving layer and cyan's is furthest down the sandwich, so they arrive in
 *  that order — the order is geometry, not chemistry. */
export const DYE_HALF_SECONDS: Record<TeamId, number> = {
  yellow: 60,
  magenta: 100,
  cyan: 150,
};

/** And the reagent takes four minutes to get half-way from opaque to white —
 *  slower than every dye put together. That ratio is the entire piece. */
export const BG_HALF_SECONDS = 240;

/** A fresh print is not black. The opacifier is a very dark desaturated
 *  blue-green, which is why a Polaroid pulled in daylight reads as dark grey
 *  rather than as a hole in the page. */
export const OPACIFIER: readonly [number, number, number] = [18, 26, 24];

/** How far a dye gets before its own layer's development work stops it. Small
 *  on purpose: a stuck dye has to halt *inside* its own layer, or the diagram
 *  says it got caught somewhere it never was. */
export const STUCK_REACH = 0.055;

/** How much of a channel a fully-arrived dye removes. Real dyes are not perfect
 *  filters, and a hard 1.0 renders as electric primaries that no Polaroid has
 *  ever produced. */
export const DENSITY = 0.88;

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** A logistic curve, rescaled to leave 0 at exactly zero seconds and approach
 *  1 from there. Rescaling matters: a raw logistic is already 1% developed
 *  before the pod has burst, and a print that is 1% developed in the camera is
 *  a lie the reader can see, because the dot in the diagram starts off its own
 *  layer. 4.6 is ln(99), so that is the 1% being moved. */
export function sigmoid01(seconds: number, halfSeconds: number): number {
  const k = 4.6 / halfSeconds;
  const raw = 1 / (1 + Math.exp(-k * (seconds - halfSeconds)));
  const floor = 1 / (1 + Math.exp(k * halfSeconds));
  return clamp01((raw - floor) / (1 - floor));
}

/** How much of one dye has reached the receiving layer, if nothing stopped it. */
export function dyeArrival(seconds: number, team: TeamId): number {
  return sigmoid01(seconds, DYE_HALF_SECONDS[team]);
}

/** How far the opaque reagent has turned white. */
export function clearAt(seconds: number): number {
  return sigmoid01(seconds, BG_HALF_SECONDS);
}

/** The backdrop the dyes are seen against, opacifier to white. */
export function backgroundAt(seconds: number): readonly [number, number, number] {
  const c = clearAt(seconds);
  return [
    OPACIFIER[0] + (255 - OPACIFIER[0]) * c,
    OPACIFIER[1] + (255 - OPACIFIER[1]) * c,
    OPACIFIER[2] + (255 - OPACIFIER[2]) * c,
  ];
}

// --- one frame of the idealised scene -------------------------------------

export interface Frame {
  /** True elapsed seconds since the print left the camera. */
  readonly seconds: number;
  /** 0–1 per dye: how much of it has reached the receiving layer. */
  readonly arrived: Record<TeamId, number>;
  /** Per dye: it was exposed, and it has finished the short run it gets. */
  readonly halted: Record<TeamId, boolean>;
  /** 0–1: how far the opaque reagent has turned white. */
  readonly clear: number;
  /** What the dye mix alone looks like, ignoring the backdrop. */
  readonly dye: readonly [number, number, number];
  /** What a person looking at the photo actually sees. */
  readonly photo: readonly [number, number, number];
}

/** The whole print as one colour: the flat statement of the rule that the four
 *  scene labels name. The canvas renders the same physics per pixel from the
 *  same exported curves, so the two cannot drift apart — this one stays
 *  because a single colour is what the sticky bar has room for, and because
 *  the rule is easier to assert about than a photograph. */
export function develop(t: number, scene: Scene): Frame {
  const seconds = elapsedSeconds(t);

  const arrived = {} as Record<TeamId, number>;
  const halted = {} as Record<TeamId, boolean>;
  for (const team of TEAMS) {
    const run = dyeArrival(seconds, team);
    const stuck = scene.stuck.includes(team);
    // A stuck dye moves at the speed it would have moved at; it just runs out
    // of road, because the work it does is what pins it. So it follows its own
    // curve, scaled down to the width of its own layer.
    arrived[team] = stuck ? run * STUCK_REACH : run;
    halted[team] = stuck && run > 0.85;
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
  const bg = backgroundAt(seconds);
  return {
    seconds,
    arrived,
    halted,
    clear: clearAt(seconds),
    dye: [to255(channels[0]), to255(channels[1]), to255(channels[2])],
    // The backdrop is what changes late: dark reagent going white.
    photo: [
      Math.round(bg[0] * channels[0]),
      Math.round(bg[1] * channels[1]),
      Math.round(bg[2] * channels[2]),
    ],
  };
}

export function elapsedSeconds(t: number): number {
  return FULL_SECONDS * clamp01(t) ** TIME_CURVE;
}

/** The inverse. Autoplay advances real seconds and has to put the track handle
 *  back where those seconds live. */
export function scrubFor(seconds: number): number {
  return clamp01(seconds / FULL_SECONDS) ** (1 / TIME_CURVE);
}

export function formatClock(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins} min` : `${mins} min ${secs}s`;
}

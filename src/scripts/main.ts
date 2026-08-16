// Wiring only: read the controls, hand the numbers to the model, write the
// result onto the page. Everything worth asserting lives in film.ts, and
// everything expensive lives in photo.ts.
import {
  clamp01,
  clearAt,
  develop,
  dyeArrival,
  elapsedSeconds,
  formatClock,
  FULL_SECONDS,
  sceneById,
  scrubFor,
  STUCK_REACH,
  type Scene,
  type TeamId,
} from "./film";
import { attachPhoto, type Rgb } from "./photo";
import { makeSound } from "./sound";

const stack = document.querySelector<HTMLElement>(".stack");
const clock = document.querySelector<HTMLElement>('[data-testid="clock"]');
const scrub = document.querySelector<HTMLInputElement>('[data-testid="time"]');
const receive = document.querySelector<HTMLElement>(".layer--receive");
const runners = document.querySelectorAll<HTMLElement>(".runner");
const scenes = document.querySelectorAll<HTMLInputElement>('[data-testid="scene"]');
const chip = document.querySelector<HTMLElement>('[data-testid="photo-mini"]');
const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-testid="photo"]');
const slice = document.querySelector<HTMLElement>('[data-testid="slice"]');
const viewer = document.querySelector<HTMLElement>(".viewer");
const printed = document.querySelector<HTMLElement>('[data-testid="print"]');
const shutter = document.querySelector<HTMLButtonElement>('[data-testid="shutter"]');
const pauseBtn = document.querySelector<HTMLButtonElement>('[data-testid="pause"]');
const soundBtn = document.querySelector<HTMLButtonElement>('[data-testid="sound"]');
const status = document.querySelector<HTMLElement>('[data-testid="status"]');
const bars = new Map(
  [...document.querySelectorAll<HTMLElement>("[data-bar]")].map((el) => [el.dataset.bar, el]),
);

const view = canvas ? attachPhoto(canvas) : null;
const sound = makeSound();

// How many samples the cross-section takes down the column. The markup decides
// — it drew the dots — so counting them here keeps one number in one place.
const SAMPLES = document.querySelectorAll(".runner--cyan").length || 12;

const still = window.matchMedia("(prefers-reduced-motion: reduce)");

// Which subject is in front of the camera. The radio group owns the truth; this
// is only a cache of it, seeded from whichever radio is checked at load so a
// selection the browser restored is honoured rather than overwritten.
let scene: Scene = sceneById([...scenes].find((r) => r.checked)?.value);

// Seconds, not track position, is the state. The slider is an input device with
// a hundred stops on it; autoplay moves in fractions of one. Rounding the truth
// to the nearest stop on every animation frame is what makes a 30x playback
// visibly stair-step, so the slider follows the clock rather than holding it.
let seconds = 0;
let sliceX = 0.5;
let samples: Rgb[] = [];

// --- reading the column ---------------------------------------------------

// A channel *is* an exposure. R is what the red-sensitive layer saw, and that
// layer's dye is cyan — so a bright red pixel means cyan had work to do here
// and stopped. The three pairings below are the whole rule, in one map.
const SENSITIVE: Record<TeamId, 0 | 1 | 2> = { cyan: 0, magenta: 1, yellow: 2 };

function exposureOf(team: TeamId, sample: Rgb | undefined): number {
  return sample ? sample[SENSITIVE[team]] / 255 : 0;
}

function resample(): void {
  samples = view ? view.column(sliceX, SAMPLES) : [];
}

/** Which dyes this column holds back, for the marker's accessible name. */
function sliceSummary(): string {
  if (!samples.length) return `${Math.round(sliceX * 100)}% across`;
  const held = (["cyan", "magenta", "yellow"] as TeamId[]).filter(
    (team) => samples.filter((s) => exposureOf(team, s) >= 0.5).length > samples.length / 2,
  );
  const where = `${Math.round(sliceX * 100)}% across`;
  if (held.length === 3) return `${where} — every dye stalls here, so this column stays white`;
  if (!held.length) return `${where} — nothing stalls here, so every dye arrives and it goes dark`;
  return `${where} — ${held.join(" and ")} stall${held.length === 1 ? "s" : ""} here`;
}

// --- one frame ------------------------------------------------------------

// Empty gelatine: what the receiving layer looks like before any dye is in it.
const EMPTY: readonly number[] = [233, 231, 239];

// sRGB relative luminance, and then whichever of near-black and near-white the
// backdrop is further from. Measured rather than picked, because the receiving
// layer runs the whole range — a fixed label colour disappears at one end of
// the scene list or the other.
const linear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function inkFor(rgb: readonly number[]): string {
  const l = 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#111013" : "#f7f7fa";
}

function verdict(clear: number): string {
  if (clear < 0.12) return "still too dark to make anything out";
  if (clear < 0.45) return "shapes beginning to show through";
  if (clear < 0.85) return "most of the picture visible";
  return "fully developed";
}

function show(): void {
  const t = scrubFor(seconds);
  const frame = develop(t, scene);

  view?.render(seconds);

  for (const runner of runners) {
    const team = runner.dataset.team as TeamId;
    const i = Number(runner.dataset.i);
    const lag = Number(runner.style.getPropertyValue("--lag")) || 0;

    // Exposed here means this dye developed this layer at this point in the
    // column, which is the thing that pins it. Everything else about the dot
    // — how fast, how far — is the same for every sample.
    const exposed = exposureOf(team, samples[i]) >= 0.5;
    const run = dyeArrival(seconds, team);

    // Staggering by lane stops the teams moving as three rigid bars.
    const spread = 1 - lag * 0.15;
    const staged = clamp01((run - lag * 0.15) / spread);
    runner.style.setProperty("--p", (exposed ? staged * STUCK_REACH : staged).toFixed(4));
    runner.dataset.stuck = String(exposed && run > 0.85);
  }

  // The chip in the sticky bar is the print at a glance, so it reads the
  // canvas's own average rather than the idealised scene colour — at 23px the
  // two would be different answers to the same question.
  const glance = view ? view.averageAt(seconds) : frame.photo;
  chip?.style.setProperty("--photo", `rgb(${glance.map(Math.round).join(" ")})`);

  // The receiving layer shows the dye itself, at full strength, regardless of
  // the backdrop — the colour is there whether or not you can see it yet. It
  // mixes in with how much dye is present, so an empty layer looks empty
  // rather than finished.
  //
  // Composited here rather than left as an alpha over the page, because the
  // label sitting on it has to stay readable and a transparent slab has no
  // colour to measure. The first version was white text on 12% white over an
  // off-white page: at t=0 "Receiving layer" was invisible, and a probe found
  // it only because the layer looked empty in a screenshot.
  const load = Math.max(...Object.values(frame.arrived));
  const fill = EMPTY.map((c, i) => Math.round(c + (frame.dye[i] - c) * load * 0.82));
  receive?.style.setProperty("--fill", `rgb(${fill.join(" ")})`);
  receive?.style.setProperty("--on-fill", inkFor(fill));

  stack?.style.setProperty("--clear", frame.clear.toFixed(4));

  bars.get("yellow")?.style.setProperty("--v", dyeArrival(seconds, "yellow").toFixed(4));
  bars.get("magenta")?.style.setProperty("--v", dyeArrival(seconds, "magenta").toFixed(4));
  bars.get("cyan")?.style.setProperty("--v", dyeArrival(seconds, "cyan").toFixed(4));
  bars.get("clear")?.style.setProperty("--v", clearAt(seconds).toFixed(4));

  const clear = clearAt(seconds);
  canvas?.setAttribute(
    "aria-label",
    `${scene.label}, ${formatClock(seconds)} after leaving the camera: ` +
      `dye ${Math.round(((dyeArrival(seconds, "yellow") + dyeArrival(seconds, "magenta") + dyeArrival(seconds, "cyan")) / 3) * 100)}% arrived, ` +
      `background ${Math.round(clear * 100)}% cleared — ${verdict(clear)}.`,
  );

  // The slider's own value is a step count -- "42" tells a screen reader
  // nothing. aria-valuetext replaces it with the thing the step means, so the
  // native announcement on every arrow press is already the useful one. That
  // is also why the clock is not a live region: it would announce the same
  // string a second time, once per press, on top of the slider's own.
  const reading = formatClock(seconds);
  if (clock) clock.textContent = reading;
  scrub?.setAttribute("aria-valuetext", reading);
}

function syncHandle(): void {
  if (scrub) scrub.value = String(Math.round(scrubFor(seconds) * Number(scrub.max)));
}

const readScrub = (): number => (scrub ? Number(scrub.value) / Number(scrub.max) : 0);

// --- autoplay -------------------------------------------------------------

// 30x: the ten minutes worth watching go by in twenty seconds. Fast enough
// that nobody waits, slow enough that the gap between "the dye is in" and "you
// can see it" is still a gap and not a cut.
const SPEED = 30;
let playing = false;
let frameId = 0;
let last = 0;

function stopPlaying(): void {
  if (!playing) return;
  playing = false;
  cancelAnimationFrame(frameId);
  pauseBtn?.setAttribute("hidden", "");
}

function tick(now: number): void {
  if (!playing) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  seconds = Math.min(FULL_SECONDS, seconds + dt * SPEED);
  syncHandle();
  show();
  if (seconds >= FULL_SECONDS) {
    stopPlaying();
    if (status) status.textContent = "Fully developed.";
    return;
  }
  frameId = requestAnimationFrame(tick);
}

function startPlaying(): void {
  if (playing) return;
  playing = true;
  last = performance.now();
  pauseBtn?.removeAttribute("hidden");
  frameId = requestAnimationFrame(tick);
}

// Manual control always wins. Every path a person can use to move time
// themselves lands here first.
function takeOver(): void {
  stopPlaying();
  disarm();
}

// --- the camera -----------------------------------------------------------

const EJECT_MS = 2000;

/** The camera is "armed" when the subject changed and the print on the table is
 *  of the old one. It is a nudge toward the shutter, never a gate: the first
 *  thing the visitor does with the slider clears it. */
function disarm(): void {
  if (viewer?.dataset.armed !== "true") return;
  viewer.dataset.armed = "false";
  if (status) status.textContent = "";
}

function eject(): void {
  if (!printed || !viewer) return;
  stopPlaying();
  disarm();

  seconds = 0;
  syncHandle();
  resample();
  show();

  sound.shutter();

  if (still.matches) {
    // No slide, no shake, no judder. The print is simply there — which is what
    // an instant camera looks like to someone who cannot watch the animation
    // without feeling it.
    if (status) status.textContent = "Print ejected. The rollers burst the pod; development starts now.";
    startPlaying();
    return;
  }

  // One class on the figure drives all four animations — the print sliding, the
  // body shaking, the flash and the callout over the slot — so they cannot
  // drift out of step with each other the way four timers would.
  //
  // Restarting a CSS animation needs the class off, a forced reflow to make the
  // browser believe it, then the class back on. Without the reflow the second
  // shutter press does nothing at all.
  viewer.classList.remove("is-ejecting");
  void viewer.offsetWidth;
  viewer.classList.add("is-ejecting");
  setTimeout(() => viewer.classList.remove("is-ejecting"), EJECT_MS);

  sound.motor(EJECT_MS / 1000);
  if (status) status.textContent = "Print ejected. The rollers burst the pod; development starts now.";
  startPlaying();
}

shutter?.addEventListener("click", eject);

pauseBtn?.addEventListener("click", () => {
  stopPlaying();
  if (status) status.textContent = "Paused — the slider is yours.";
});

soundBtn?.addEventListener("click", () => {
  const next = soundBtn.getAttribute("aria-pressed") !== "true";
  soundBtn.setAttribute("aria-pressed", String(next));
  soundBtn.textContent = next ? "Sound on" : "Sound off";
  sound.setEnabled(next);
});

// --- the controls ---------------------------------------------------------

if (scrub) {
  // Both, not just input: pointerdown stops the playback the instant the handle
  // is grabbed, before it has been dragged anywhere, so the print does not keep
  // running away from under the visitor's thumb.
  scrub.addEventListener("pointerdown", takeOver);
  scrub.addEventListener("keydown", takeOver);
  scrub.addEventListener("input", () => {
    takeOver();
    seconds = elapsedSeconds(readScrub());
    show();
  });
}

for (const radio of scenes) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    scene = sceneById(radio.value);
    view?.setSubject(scene.id);
    resample();
    stopPlaying();

    // Re-arm rather than reset: the canvas switches to the new subject at once,
    // so the slider keeps telling the truth for anyone who never touches the
    // camera. The print only *looks* set aside.
    if (viewer) viewer.dataset.armed = "true";
    if (status) status.textContent = `${scene.label} in front of the lens. Press the shutter.`;
    if (slice) slice.setAttribute("aria-valuetext", sliceSummary());
    show();
  });
}

// --- the slice marker -----------------------------------------------------

function moveSlice(next: number): void {
  sliceX = clamp01(next);
  slice?.style.setProperty("--x", (sliceX * 100).toFixed(2));
  slice?.setAttribute("aria-valuenow", String(Math.round(sliceX * 100)));
  resample();
  slice?.setAttribute("aria-valuetext", sliceSummary());
  show();
}

if (slice) {
  const plate = slice.parentElement;

  const fromPointer = (e: PointerEvent): void => {
    if (!plate) return;
    const box = plate.getBoundingClientRect();
    moveSlice((e.clientX - box.left) / box.width);
  };

  slice.addEventListener("pointerdown", (e) => {
    slice.setPointerCapture(e.pointerId);
    fromPointer(e);
    e.preventDefault();
  });
  slice.addEventListener("pointermove", (e) => {
    if (slice.hasPointerCapture(e.pointerId)) fromPointer(e);
  });

  // The whole plate is a drag target, not just the 12px handle: a marker you
  // have to hit exactly is a marker most people will decide is decoration.
  plate?.addEventListener("pointerdown", (e) => {
    if (e.target === slice) return;
    slice.focus();
    fromPointer(e);
  });

  slice.addEventListener("keydown", (e) => {
    const step = e.key === "PageUp" || e.key === "PageDown" ? 0.1 : 0.02;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowUp: step,
      PageDown: -step,
      PageUp: step,
    };
    if (e.key === "Home") return void (moveSlice(0), e.preventDefault());
    if (e.key === "End") return void (moveSlice(1), e.preventDefault());
    const delta = moves[e.key];
    if (delta === undefined) return;
    moveSlice(sliceX + delta);
    e.preventDefault();
  });
}

// --- go -------------------------------------------------------------------

view?.setSubject(scene.id);
resample();
moveSlice(sliceX);
seconds = elapsedSeconds(readScrub());
show();

// The exploded view was pure CSS — html:has(#explode:checked) — until a probe
// caught Chrome updating --tilt on the root while leaving the rules that
// consume it unrecomputed: the stack stayed 480px tall at a 34deg tilt, and
// the .film margin never appeared. It reproduces when a tab is navigated to
// the page more than once, which is also what a browser Back button does —
// and Back restores a checked checkbox, so the page would have come back
// claiming to be exploded while rendering flat.
//
// Mirroring the checkbox onto an attribute sidesteps the invalidation path
// entirely. It costs nothing: the scrub already needs this script, so there is
// no no-JS visitor for the CSS-only version to serve. Syncing on load rather
// than only on change is the half that handles restored state.
const explode = document.querySelector<HTMLInputElement>('[data-testid="explode"]');
if (explode) {
  const sync = (): void => {
    document.documentElement.dataset.explode = String(explode.checked);
  };
  explode.addEventListener("change", sync);
  sync();
}

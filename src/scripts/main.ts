// Wiring only: read the scrub, hand it to the model, write the result onto the
// page. Everything worth asserting lives in film.ts.
import {
  develop,
  elapsedSeconds,
  formatClock,
  sceneById,
  TIMELINE,
  type Scene,
  type TeamId,
} from "./film";

const stack = document.querySelector<HTMLElement>(".stack");
// Two swatches, one visible at a time: the big one beside the diagram on a
// wide viewport, the small one in the sticky bar on a narrow one. Both read
// the same frame, so they cannot disagree.
const photos = document.querySelectorAll<HTMLElement>(
  '[data-testid="photo"], [data-testid="photo-mini"]',
);
const clock = document.querySelector<HTMLElement>('[data-testid="clock"]');
const scrub = document.querySelector<HTMLInputElement>('[data-testid="time"]');
const receive = document.querySelector<HTMLElement>(".layer--receive");
const runners = document.querySelectorAll<HTMLElement>(".runner");

const scenes = document.querySelectorAll<HTMLInputElement>('[data-testid="scene"]');

// Which subject is in front of the camera. The radio group owns the truth; this
// is only a cache of it, seeded from whichever radio is checked at load so a
// selection the browser restored is honoured rather than overwritten.
let scene: Scene = sceneById([...scenes].find((r) => r.checked)?.value);

function render(t: number): void {
  const frame = develop(t, scene);

  for (const runner of runners) {
    const team = runner.dataset.team as TeamId;
    const lag = Number(runner.style.getPropertyValue("--lag")) || 0;
    // Staggering by lane stops the teams moving as three rigid bars.
    const spread = 1 - lag * 0.15;
    const p = Math.min(1, Math.max(0, (frame.arrived[team] - lag * 0.15) / spread));
    runner.style.setProperty("--p", p.toFixed(4));
    runner.dataset.stuck = String(scene.stuck.includes(team) && t > TIMELINE.stuckHalt);
  }

  for (const el of photos) {
    el.style.setProperty("--photo", `rgb(${frame.photo.join(" ")})`);
  }

  // The receiving layer shows the dye itself, at full strength, regardless of
  // the backdrop — the colour is there whether or not you can see it yet. It
  // fades in with how much dye is present, so an empty layer looks empty
  // rather than white, which would read as "already finished".
  const load = Math.max(...Object.values(frame.arrived));
  receive?.style.setProperty("background", `rgb(${frame.dye.join(" ")} / ${(load * 82).toFixed(1)}%)`);

  stack?.style.setProperty("--clear", frame.clear.toFixed(4));
  if (clock) clock.textContent = formatClock(elapsedSeconds(t));
}

const readScrub = (): number =>
  scrub ? Number(scrub.value) / Number(scrub.max) : 0;

if (scrub) {
  scrub.addEventListener("input", () => render(readScrub()));
}

for (const radio of scenes) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    scene = sceneById(radio.value);
    render(readScrub());
  });
}

render(readScrub());

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

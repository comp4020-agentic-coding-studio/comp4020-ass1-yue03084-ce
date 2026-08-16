// Wiring only: read the scrub, hand it to the model, write the result onto the
// page. Everything worth asserting lives in film.ts.
import {
  develop,
  elapsedSeconds,
  formatClock,
  RED_APPLE,
  TIMELINE,
  type TeamId,
} from "./film";

const stack = document.querySelector<HTMLElement>(".stack");
const photo = document.querySelector<HTMLElement>('[data-testid="photo"]');
const clock = document.querySelector<HTMLElement>('[data-testid="clock"]');
const scrub = document.querySelector<HTMLInputElement>('[data-testid="time"]');
const receive = document.querySelector<HTMLElement>(".layer--receive");
const runners = document.querySelectorAll<HTMLElement>(".runner");

function render(t: number): void {
  const frame = develop(t, RED_APPLE);

  for (const runner of runners) {
    const team = runner.dataset.team as TeamId;
    const lag = Number(runner.style.getPropertyValue("--lag")) || 0;
    // Staggering by lane stops the teams moving as three rigid bars.
    const spread = 1 - lag * 0.15;
    const p = Math.min(1, Math.max(0, (frame.arrived[team] - lag * 0.15) / spread));
    runner.style.setProperty("--p", p.toFixed(4));
    runner.dataset.stuck = String(RED_APPLE.stuck.includes(team) && t > TIMELINE.stuckHalt);
  }

  photo?.style.setProperty("--photo", `rgb(${frame.photo.join(" ")})`);

  // The receiving layer shows the dye itself, at full strength, regardless of
  // the backdrop — the colour is there whether or not you can see it yet. It
  // fades in with how much dye is present, so an empty layer looks empty
  // rather than white, which would read as "already finished".
  const load = Math.max(...Object.values(frame.arrived));
  receive?.style.setProperty("background", `rgb(${frame.dye.join(" ")} / ${(load * 82).toFixed(1)}%)`);

  stack?.style.setProperty("--clear", frame.clear.toFixed(4));
  if (clock) clock.textContent = formatClock(elapsedSeconds(t));
}

if (scrub) {
  const read = (): number => Number(scrub.value) / Number(scrub.max);
  scrub.addEventListener("input", () => render(read()));
  render(read());
}

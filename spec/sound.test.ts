import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EJECT_PAUSES } from "../src/scripts/sound";

// The one thing about the audio that a machine can check.
//
// Whether the shutter sounds like a shutter is a judgement, and it belongs at
// the crit, not here. But the motor dips its gain at two moments that are
// written down in *this* file and drawn in *that* stylesheet, and there is no
// representation the two can share: CSS keyframes and an AudioParam schedule
// are different languages for the same instant. So the copy is allowed, and
// this test is the price of allowing it — move a keyframe in `@keyframes eject`
// and the sound stops agreeing with the picture, silently, in the one medium
// nobody screenshots.

const css = readFileSync(resolve("src/styles/global.css"), "utf8");

/** The eject keyframes as [percent, translateY percent] pairs, in order. */
function ejectStops(): [number, number][] {
  const block = /@keyframes\s+eject\s*\{([\s\S]*?)\n\}/.exec(css);
  expect(block, "the ejection animation the motor sound is scored against").toBeTruthy();
  const stops: [number, number][] = [];
  const rule = /(\d+(?:\.\d+)?)%\s*\{[^}]*?translateY\(\s*(-?\d+(?:\.\d+)?)%/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(block![1])) !== null) stops.push([Number(m[1]) / 100, Number(m[2])]);
  return stops;
}

describe("the motor sound is scored against the ejection animation", () => {
  it("reads an animation with stops in it at all", () => {
    const stops = ejectStops();
    expect(stops.length, "@keyframes eject should have several translateY stops").toBeGreaterThan(4);
    // The print starts above the slot and finishes at rest, which is the whole
    // gesture; if that ever inverts, every offset below is measuring nothing.
    expect(stops[0][1]).toBeLessThan(stops[stops.length - 1][1]);
  });

  it("dips the motor exactly where the print stalls", () => {
    const stops = ejectStops();

    // A stall is a pair of adjacent keyframes the card creeps between while the
    // ones around it are moving properly. "Creeps" is measured against this
    // animation's own average speed rather than against a hand-picked number,
    // so re-timing the ejection doesn't quietly redefine what counts as a pause.
    //
    // Still moving *forwards*, though, and that clause is doing real work: the
    // last two keyframes are the overshoot, where the card goes backwards a
    // couple of percent as the mechanism catches. That is slow by this measure
    // and is not a stall — it is the print arriving, and the motor should not
    // dip through it.
    const speeds = stops.slice(1).map(([p, y], i) => (y - stops[i][1]) / (p - stops[i][0]));
    const mean = speeds.reduce((a, s) => a + Math.abs(s), 0) / speeds.length;

    const stalls = speeds
      .map((s, i) => ({ s, from: stops[i][0], to: stops[i + 1][0] }))
      .filter(({ s }) => s > 0 && s < mean * 0.5)
      .map(({ from, to }) => [from, to] as const);

    expect(stalls.length, "the judder pauses in @keyframes eject").toBe(EJECT_PAUSES.length);
    for (const [i, [from, to]] of stalls.entries()) {
      expect(from, `pause ${i} starts where sound.ts says it does`).toBeCloseTo(EJECT_PAUSES[i][0], 4);
      expect(to, `pause ${i} ends where sound.ts says it does`).toBeCloseTo(EJECT_PAUSES[i][1], 4);
    }
  });

  it("keeps every dip inside the fades, so the envelope stays monotonic", () => {
    // The motor fades in over the first 100ms and out over the last 200ms. A dip
    // scheduled inside either fade would have two automation curves fighting
    // over the same AudioParam, and the audible result is a stutter at the start
    // rather than a stall in the middle.
    //
    // The duration is read off the stylesheet rather than written here, for the
    // same reason the pauses are checked against it: main.ts passes the motor
    // EJECT_MS, the animation is declared in CSS, and this test is the only
    // place that can notice the two disagreeing.
    const ms = /animation:\s*eject\s+(\d+)ms/.exec(css);
    expect(ms, "the ejection animation's declared duration").toBeTruthy();
    const seconds = Number(ms![1]) / 1000;
    for (const [from, to] of EJECT_PAUSES) {
      expect(from * seconds - 0.04, "a dip must begin after the fade-in").toBeGreaterThan(0.1);
      expect(to * seconds + 0.06, "a dip must end before the fade-out").toBeLessThan(seconds - 0.2);
    }
  });
});

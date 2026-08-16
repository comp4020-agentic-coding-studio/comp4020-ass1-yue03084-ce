import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  develop,
  DYE_HALF_SECONDS,
  dyeArrival,
  elapsedSeconds,
  RED_APPLE,
  SCENES,
  scrubFor,
  TEAMS,
  type TeamId,
} from "../src/scripts/film";

// The week's spec, turned into assertions. Two of its lines are mechanically
// checkable: the visitor must be able to do something that changes what they
// see, and the thing this page claims about Polaroid film has to stay true of
// what the page actually renders. The rest — whether the idea is any good — is
// for the crit.

const doc = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8")).window.document;

describe("the visitor can drive it", () => {
  it("ships a control, not just prose", () => {
    const control = doc.querySelector<HTMLInputElement>('input[type="range"]');
    expect(control, "the core interaction needs a real control in the shipped HTML").toBeTruthy();
  });

  it("names that control for anyone not looking at it", () => {
    const control = doc.querySelector('input[type="range"]');
    const labelled =
      control?.closest("label")?.textContent?.trim() ||
      control?.getAttribute("aria-label") ||
      "";
    expect(labelled.length, "a range with no accessible name is unusable by keyboard alone").toBeGreaterThan(0);
  });

  it("can be crossed by keyboard without a hundred presses", () => {
    // Named, not lint-caught: the range shipped at max=1000 step=1, which
    // drags perfectly and takes 60 arrow presses before anything on the page
    // moves. A control a keyboard user gives up on is not an accessible
    // control, so the step count is part of the contract.
    const control = doc.querySelector<HTMLInputElement>('input[type="range"]');
    const min = Number(control?.getAttribute("min") ?? 0);
    const max = Number(control?.getAttribute("max") ?? 100);
    const step = Number(control?.getAttribute("step") ?? 1);
    const presses = (max - min) / step;
    expect(presses, "one arrow press should be a visible move, not a rounding error").toBeLessThanOrEqual(100);
    expect(presses, "and still fine enough to drag smoothly").toBeGreaterThanOrEqual(40);
  });

  it("keeps the diagram and the result in the shipped page", () => {
    expect(doc.querySelector('[data-testid="film"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="photo"]')).toBeTruthy();
  });

  it("ships a swatch for each viewport, since each hides the other's", () => {
    // A source-order slip once hid both at 390px: the page computed the right
    // colour and drew it nowhere, so a phone visitor got a diagram and no
    // result. jsdom applies no media queries, so this can only assert both
    // exist -- which viewport reveals which is checked in a browser.
    expect(doc.querySelector('[data-testid="photo"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="photo-mini"]')).toBeTruthy();
  });

  it("lets the layers be pulled apart, by keyboard as much as by mouse", () => {
    const toggle = doc.querySelector<HTMLInputElement>('[data-testid="explode"]');
    expect(toggle?.getAttribute("type"), "a native checkbox is focusable and toggles on Space").toBe("checkbox");
    const name = toggle?.closest("label")?.textContent?.trim() ?? "";
    expect(name.length, "an unlabelled checkbox says nothing about what it does").toBeGreaterThan(0);
  });
});

describe("driving it changes what you see", () => {
  it("start and finish do not look the same", () => {
    const start = develop(0, RED_APPLE).photo;
    const end = develop(1, RED_APPLE).photo;
    const distance = start.reduce((sum, c, i) => sum + Math.abs(c - end[i]), 0);
    expect(distance, "if the scrub does not change the render, the interaction is decorative").toBeGreaterThan(150);
  });

  it("moves through in-between states rather than snapping", () => {
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => develop(i / 19, RED_APPLE).photo.join()),
    );
    expect(seen.size).toBeGreaterThan(8);
  });
});

describe("what the page claims about the film", () => {
  it("finishes the picture before it lets you see it", () => {
    // The whole thesis. If a refactor makes the photo readable at the moment
    // the dye lands, this page is telling people something false.
    //
    // The dye curves are sigmoids now, not ramps with an end, so there is no
    // single "done" instant to sample — the test has to go and find the first
    // moment the free dyes are home and ask what the print looks like there.
    // That is a better question than the old one anyway: it is the reader's
    // question, asked at the reader's moment.
    const free = TEAMS.filter((team) => !RED_APPLE.stuck.includes(team));
    const timeline = Array.from({ length: 400 }, (_, i) => develop(i / 399, RED_APPLE));
    const landed = timeline.find((f) => free.every((team) => f.arrived[team] >= 0.95));

    expect(landed, "the free dyes should be home long before the end").toBeDefined();
    expect(landed!.clear, "and the background has barely started").toBeLessThan(0.25);
    expect(Math.max(...landed!.photo), "so the print is still dark").toBeLessThan(70);
    expect(
      Math.max(...develop(1, RED_APPLE).photo),
      "while the same print, later, is bright — nothing moved but the backdrop",
    ).toBeGreaterThan(200);
  });

  it("brings the dyes home in the order the sandwich puts them in", () => {
    // Yellow's layer is nearest the top and cyan's is furthest down, so a
    // frame in the middle of the run should always be layered that way. If
    // this inverts, the diagram and the photo are telling opposite stories.
    const at = elapsedSeconds(scrubFor(DYE_HALF_SECONDS.magenta));
    expect(dyeArrival(at, "yellow")).toBeGreaterThan(dyeArrival(at, "magenta"));
    expect(dyeArrival(at, "magenta")).toBeGreaterThan(dyeArrival(at, "cyan"));
  });

  it("gives the fast half of the story half the track", () => {
    // The dye action is over in four minutes of a fifteen-minute clock. On a
    // linear track that is the first quarter of the travel and the rest is a
    // slow fade, so the curve is not a flourish -- it is what makes the part
    // worth watching draggable at all.
    expect(elapsedSeconds(0.5), "half the travel should buy about four minutes").toBeGreaterThan(180);
    expect(elapsedSeconds(0.5)).toBeLessThan(280);
    expect(elapsedSeconds(1), "and the far end is still the full clock").toBe(900);
    expect(scrubFor(elapsedSeconds(0.37)), "the mapping has to invert for autoplay").toBeCloseTo(0.37, 6);
  });

  it("never lets a stuck dye reach the top", () => {
    const end = develop(1, RED_APPLE);
    for (const team of RED_APPLE.stuck) {
      expect(end.arrived[team as TeamId], `${team} was exposed, so it develops and stops`).toBeLessThan(0.1);
    }
  });

  it("holds back exactly the dyes whose own layer caught the light", () => {
    // The rule, not four hard-coded colours: a stalled dye never reaches the
    // top, so the channel it would have absorbed survives into the print.
    // Cyan absorbs red, magenta green, yellow blue.
    for (const scene of SCENES) {
      const [r, g, b] = develop(1, scene).photo;
      const channel: Record<TeamId, number> = { cyan: r, magenta: g, yellow: b };
      for (const team of TEAMS) {
        const where = `${scene.id}: ${team}`;
        if (scene.stuck.includes(team)) {
          expect(channel[team], `${where} stalled, so its channel should survive`).toBeGreaterThan(200);
        } else {
          expect(channel[team], `${where} arrived, so its channel should be absorbed`).toBeLessThan(60);
        }
      }
    }
  });

  it("keeps white paper white, which is the case that proves it is a rule", () => {
    // Every layer exposed means every dye has work, so none of them arrive and
    // nothing is subtracted. If this ever comes out grey or coloured, the
    // model has stopped being about exposure and started being about hues.
    const white = SCENES.find((s) => s.id === "white");
    expect(white).toBeDefined();
    const [r, g, b] = develop(1, white!).photo;
    for (const c of [r, g, b]) expect(c).toBeGreaterThan(200);
    expect(Math.max(r, g, b) - Math.min(r, g, b), "and neutral, not tinted").toBeLessThan(8);
  });

  it("offers every scene as one keyboard-navigable choice", () => {
    const radios = doc.querySelectorAll<HTMLInputElement>('[data-testid="scene"]');
    expect(radios.length, "one control per scene in the shipped HTML").toBe(SCENES.length);
    const names = new Set([...radios].map((r) => r.getAttribute("name")));
    expect(names.size, "a shared name is what makes them one group to arrow through").toBe(1);
    expect([...radios].filter((r) => r.hasAttribute("checked")).length, "exactly one starts selected").toBe(1);
  });

  it("reads as red once it clears, because cyan is the dye that got stuck", () => {
    const [r, g, b] = develop(1, RED_APPLE).photo;
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { develop, RED_APPLE, TEAMS, TIMELINE, type TeamId } from "../src/scripts/film";

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

  it("keeps the diagram and the result in the shipped page", () => {
    expect(doc.querySelector('[data-testid="film"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="photo"]')).toBeTruthy();
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
    const atDyeDone = develop(TIMELINE.dyeDone, RED_APPLE);
    const free = TEAMS.filter((team) => !RED_APPLE.stuck.includes(team));
    const landed = free.map((team) => atDyeDone.arrived[team]);
    expect(Math.min(...landed), "the free dyes should be up top by now").toBeCloseTo(1, 5);
    expect(Math.max(...atDyeDone.photo), "and yet the photo must still be dark").toBeLessThan(12);
  });

  it("never lets a stuck dye reach the top", () => {
    const end = develop(1, RED_APPLE);
    for (const team of RED_APPLE.stuck) {
      expect(end.arrived[team as TeamId], `${team} was exposed, so it develops and stops`).toBeLessThan(0.1);
    }
  });

  it("reads as red once it clears, because cyan is the dye that got stuck", () => {
    const [r, g, b] = develop(1, RED_APPLE).photo;
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
});

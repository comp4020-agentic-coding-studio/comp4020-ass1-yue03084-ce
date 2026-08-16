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

  it("covers a secondary colour, not just the three primaries and white", () => {
    // Four scenes stalled one dye or all three, so every print the page could
    // make was a primary or white and the rule looked like it only had four
    // answers. A scene that stalls exactly two is the case that shows it has
    // eight: bright red and green with dark blue means cyan and magenta both
    // run out of road, and what survives is yellow.
    const two = SCENES.filter((s) => s.stuck.length === 2);
    expect(two.length, "at least one scene has to land between one dye and all three").toBeGreaterThan(0);
    const [r, g, b] = develop(1, two[0]).photo;
    expect(Math.min(r, g), "the two stalled channels survive").toBeGreaterThan(200);
    expect(b, "and the one that arrived is absorbed").toBeLessThan(60);
  });

  it("reads as red once it clears, because cyan is the dye that got stuck", () => {
    const [r, g, b] = develop(1, RED_APPLE).photo;
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
});

describe("the exploded view explains the exposure", () => {
  const stack = doc.querySelector('[data-testid="film"] .stack');
  const beams = doc.querySelectorAll<HTMLElement>(".ray");
  const dots = doc.querySelectorAll<HTMLElement>(".runner--cyan");

  const styleOf = (el: Element | null, prop: string): string =>
    el?.getAttribute("style")?.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`))?.[1]?.trim() ?? "";
  const num = (el: Element | null, prop: string): number => Number(/(-?[\d.]+)/.exec(styleOf(el, prop))?.[1]);

  it("shines one beam per sample, on the lanes the dots already use", () => {
    // A beam is a place in the photograph, exactly as a lane is. If these ever
    // stop being the same set of places, the diagram is drawing light landing
    // somewhere other than where it reports the consequence.
    expect(beams.length, "the beams have to be in the shipped HTML, not drawn by script").toBe(dots.length);
    const at = (t: string, i: number): number => num(doc.querySelectorAll(`.runner--${t}`)[i], "--lane");
    for (let i = 0; i < beams.length; i++) {
      const centre = (at("yellow", i) + at("magenta", i) + at("cyan", i)) / 3;
      expect(num(beams[i], "--lane"), `beam ${i} has to land on the dots it causes`).toBeCloseTo(centre, 6);
    }
  });

  it("cuts each beam where the explosion actually put that layer", () => {
    // The beams are drawn over a stack whose slabs have been translated apart,
    // so a cut written against the *collapsed* boundaries drops its colour in
    // mid-air. Each cut therefore has to carry the same --o its own slab does,
    // which is what this reads: the multiplier on --gap in the cut, against the
    // --o on the layer it belongs to.
    const rays = doc.querySelector(".rays");
    const gapTerm = (cut: string): number => {
      const m = /([+-])\s*([\d.]+)\s*\*\s*var\(--gap\)/.exec(styleOf(rays, `--cut-${cut}`));
      expect(m, `--cut-${cut} has to move with its layer`).toBeTruthy();
      return Number(`${m![1]}${m![2]}`);
    };
    const depth = (cut: string): number =>
      Number(/var\(--stack-h\)\s*\*\s*([\d.]+)/.exec(styleOf(rays, `--cut-${cut}`))?.[1]);

    for (const [layer, top, bottom] of [
      ["blue", "b0", "b1"],
      ["green", "g0", "g1"],
      ["red", "r0", "r1"],
    ]) {
      const o = num(doc.querySelector(`.layer--${layer}`), "--o");
      expect(gapTerm(top), `${layer}'s beam cut rides on its own slab`).toBe(o);
      expect(gapTerm(bottom)).toBe(o);
      expect(depth(bottom), `${layer} absorbs across its own span, not at a line`).toBeGreaterThan(depth(top));
    }

    // And in the order the sandwich meets the light: blue first, red last.
    expect(depth("b1")).toBeLessThanOrEqual(depth("g0"));
    expect(depth("g1")).toBeLessThanOrEqual(depth("r0"));
  });

  it("gives every layer that sees light somewhere to say what it saw", () => {
    // The pairing is the whole rule, and it is the pairing a refactor is most
    // likely to get backwards: the layer sensitive to a colour holds the dye
    // that absorbs that same colour. Blue-sensitive keeps yellow, and yellow is
    // the dye that takes blue out.
    for (const [layer, dye] of [
      ["blue", "yellow"],
      ["green", "magenta"],
      ["red", "cyan"],
    ]) {
      expect(
        doc.querySelector(`.layer--${layer} [data-verdict="${dye}"]`),
        `${layer}-sensitive is where ${dye} lives, so it is where ${dye}'s verdict goes`,
      ).toBeTruthy();
    }
    expect(doc.querySelectorAll("[data-verdict]").length, "and nowhere else — the other two see nothing").toBe(3);
  });

  it("keeps all of it out of the accessibility tree, where the marker already says it", () => {
    // The beams and the verdicts are a picture of which dyes this column holds
    // back. The marker's aria-valuetext is a sentence saying the same thing,
    // computed from the same samples over the same threshold, and it is already
    // announced on every move — a second copy would be the same fact read twice.
    expect(stack?.getAttribute("aria-hidden")).toBe("true");
    expect(doc.querySelector('[data-testid="slice"]')?.getAttribute("aria-valuetext")).toBeTruthy();
  });

  it("leaves the collapsed view alone", () => {
    // Nothing here may cost the default view anything: the beams are opacity 0
    // and the verdicts are display:none until the checkbox is on, so the page
    // as it first loads is the development-over-time diagram it always was.
    const css = readFileSync(resolve("src/styles/global.css"), "utf8");
    expect(/\.ray\s*\{[^}]*opacity:\s*0/.test(css), ".ray starts invisible").toBe(true);
    expect(/\.layer__verdict\s*\{[^}]*display:\s*none/.test(css), "verdicts start unrendered").toBe(true);
    for (const verdict of doc.querySelectorAll("[data-verdict]")) {
      expect(verdict.textContent, "and the markup ships no verdict it has not measured").toBe("");
    }
  });
});

describe("the rule card states the rule at the diagram", () => {
  const card = doc.querySelector<HTMLElement>('[data-testid="rule"]');

  it("ships both halves of the rule in the HTML", () => {
    // Both halves or neither: one of these on its own is the half that makes
    // Polaroid film sound backwards.
    const lines = [...(card?.querySelectorAll(".rulecard__line") ?? [])].map((l) =>
      l.textContent?.trim() ?? ""
    );
    expect(lines.length, "the card has to be in the shipped HTML, not drawn by script").toBe(2);
    expect(lines[0]).toMatch(/light present.*stuck/i);
    expect(lines[1]).toMatch(/light missing.*climbs/i);
  });

  it("is readable without tipping the stack", () => {
    // The verdicts on the slabs say the same thing per layer, but they are
    // display:none until the stack is exploded, and .rays__key fades with them.
    // This one is the version a reader gets for free, so it must not live
    // inside .stack — which is aria-hidden and tipped — at all.
    expect(card?.closest(".stack"), "inside the stack it inherits both the tilt and the aria-hidden").toBeNull();
    expect(card?.closest("[aria-hidden]")).toBeNull();
  });
});

describe("the strip over the lanes maps the photo onto the diagram", () => {
  const strip = doc.querySelector<HTMLElement>('[data-testid="colstrip"]');
  const cells = doc.querySelectorAll<HTMLElement>(".colstrip__cell");
  const dots = doc.querySelectorAll<HTMLElement>(".runner--cyan");

  // Percentages out of an inline style attribute. The strip's geometry is
  // handed down from the same two constants the lanes are, so this is checking
  // the arithmetic between them, not re-deriving it.
  const pct = (el: Element | null, prop: string): number =>
    Number(/(-?[\d.]+)%/.exec(el?.getAttribute("style")?.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`))?.[1] ?? "")?.[1]);

  it("has one swatch per sample the dots are keyed to", () => {
    expect(strip, "the strip has to be in the shipped HTML, not drawn by script").toBeTruthy();
    expect(cells.length).toBe(dots.length);
  });

  it("puts a swatch centre over every cluster of dots", () => {
    // Equal cells across the band, so cell i's centre is left + (i + 0.5) * cellWidth.
    // If that does not land on the dots it captions, the strip is decoration
    // sitting near the diagram rather than a key to it.
    const left = pct(strip, "--left");
    const width = pct(strip, "--width");
    const cell = width / cells.length;

    // Against the mean of the three teams, not any one of them: each team is
    // nudged sideways off the lane so the arrivals do not hide behind each
    // other, so a single team's --lane is deliberately off centre and only the
    // cluster as a whole marks the sample position. Written the wrong way round
    // first, and this test is why that was caught before a screenshot was.
    const at = (t: string, i: number): number =>
      pct(doc.querySelectorAll<HTMLElement>(`.runner--${t}`)[i], "--lane");

    for (let i = 0; i < cells.length; i++) {
      const centre = (at("yellow", i) + at("magenta", i) + at("cyan", i)) / 3;
      expect(left + (i + 0.5) * cell, `swatch ${i} has to sit over its dots`).toBeCloseTo(centre, 6);
    }
  });

  it("stays out of the accessibility tree, where twelve colours are noise", () => {
    // The marker's aria-valuetext already says which dyes this column holds
    // back, in words. This is the same fact for the eyes.
    expect(strip?.getAttribute("aria-hidden")).toBe("true");
    expect(
      doc.querySelector('[data-testid="slice"]')?.getAttribute("aria-valuetext"),
      "which is only true while the marker still describes itself",
    ).toBeTruthy();
  });
});

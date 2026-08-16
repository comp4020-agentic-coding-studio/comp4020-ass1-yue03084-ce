// The print, per pixel. The subject is a photograph of the world; this turns it
// into a Polaroid mid-development, which is a different picture at every second
// and only equals the subject at the very end.
//
// The physics is the same three lines film.ts asserts about the whole print,
// applied 90,000 times: a pixel's dye load is what the subject's light did not
// deliver, each dye arrives on its own clock, and all of it is seen against a
// backdrop that starts nearly black. Both paths import the same curves, so the
// canvas and the swatch in the sticky bar cannot tell different stories.

import { backgroundAt, clamp01, DENSITY, dyeArrival } from "./film";
import { subjectImage, SUBJECT_SIZE } from "./subjects";

export type Rgb = readonly [number, number, number];

export interface PhotoCanvas {
  setSubject(id: string): void;
  render(seconds: number): void;
  /** Average colour of `bands` equal slices down one column of the *subject*.
   *  The cross-section reads this, so it has to be the scene's light and not
   *  the half-developed print — exposure happened in the camera, once. */
  column(x01: number, bands: number): Rgb[];
  /** The whole subject as one colour, developed to `seconds`. */
  averageAt(seconds: number): Rgb;
}

export function attachPhoto(canvas: HTMLCanvasElement): PhotoCanvas | null {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const s = SUBJECT_SIZE;
  canvas.width = s;
  canvas.height = s;

  const out = ctx.createImageData(s, s);
  const dest = out.data;
  let src = subjectImage("red");
  let mean: Rgb = meanOf(src);

  function setSubject(id: string): void {
    src = subjectImage(id);
    mean = meanOf(src);
  }

  function render(seconds: number): void {
    // Three scalars and a backdrop, computed once; the loop below is then pure
    // arithmetic on typed arrays, which is what makes a full recompute per
    // slider frame cheap enough to not bother with dirty-checking.
    const devC = dyeArrival(seconds, "cyan") * DENSITY;
    const devM = dyeArrival(seconds, "magenta") * DENSITY;
    const devY = dyeArrival(seconds, "yellow") * DENSITY;
    const [bgR, bgG, bgB] = backgroundAt(seconds);

    const from = src.data;
    for (let i = 0; i < from.length; i += 4) {
      // cyan = 1 - R/255, and cyan is the dye that removes red. Early on these
      // are already large and the backdrop is nearly black, so the picture is
      // fully painted and completely invisible. That is the point of the page.
      dest[i] = bgR * (1 - (1 - from[i] / 255) * devC);
      dest[i + 1] = bgG * (1 - (1 - from[i + 1] / 255) * devM);
      dest[i + 2] = bgB * (1 - (1 - from[i + 2] / 255) * devY);
      dest[i + 3] = 255;
    }
    ctx!.putImageData(out, 0, 0);
  }

  function column(x01: number, bands: number): Rgb[] {
    // Five pixels wide, not one: a single column of a drawn edge picks up
    // whatever the antialiasing happened to leave there, and the diagram would
    // flicker between stuck and climbing as the marker moved one pixel.
    const x = Math.round(clamp01(x01) * (s - 1));
    const x0 = Math.max(0, x - 2);
    const x1 = Math.min(s - 1, x + 2);
    const from = src.data;

    return Array.from({ length: bands }, (_, b) => {
      const y0 = Math.floor((b * s) / bands);
      const y1 = Math.max(y0 + 1, Math.floor(((b + 1) * s) / bands));
      let r = 0;
      let g = 0;
      let bl = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let px = x0; px <= x1; px++) {
          const i = (y * s + px) * 4;
          r += from[i];
          g += from[i + 1];
          bl += from[i + 2];
          n++;
        }
      }
      return [r / n, g / n, bl / n] as Rgb;
    });
  }

  function averageAt(seconds: number): Rgb {
    return developedRgb(mean, seconds);
  }

  return { setSubject, render, column, averageAt };
}

/** One colour of the scene, as the print shows it at `seconds`.
 *
 *  This is the loop in `render` written out for a single pixel. The loop keeps
 *  its own copy because hoisting three scalars out of 90,000 iterations is the
 *  reason a full recompute per frame is affordable — but everything that needs
 *  the answer for one colour rather than all of them calls this, so the strip
 *  above the cross-section, the chip in the sticky bar and the print itself
 *  cannot quietly drift into telling different stories. */
export function developedRgb(source: Rgb, seconds: number): Rgb {
  const devC = dyeArrival(seconds, "cyan") * DENSITY;
  const devM = dyeArrival(seconds, "magenta") * DENSITY;
  const devY = dyeArrival(seconds, "yellow") * DENSITY;
  const [bgR, bgG, bgB] = backgroundAt(seconds);
  return [
    bgR * (1 - (1 - source[0] / 255) * devC),
    bgG * (1 - (1 - source[1] / 255) * devM),
    bgB * (1 - (1 - source[2] / 255) * devY),
  ];
}

function meanOf(image: ImageData): Rgb {
  const d = image.data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  return [r / n, g / n, b / n];
}

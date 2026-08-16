// The four subjects, drawn rather than downloaded. They are the *scene* — what
// was in front of the lens — not the print; the developing happens to them in
// photo.ts. Drawing them in code keeps the page a single build artefact with no
// image requests to 404 on the deployed base path, and it means each subject
// can be aimed at the thing it has to prove.
//
// Each one is chosen so its channels disagree, because a channel is an
// exposure: R is what the red-sensitive layer saw, and a subject whose R, G and
// B are all the same tells the reader nothing about which dye gets stuck. The
// apple sits on a light table for exactly that reason — table and apple are two
// different answers, an arm's length apart, and the slice marker in section 3
// is what walks between them.

export const SUBJECT_SIZE = 300;

type Draw = (ctx: CanvasRenderingContext2D, s: number) => void;

/** A red apple on a light table. The table is near-white — every layer exposed,
 *  so every dye sticks — and the apple is the opposite reading a few pixels
 *  away. */
const drawApple: Draw = (ctx, s) => {
  const table = ctx.createLinearGradient(0, 0, 0, s);
  table.addColorStop(0, "#f2efe8");
  table.addColorStop(1, "#dbd6cc");
  ctx.fillStyle = table;
  ctx.fillRect(0, 0, s, s);

  ctx.fillStyle = "rgb(96 84 70 / 22%)";
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.79, s * 0.31, s * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lit from the upper left, so the radial gradient's bright point is off
  // centre. A centred one reads as a ball, not as fruit under a lamp.
  const body = ctx.createRadialGradient(s * 0.39, s * 0.34, s * 0.03, s * 0.5, s * 0.5, s * 0.38);
  body.addColorStop(0, "#f4644b");
  body.addColorStop(0.55, "#d42a26");
  body.addColorStop(1, "#8b1418");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.31);
  ctx.bezierCurveTo(s * 0.2, s * 0.15, s * 0.09, s * 0.56, s * 0.28, s * 0.73);
  ctx.bezierCurveTo(s * 0.4, s * 0.84, s * 0.6, s * 0.84, s * 0.72, s * 0.73);
  ctx.bezierCurveTo(s * 0.91, s * 0.56, s * 0.8, s * 0.15, s * 0.5, s * 0.31);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#573820";
  ctx.lineWidth = s * 0.022;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.31);
  ctx.quadraticCurveTo(s * 0.55, s * 0.2, s * 0.5, s * 0.13);
  ctx.stroke();

  ctx.fillStyle = "rgb(255 255 255 / 34%)";
  ctx.beginPath();
  ctx.ellipse(s * 0.37, s * 0.4, s * 0.07, s * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
};

/** A green leaf, close. The out-of-focus ground behind it is warm and dark, so
 *  the frame is not one flat green — the marker has somewhere to go. */
const drawLeaf: Draw = (ctx, s) => {
  const ground = ctx.createLinearGradient(0, 0, s, s);
  ground.addColorStop(0, "#4a4426");
  ground.addColorStop(1, "#23301c");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, s, s);

  const blade = ctx.createLinearGradient(s * 0.2, s * 0.15, s * 0.8, s * 0.85);
  blade.addColorStop(0, "#9ad84a");
  blade.addColorStop(0.5, "#5fae2f");
  blade.addColorStop(1, "#2f7a24");
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(s * 0.14, s * 0.86);
  ctx.quadraticCurveTo(s * 0.1, s * 0.24, s * 0.72, s * 0.1);
  ctx.quadraticCurveTo(s * 0.94, s * 0.62, s * 0.14, s * 0.86);
  ctx.closePath();
  ctx.fill();

  // Midrib, then ribs off it. Veins are what make a green shape a leaf.
  ctx.strokeStyle = "rgb(226 245 190 / 55%)";
  ctx.lineWidth = s * 0.016;
  ctx.beginPath();
  ctx.moveTo(s * 0.16, s * 0.84);
  ctx.quadraticCurveTo(s * 0.42, s * 0.46, s * 0.71, s * 0.12);
  ctx.stroke();

  ctx.lineWidth = s * 0.007;
  ctx.strokeStyle = "rgb(226 245 190 / 34%)";
  for (let i = 1; i <= 6; i++) {
    const p = i / 7;
    const x = s * (0.16 + (0.71 - 0.16) * p);
    const y = s * (0.84 + (0.12 - 0.84) * p);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.02, x + s * 0.17, y + s * 0.09);
    ctx.stroke();
  }
};

/** Blue sky with one cloud. Sky and cloud are the two readings: the sky exposes
 *  the blue-sensitive layer hard and the other two barely, the cloud exposes
 *  everything. */
const drawSky: Draw = (ctx, s) => {
  const sky = ctx.createLinearGradient(0, 0, 0, s);
  sky.addColorStop(0, "#1f6fc4");
  sky.addColorStop(1, "#a6d4f2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, s, s);

  // A cloud is a pile of ellipses with a flat base. Drawn in two passes so the
  // underside is grey and the top is white, which is the whole silhouette.
  const puff = (cx: number, cy: number, rx: number, ry: number, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const lumps: [number, number, number, number][] = [
    [0.34, 0.58, 0.15, 0.1],
    [0.48, 0.5, 0.19, 0.13],
    [0.64, 0.57, 0.14, 0.095],
    [0.5, 0.62, 0.24, 0.08],
  ];
  for (const [x, y, rx, ry] of lumps) puff(s * x, s * (y + 0.02), s * rx, s * ry, "#c9d8e4");
  for (const [x, y, rx, ry] of lumps) puff(s * x, s * y, s * rx, s * ry, "#fdfdfd");
};

/** A white sheet of paper. Every layer exposed everywhere, which is the case
 *  that proves the rule — so the only thing to draw is enough shading to make
 *  it read as an object rather than as a blank canvas element. */
const drawPaper: Draw = (ctx, s) => {
  const desk = ctx.createLinearGradient(0, 0, 0, s);
  desk.addColorStop(0, "#d8d4cc");
  desk.addColorStop(1, "#bdb8ae");
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, s, s);

  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.rotate(-0.035);
  ctx.fillStyle = "rgb(60 55 48 / 22%)";
  ctx.fillRect(-s * 0.35 + s * 0.012, -s * 0.4 + s * 0.016, s * 0.7, s * 0.8);

  const sheet = ctx.createLinearGradient(-s * 0.35, -s * 0.4, s * 0.35, s * 0.4);
  sheet.addColorStop(0, "#ffffff");
  sheet.addColorStop(0.6, "#f4f2ec");
  sheet.addColorStop(1, "#e2ded4");
  ctx.fillStyle = sheet;
  ctx.fillRect(-s * 0.35, -s * 0.4, s * 0.7, s * 0.8);

  // One soft crease, so the sheet has a surface.
  const crease = ctx.createLinearGradient(-s * 0.1, 0, s * 0.08, 0);
  crease.addColorStop(0, "rgb(0 0 0 / 0%)");
  crease.addColorStop(0.5, "rgb(120 115 105 / 12%)");
  crease.addColorStop(1, "rgb(0 0 0 / 0%)");
  ctx.fillStyle = crease;
  ctx.fillRect(-s * 0.1, -s * 0.4, s * 0.18, s * 0.8);
  ctx.restore();
};

const DRAW: Record<string, Draw> = {
  red: drawApple,
  green: drawLeaf,
  blue: drawSky,
  white: drawPaper,
};

// Drawing is a few hundred canvas ops; doing it on every slider frame would be
// the one expensive thing in a loop that is otherwise pure arithmetic. So each
// subject is rasterised once and kept as pixels.
const cache = new Map<string, ImageData>();

export function subjectImage(id: string): ImageData {
  const hit = cache.get(id);
  if (hit) return hit;

  const s = SUBJECT_SIZE;
  const scratch = document.createElement("canvas");
  scratch.width = s;
  scratch.height = s;
  const ctx = scratch.getContext("2d");
  if (!ctx) throw new Error("no 2d context to draw the subject on");

  (DRAW[id] ?? drawApple)(ctx, s);
  const data = ctx.getImageData(0, 0, s, s);
  cache.set(id, data);
  return data;
}

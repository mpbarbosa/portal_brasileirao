/**
 * HCT — the colour space Material Design 3 generates its palettes in.
 *
 * MD3 does not pick tones out of a hand-made ramp; it fixes a hue and a chroma
 * and walks *tone*, where tone is CIE L*. That is what makes "tone 40 on tone
 * 90" hit a contrast ratio by construction rather than by inspection, and it is
 * the whole reason to adopt the system rather than eyeball a new set of hexes.
 *
 * HCT = CAM16 hue and chroma, with L* substituted for CAM16's own lightness.
 * The forward transform is analytic. The inverse is not, because a requested
 * (hue, chroma, tone) may name a colour sRGB cannot show — so we solve for
 * lightness and then reduce chroma until the result is inside the gamut, which
 * is why the vivid tones flatten out at the ends of a ramp.
 *
 * Implemented here rather than pulled from `@material/material-color-utilities`
 * deliberately: this runs on a workstation to emit hexes that are committed, so
 * a dependency would buy nothing at runtime and cost a package in the tree.
 * `docs/roadmap.md` records "no new runtime dependency" as a constraint.
 */

// ---------------------------------------------------------------- sRGB / XYZ

const SRGB_TO_XYZ = [
  [0.41233895, 0.35762064, 0.18051042],
  [0.2126, 0.7152, 0.0722],
  [0.01932141, 0.11916382, 0.95034478],
] as const;

const XYZ_TO_SRGB = [
  [3.2413774792388685, -1.5376652402851851, -0.49885366846268053],
  [-0.9691452513005321, 1.8758853451067872, 0.04156585616912061],
  [0.05562093689691305, -0.20395524564742123, 1.0571799111220335],
] as const;

/** D65, the white point MD3's viewing conditions assume. */
const WHITE_POINT = [95.047, 100.0, 108.883] as const;

const linearised = (channel: number): number => {
  const c = channel / 255;
  return (c <= 0.040449936 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)) * 100;
};

const delinearised = (channel: number): number => {
  const c = channel / 100;
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

/** True when a linear-RGB triple lies inside sRGB, with room for solver noise. */
const inGamut = (rgb: readonly number[]): boolean =>
  rgb.every((c) => c >= -0.35 && c <= 100.35);

// ------------------------------------------------------------------- L* / Y

const labF = (t: number): number =>
  t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;

const labInvF = (ft: number): number => {
  const ft3 = ft * ft * ft;
  return ft3 > 216 / 24389 ? ft3 : (116 * ft - 16) / (24389 / 27);
};

export const yFromTone = (tone: number): number => 100 * labInvF((tone + 16) / 116);

export const toneFromY = (y: number): number => 116 * labF(y / 100) - 16;

// -------------------------------------------------- CAM16 viewing conditions

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const makeViewingConditions = () => {
  // MD3's defaults: mid-grey background, average surround, no discounting.
  const adaptingLuminance = (200 / Math.PI) * (yFromTone(50) / 100);
  const backgroundTone = 50;
  const surround = 2;

  const [xw, yw, zw] = WHITE_POINT;
  const rW = xw * 0.401288 + yw * 0.650173 + zw * -0.051461;
  const gW = xw * -0.250268 + yw * 1.204414 + zw * 0.045854;
  const bW = xw * -0.002079 + yw * 0.048952 + zw * 0.953127;

  const f = 0.8 + surround / 10;
  const c =
    f >= 0.9 ? lerp(0.59, 0.69, (f - 0.9) * 10) : lerp(0.525, 0.59, (f - 0.8) * 10);
  const d = Math.max(
    0,
    Math.min(1, f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92))),
  );
  const nc = f;

  const rgbD = [
    d * (100 / rW) + 1 - d,
    d * (100 / gW) + 1 - d,
    d * (100 / bW) + 1 - d,
  ];

  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k * k * k * k;
  const k4F = 1 - k4;
  const fl =
    k4 * adaptingLuminance + 0.1 * k4F * k4F * Math.cbrt(5 * adaptingLuminance);

  const n = yFromTone(backgroundTone) / WHITE_POINT[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const ncb = nbb;

  const rgbAFactors = [rW, gW, bW].map((channel, i) =>
    Math.pow((fl * rgbD[i] * channel) / 100, 0.42),
  );
  const rgbA = rgbAFactors.map((factor) => (400 * factor) / (factor + 27.13));
  const aw = ((40 * rgbA[0] + 20 * rgbA[1] + rgbA[2]) / 20) * nbb;

  return { n, aw, nbb, ncb, c, nc, rgbD, fl, z };
};

const VC = makeViewingConditions();

// ------------------------------------------------------------ CAM16 forward

const cam16FromXyz = (x: number, y: number, z: number) => {
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;

  const [rA, gA, bA] = [rC, gC, bC].map((channel, i) => {
    const d = VC.rgbD[i] * channel;
    const af = Math.pow((VC.fl * Math.abs(d)) / 100, 0.42);
    return (Math.sign(d) * 400 * af) / (af + 27.13);
  });

  const a = (11 * rA - 12 * gA + bA) / 11;
  const b = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;

  const hueDegrees = (Math.atan2(b, a) * 180) / Math.PI;
  const hue = ((hueDegrees % 360) + 360) % 360;

  const ac = p2 * VC.nbb;
  const j = 100 * Math.pow(ac / VC.aw, VC.c * VC.z);

  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180 + 2) + 3.8);
  const p1 = ((50000 / 13) * eHue * VC.nc * VC.ncb) / (u + 0.305);
  const t = p1 * Math.hypot(a, b);
  const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73);
  const chroma = alpha * Math.sqrt(j / 100);

  return { hue, chroma, j };
};

// ------------------------------------------------------------ CAM16 inverse

/** (J, C, h) back to linear RGB. May land outside sRGB — callers check. */
const linearRgbFromJch = (
  j: number,
  chroma: number,
  hueRadians: number,
): number[] => {
  const alpha = chroma / Math.sqrt(j / 100);
  const t = Math.pow(alpha / Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73), 1 / 0.9);
  const eHue = 0.25 * (Math.cos(hueRadians + 2) + 3.8);
  const ac = VC.aw * Math.pow(j / 100, 1 / (VC.c * VC.z));
  const p1 = eHue * (50000 / 13) * VC.nc * VC.ncb;
  const p2 = ac / VC.nbb;

  const hSin = Math.sin(hueRadians);
  const hCos = Math.cos(hueRadians);
  const gamma = (23 * (p2 + 0.305) * t) / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
  const a = gamma * hCos;
  const b = gamma * hSin;

  const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
  const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
  const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;

  const [rC, gC, bC] = [rA, gA, bA].map((channel, i) => {
    const base = Math.max(
      0,
      (27.13 * Math.abs(channel)) / (400 - Math.abs(channel)),
    );
    return (
      (Math.sign(channel) * (100 / VC.fl) * Math.pow(base, 1 / 0.42)) / VC.rgbD[i]
    );
  });

  const x = 1.86206786 * rC - 1.01125463 * gC + 0.14918677 * bC;
  const y = 0.38752654 * rC + 0.62144744 * gC - 0.00897398 * bC;
  const z = -0.0158415 * rC - 0.03412294 * gC + 1.04996444 * bC;

  return XYZ_TO_SRGB.map((row) => row[0] * x + row[1] * y + row[2] * z);
};

// ------------------------------------------------------------------ HCT API

export interface Hct {
  hue: number;
  chroma: number;
  tone: number;
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");

export const hctFromHex = (hex: string): Hct => {
  const [r, g, b] = hexToRgb(hex).map(linearised);
  const [x, y, z] = SRGB_TO_XYZ.map((row) => row[0] * r + row[1] * g + row[2] * b);
  const cam = cam16FromXyz(x, y, z);
  return { hue: cam.hue, chroma: cam.chroma, tone: toneFromY(y) };
};

/**
 * Solve (hue, chroma, tone) to the nearest sRGB colour.
 *
 * Two nested searches. The inner one bisects CAM16 lightness until the result's
 * L* equals the requested tone — J and L* are both monotonic in luminance but
 * are not the same quantity, so this cannot be computed directly. The outer one
 * bisects chroma downward when the answer falls outside sRGB, which is what
 * caps saturation near tone 0 and tone 100.
 */
export const hexFromHct = (hue: number, chroma: number, tone: number): string => {
  if (tone <= 0) return "#000000";
  if (tone >= 100) return "#ffffff";

  const hueRadians = (((((hue % 360) + 360) % 360) * Math.PI) / 180);
  const targetY = yFromTone(tone);

  // A neutral of luminance Y is linear RGB (Y, Y, Y): the sRGB luminance
  // coefficients sum to 1, so the grey axis is always in gamut at every tone.
  const greyAxis = (): number[] => [targetY, targetY, targetY];

  const solveAtChroma = (c: number): number[] | null => {
    if (c < 0.05) return greyAxis();
    let low = 0;
    let high = 100;
    let rgb: number[] | null = null;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const candidate = linearRgbFromJch(mid, c, hueRadians);
      if (!candidate.every(Number.isFinite)) return null;
      const y =
        SRGB_TO_XYZ[1][0] * candidate[0] +
        SRGB_TO_XYZ[1][1] * candidate[1] +
        SRGB_TO_XYZ[1][2] * candidate[2];
      rgb = candidate;
      if (Math.abs(y - targetY) < 1e-9) break;
      if (y < targetY) low = mid;
      else high = mid;
    }
    return rgb && inGamut(rgb) ? rgb : null;
  };

  let best = solveAtChroma(chroma);
  if (!best) {
    // Requested chroma is outside sRGB at this tone; take the most we can show.
    let low = 0;
    let high = chroma;
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      const candidate = solveAtChroma(mid);
      if (candidate) {
        best = candidate;
        low = mid;
      } else {
        high = mid;
      }
    }
  }
  const rgb = best ?? greyAxis();
  const [r, g, b] = rgb.map(delinearised);
  return rgbToHex(r, g, b);
};

/** An MD3 tonal palette: one hue and chroma, sampled at whatever tones we ask for. */
export const tonalPalette =
  (hue: number, chroma: number) =>
  (tone: number): string =>
    hexFromHct(hue, chroma, tone);

// ------------------------------------------------------------------ contrast

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.1 contrast ratio, the measure `docs/roadmap.md` requires us to keep. */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

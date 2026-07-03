export const LBS_TO_KG = 0.453592;
export const KG_TO_LBS = 2.20462;
export const MI_TO_M = 1609.344;
export const KM_TO_M = 1000;

export function kgToLbs(kg: number) { return kg * KG_TO_LBS; }
export function lbsToKg(lbs: number) { return lbs * LBS_TO_KG; }
export function mToMi(m: number) { return m / MI_TO_M; }
export function mToKm(m: number) { return m / KM_TO_M; }

export function formatWeight(kg: number, unit: "lbs" | "kg") {
  const v = unit === "lbs" ? kgToLbs(kg) : kg;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} ${unit}`;
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

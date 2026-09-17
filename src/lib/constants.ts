// Looja is the primary/owner account. This ID is the fallback default for the
// account switcher and owns the shared AI API key and the Pebble watch data.
export const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? "311ebe23-03c6-4391-ac22-4822858aeb7c";

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const DAILY_CALORIE_TARGET = 1800;
export const DAILY_PROTEIN_TARGET_G = 120;
// Protein target band shown on the Nutrition chart (Analytics) instead of a single line
export const PROTEIN_BAND_MIN_G = 110;
export const PROTEIN_BAND_MAX_G = 140;

// Fallback bodyweight (lbs) used to load reps-based bodyweight movements in the
// Analytics volume chart when no health metric has been logged yet.
export const REFERENCE_BODYWEIGHT_LBS = 160;

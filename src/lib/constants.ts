export const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? "311ebe23-03c6-4391-ac22-4822858aeb7c";

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;

export type MealType = (typeof MEAL_TYPES)[number];

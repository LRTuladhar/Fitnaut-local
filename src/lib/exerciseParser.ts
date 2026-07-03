export interface ExerciseDefinition {
  id: string;
  name: string;
  alternate_names: string[];
  type: string;
  muscle_groups: string[];
  category: string;
  expected_parameters: string[];
}

export interface ParsedExercise {
  definition: ExerciseDefinition;
  reps?: number;
  weight_lbs?: number;
  distance_m?: number;
  duration_s?: number;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

function fuzzyMatchScore(def: ExerciseDefinition, text: string): number {
  const t = text.toLowerCase();
  const name = def.name.toLowerCase();

  if (name === t) return 1.0;
  for (const alt of def.alternate_names) {
    if (alt.toLowerCase() === t) return 1.0;
  }

  if (name.includes(t)) return 0.8;
  for (const alt of def.alternate_names) {
    if (alt.toLowerCase().includes(t)) return 0.8;
  }

  const textWords = t.split(" ");
  const nameWords = name.split(" ");
  const matching = textWords.filter((tw) =>
    nameWords.some((nw) => nw.startsWith(tw) || tw.startsWith(nw))
  );
  if (matching.length > 0) {
    return matching.length / Math.max(textWords.length, nameWords.length);
  }

  return 0.0;
}

function findExercise(text: string, definitions: ExerciseDefinition[]): ExerciseDefinition | null {
  const THRESHOLD = 0.7;
  let bestDef: ExerciseDefinition | null = null;
  let bestScore = 0;

  const tryMatch = (candidate: string) => {
    for (const def of definitions) {
      const score = fuzzyMatchScore(def, candidate);
      if (score > THRESHOLD && score > bestScore) {
        bestDef = def;
        bestScore = score;
      }
    }
  };

  tryMatch(text);

  if (!bestDef) {
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      tryMatch(words[i]);
      if (i < words.length - 1) tryMatch(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) tryMatch(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  return bestDef;
}

function extractReps(text: string): number | undefined {
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (text.includes(word) && (text.includes("rep") || text.includes("time"))) {
      return value;
    }
  }
  const patterns = [
    /(\d+)\s*(?:reps?|repetitions?|times?)/i,
    /(?:reps?|repetitions?)\s*(?:of\s*)?(\d+)/i,
    /^(\d+)\s+(?:of\s+)?\w+/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return undefined;
}

function extractWeight(text: string): number | undefined {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?)/i,
    /(?:with|at|using)\s+(\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return parseFloat(m[1]);
  }
  return undefined;
}

function extractDistance(text: string): number | undefined {
  const patterns: [RegExp, number][] = [
    [/(\d+(?:\.\d+)?)\s*(?:meters?|m\b)/i, 1],
    [/(\d+(?:\.\d+)?)\s*(?:kilometers?|km|k\b)/i, 1000],
    [/(\d+(?:\.\d+)?)\s*(?:miles?|mi)/i, 1609.344],
  ];
  for (const [pattern, multiplier] of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return parseFloat(m[1]) * multiplier;
  }
  return undefined;
}

function extractDuration(text: string): number | undefined {
  let total = 0;
  const hours = text.match(/(\d+)\s*(?:hours?|hrs?|h\b)/i);
  if (hours?.[1]) total += parseInt(hours[1], 10) * 3600;
  const mins = text.match(/(\d+)\s*(?:minutes?|mins?|m\b)/i);
  if (mins?.[1]) total += parseInt(mins[1], 10) * 60;
  const secs = text.match(/(\d+)\s*(?:seconds?|secs?|s\b)/i);
  if (secs?.[1]) total += parseInt(secs[1], 10);
  return total > 0 ? total : undefined;
}

export function parseExercise(
  text: string,
  definitions: ExerciseDefinition[]
): ParsedExercise | null {
  const normalized = text.toLowerCase().trim();
  const definition = findExercise(normalized, definitions);
  if (!definition) return null;

  const result: ParsedExercise = { definition };
  if (definition.expected_parameters.includes("reps")) result.reps = extractReps(normalized);
  if (definition.expected_parameters.includes("weight")) result.weight_lbs = extractWeight(normalized);
  if (definition.expected_parameters.includes("distance")) result.distance_m = extractDistance(normalized);
  if (definition.expected_parameters.includes("duration")) result.duration_s = extractDuration(normalized);

  return result;
}

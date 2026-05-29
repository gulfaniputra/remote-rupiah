export type FieldMatch = {
  source: string;
  target: string | null;
  confidence: number;
  method: "exact" | "normalized" | "fuzzy" | "none";
};

export type Suggestion = FieldMatch;

/**
 * Normalizes a field name according to the spec:
 * - lowercase
 * - trim
 * - replace: _, -, " " -> single _
 * - collapse multiple _ -> single _
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, "_");
}

/**
 * Jaro-Winkler distance implementation.
 * Returns a score between 0 and 1.
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let m = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        m++;
        break;
      }
    }
  }

  if (m === 0) return 0.0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (s1[i] !== s2[k]) t++;
      k++;
    }
  }
  t /= 2;

  const jaro = (m / len1 + m / len2 + (m - t) / m) / 3;

  // Winkler adjustment
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

const THRESHOLD = 0.85;
const AMBIGUITY_THRESHOLD = 0.1;

export function match(source: string, targets: string[]): FieldMatch {
  if (!source || targets.length === 0) {
    return { source, target: null, confidence: 0, method: "none" };
  }

  if (targets.includes(source)) {
    return { source, target: source, confidence: 1.0, method: "exact" };
  }

  const normMatch = targets.find((t) => normalize(t) === normalize(source));
  if (normMatch) {
    return { source, target: normMatch, confidence: 1.0, method: "normalized" };
  }

  const scores = targets
    .map((target) => ({
      target,
      score: Number(
        jaroWinkler(normalize(source), normalize(target)).toFixed(4),
      ),
    }))
    .sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));

  const best = scores[0];
  const second = scores[1];

  return !best || best.score < THRESHOLD ||
      (second && best.score - second.score < AMBIGUITY_THRESHOLD)
    ? { source, target: null, confidence: 0, method: "none" }
    : { source, target: best.target, confidence: best.score, method: "fuzzy" };
}

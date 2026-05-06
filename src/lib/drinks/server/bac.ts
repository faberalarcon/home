// BAC estimation using the Widmark formula.
// All values use SI units: kg for weight, mL for volume, % for BAC.
// This is an estimate — alcohol absorption varies by individual.

export interface DrinkEntry {
  abv: number | null;       // alcohol by volume, e.g. 5.0 for 5%
  volumeMl: number | null;  // serving size in mL
  orderedAtSec: number;     // unix timestamp (seconds) when the drink was ordered
}

export interface BACResult {
  bac: number;        // current estimated BAC as a fraction (0.08 = 0.08%)
  hasData: boolean;   // false when profile body data or drink data is missing
}

const ETHANOL_DENSITY = 0.789;  // g/mL
const ELIMINATION_RATE = 0.013; // % per hour (lower-bound Widmark, gives higher readings)
const R_MALE = 0.58;            // Widmark r factor for males (lower bound)
const R_FEMALE = 0.49;          // Widmark r factor for females (lower bound)

export function estimateBAC(
  drinks: DrinkEntry[],
  weightKg: number | null,
  biologicalSex: string | null,
  nowSec: number = Math.floor(Date.now() / 1000)
): BACResult {
  if (!weightKg || !biologicalSex) return { bac: 0, hasData: false };

  const r = biologicalSex === 'female' ? R_FEMALE : R_MALE;

  // Only consider drinks that have both ABV and volume configured
  const actionable = drinks.filter((d) => d.abv !== null && d.volumeMl !== null);
  if (actionable.length === 0) return { bac: 0, hasData: false };

  let totalBac = 0;
  for (const d of actionable) {
    const gramsAlcohol = d.volumeMl! * (d.abv! / 100) * ETHANOL_DENSITY;
    const bacContribution = (gramsAlcohol / (weightKg * 1000 * r)) * 100;
    const hoursElapsed = (nowSec - d.orderedAtSec) / 3600;
    const bacRemaining = Math.max(0, bacContribution - ELIMINATION_RATE * hoursElapsed);
    totalBac += bacRemaining;
  }

  return { bac: Math.max(0, totalBac), hasData: true };
}

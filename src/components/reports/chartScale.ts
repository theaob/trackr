/**
 * A "nice" axis step for a range, snapped to 1/2/5/10 x a power of ten, sized
 * so roughly `targetTicks` gridlines cover the range -- the standard trick for
 * ticks that land on round numbers (0/10/20/30) instead of awkward fractions
 * of an arbitrary max (13/25/38/50).
 */
function niceStep(range: number, targetTicks: number): number {
  const roughStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

/** The axis step and the ticks (0..max, inclusive) for a value range, both landing on round numbers. */
export function niceAxis(maxValue: number, targetTicks = 4): { step: number; ticks: number[]; axisMax: number } {
  if (maxValue <= 0) {
    return { step: 5, ticks: [0, 5, 10], axisMax: 10 };
  }
  const step = niceStep(maxValue, targetTicks);
  const axisMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax + 1e-9; t += step) ticks.push(Math.round(t));
  return { step, ticks, axisMax };
}

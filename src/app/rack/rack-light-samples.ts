export interface AreaLightSample {
  x: number;
  y: number;
  weight: number;
}

/**
 * Deterministic quadrature of a Gaussian emitter. Spread is the standard
 * deviation of its offsets, rather than the radius of a uniformly lit disc.
 */
export function createAreaLightSamples(
  count: number,
  spread: Readonly<{ x: number; y: number }>,
): AreaLightSample[] {
  if (!Number.isSafeInteger(count) || count < 4) {
    throw new RangeError('Area lights require an integer sample count of at least four.');
  }
  if (![spread.x, spread.y].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Area-light spread must be finite and nonnegative.');
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const samples = Array.from({ length: count }, (_, index) => {
    const radius = Math.sqrt(-2 * Math.log(1 - (index + 0.5) / count));
    const angle = index * goldenAngle;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), weight: 1 / count };
  });

  const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / count;
  const meanY = samples.reduce((sum, sample) => sum + sample.y, 0) / count;
  for (const sample of samples) {
    sample.x -= meanX;
    sample.y -= meanY;
  }

  // A small finite sample set must not shift or tilt the resulting shadow.
  // Gram-Schmidt removes the incidental correlation of the Vogel pattern.
  const squareX = samples.reduce((sum, sample) => sum + sample.x ** 2, 0);
  const correlation = samples.reduce((sum, sample) => sum + sample.x * sample.y, 0) / squareX;
  for (const sample of samples) sample.y -= correlation * sample.x;
  const sigmaX = Math.sqrt(squareX / count);
  const sigmaY = Math.sqrt(samples.reduce((sum, sample) => sum + sample.y ** 2, 0) / count);

  for (const sample of samples) {
    sample.x = (sample.x / sigmaX) * spread.x;
    sample.y = (sample.y / sigmaY) * spread.y;
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)) {
      throw new RangeError('Area-light spread exceeds the supported numeric range.');
    }
  }
  return samples;
}

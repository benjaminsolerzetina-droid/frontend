import { createAreaLightSamples } from './rack-light-samples';

describe('createAreaLightSamples', () => {
  it('conserva la energia y la direccion central con dispersion configurable por eje', () => {
    for (const count of [4, 12, 32]) {
      for (const spread of [
        { x: 0.3, y: 0.7 },
        { x: 1, y: 1 },
        { x: 0, y: 0.4 },
      ]) {
        const samples = createAreaLightSamples(count, spread);
        expect(samples).toHaveLength(count);
        expect(samples.reduce((sum, sample) => sum + sample.weight, 0)).toBeCloseTo(1, 12);
        expect(samples.reduce((sum, sample) => sum + sample.weight * sample.x, 0)).toBeCloseTo(
          0,
          12,
        );
        expect(samples.reduce((sum, sample) => sum + sample.weight * sample.y, 0)).toBeCloseTo(
          0,
          12,
        );
        expect(samples.reduce((sum, sample) => sum + sample.weight * sample.x ** 2, 0)).toBeCloseTo(
          spread.x ** 2,
          12,
        );
        expect(samples.reduce((sum, sample) => sum + sample.weight * sample.y ** 2, 0)).toBeCloseTo(
          spread.y ** 2,
          12,
        );
        expect(
          samples.reduce((sum, sample) => sum + sample.weight * sample.x * sample.y, 0),
        ).toBeCloseTo(0, 12);
        for (const sample of samples) {
          expect(Number.isFinite(sample.x) && Number.isFinite(sample.y)).toBe(true);
          expect(sample.weight).toBeGreaterThan(0);
        }
      }
    }
  });

  it('reproduce la misma luz sin modificar la configuracion ni compartir resultados', () => {
    const spread = Object.freeze({ x: 0.4, y: 0.65 });
    const first = createAreaLightSamples(12, spread);
    const second = createAreaLightSamples(12, spread);
    expect(second).toEqual(first);
    first[0].x = 100;
    expect(second[0].x).not.toBe(100);
    expect(spread).toEqual({ x: 0.4, y: 0.65 });
  });

  it('admite una fuente puntual cuando ambos ejes tienen dispersion cero', () => {
    const samples = createAreaLightSamples(12, { x: 0, y: 0 });
    expect(samples.every((sample) => sample.x === 0 && sample.y === 0)).toBe(true);
  });

  it('rechaza muestras insuficientes y parametros no representables', () => {
    for (const count of [-1, 0, 3, 4.5, NaN, Infinity]) {
      expect(() => createAreaLightSamples(count, { x: 0.3, y: 0.7 })).toThrow(RangeError);
    }
    for (const invalid of [-1, NaN, Infinity]) {
      expect(() => createAreaLightSamples(12, { x: invalid, y: 0.7 })).toThrow(RangeError);
      expect(() => createAreaLightSamples(12, { x: 0.3, y: invalid })).toThrow(RangeError);
    }
    expect(() => createAreaLightSamples(12, { x: Number.MAX_VALUE, y: 1 })).toThrow(RangeError);
  });
});

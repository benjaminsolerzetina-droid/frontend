import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';

import { fitOrthographicBounds, fitPerspectiveBounds } from './rack-camera';

function boxCorners(min: Vector3, max: Vector3): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) corners.push(new Vector3(x, y, z));
    }
  }
  return corners;
}

describe('fitOrthographicBounds', () => {
  it('mantiene dentro del frustum las esquinas de modelos de distinto tamano y todas las vistas', () => {
    const models = [
      boxCorners(new Vector3(-7.14, -4.94, -0.12), new Vector3(7.14, 4.94, 0.42)),
      boxCorners(new Vector3(120, -52, 16), new Vector3(160, -12, 38)),
      boxCorners(new Vector3(-0.008, 0.001, -0.0002), new Vector3(0.003, 0.017, 0.0005)),
    ];
    const views = [
      { dir: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0) },
      { dir: new Vector3(-0.46, -0.5, 0.73), up: new Vector3(0, 0, 1) },
      { dir: new Vector3(0.93, -0.17, 0.34), up: new Vector3(0, 0, 1) },
      { dir: new Vector3(0, -0.94, 0.34), up: new Vector3(0, 0, 1) },
    ];
    const fill = 0.94;

    for (const corners of models) {
      for (const { dir, up } of views) {
        for (const aspect of [0.35, 0.75, 1, 16 / 9, 3.5]) {
          const fit = fitOrthographicBounds(corners, dir, up, aspect, fill);
          const camera = new OrthographicCamera(
            -fit.halfWidth,
            fit.halfWidth,
            fit.halfHeight,
            -fit.halfHeight,
            fit.near,
            fit.far,
          );
          camera.position.copy(fit.target).addScaledVector(dir.clone().normalize(), fit.distance);
          camera.up.copy(up);
          camera.lookAt(fit.target);
          camera.updateMatrixWorld(true);
          const projected = corners.map((corner) => corner.clone().project(camera));

          expect(fit.near).toBeGreaterThan(0);
          expect(fit.far).toBeGreaterThan(fit.near);
          expect(fit.halfWidth / fit.halfHeight).toBeCloseTo(aspect, 10);
          for (const corner of projected) {
            expect(Math.abs(corner.x)).toBeLessThanOrEqual(fill + 1e-9);
            expect(Math.abs(corner.y)).toBeLessThanOrEqual(fill + 1e-9);
            expect(Math.abs(corner.z)).toBeLessThan(1);
          }
          // Al menos un eje ocupa exactamente la fraccion pedida: no hay margen sobrante.
          const occupied = Math.max(
            ...projected.flatMap((corner) => [Math.abs(corner.x), Math.abs(corner.y)]),
          );
          expect(occupied).toBeCloseTo(fill, 9);
        }
      }
    }
  });

  it('centra la vista superior en la placa aunque el relieve sobresalga solo hacia delante', () => {
    const corners = boxCorners(new Vector3(-7, -5, -0.12), new Vector3(7, 5, 0.65));
    const fit = fitOrthographicBounds(
      corners,
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 0),
      1.6,
      0.97,
    );

    expect(fit.target.x).toBeCloseTo(0, 12);
    expect(fit.target.y).toBeCloseTo(0, 12);
    expect(fit.target.z).toBeCloseTo(0.265, 12);
  });

  it('centra los extremos proyectados de una silueta asimetrica sin cambiar sus entradas', () => {
    const corners = [new Vector3(-4, -2, 0), new Vector3(6, 1, 0.5), new Vector3(-1, 4, 2)];
    const original = corners.map((corner) => corner.toArray());
    const dir = new Vector3(4, -3, 5);
    const up = new Vector3(0, 0, 2);
    const fit = fitOrthographicBounds(corners, dir, up, 1.4, 0.9);
    const backward = dir.clone().normalize();
    const right = new Vector3().crossVectors(up, backward).normalize();
    const cameraUp = new Vector3().crossVectors(backward, right).normalize();

    for (const axis of [right, cameraUp, backward]) {
      const positions = corners.map((corner) => corner.clone().sub(fit.target).dot(axis));
      expect(Math.min(...positions) + Math.max(...positions)).toBeCloseTo(0, 10);
    }
    expect(corners.map((corner) => corner.toArray())).toEqual(original);
    expect(dir.toArray()).toEqual([4, -3, 5]);
    expect(up.toArray()).toEqual([0, 0, 2]);
  });

  it('evita un frustum singular si los limites se reducen a un punto', () => {
    const point = new Vector3(12, 4, -3);
    const fit = fitOrthographicBounds([point], new Vector3(0, 0, 1), new Vector3(0, 1, 0), 0.5, 1);
    expect(fit.target.toArray()).toEqual(point.toArray());
    expect(fit.halfWidth).toBeGreaterThan(0);
    expect(fit.halfHeight).toBeGreaterThan(0);
    expect(fit.near).toBeGreaterThan(0);
    expect(fit.far).toBeGreaterThan(fit.near);
  });

  it('rechaza orientaciones y proporciones que no pueden formar una camara', () => {
    const corners = [new Vector3()];
    const dir = new Vector3(0, 0, 1);
    const up = new Vector3(0, 1, 0);
    expect(() => fitOrthographicBounds([], dir, up, 1, 0.9)).toThrow(RangeError);
    expect(() => fitOrthographicBounds(corners, dir, dir, 1, 0.9)).toThrow(RangeError);
    expect(() => fitOrthographicBounds(corners, dir, up, 0, 0.9)).toThrow(RangeError);
    expect(() => fitOrthographicBounds(corners, dir, up, 1, 1.2)).toThrow(RangeError);
  });
});

describe('fitPerspectiveBounds', () => {
  it('encuadra todas las esquinas y aprovecha el margen en distintas vistas y formatos', () => {
    const models = [
      boxCorners(new Vector3(-7.14, -4.94, -0.12), new Vector3(7.14, 4.94, 0.42)),
      boxCorners(new Vector3(120, -52, 16), new Vector3(160, -12, 38)),
      boxCorners(new Vector3(-0.008, 0.001, -0.0002), new Vector3(0.003, 0.017, 0.0005)),
    ];
    const views = [
      { dir: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0) },
      { dir: new Vector3(-0.46, -0.5, 0.73), up: new Vector3(0, 0, 1) },
      { dir: new Vector3(0.93, -0.17, 0.34), up: new Vector3(0, 0, 1) },
      { dir: new Vector3(0, -0.94, 0.34), up: new Vector3(0, 0, 1) },
    ];
    const fill = 0.94;

    for (const corners of models) {
      for (const { dir, up } of views) {
        for (const aspect of [0.35, 0.75, 1, 16 / 9, 3.5]) {
          for (const fov of [12, 18]) {
            const fit = fitPerspectiveBounds(corners, dir, up, aspect, fill, fov);
            const camera = new PerspectiveCamera(fov, aspect, fit.near, fit.far);
            camera.position.copy(fit.target).addScaledVector(dir.clone().normalize(), fit.distance);
            camera.up.copy(up);
            camera.lookAt(fit.target);
            camera.updateMatrixWorld(true);
            const projected = corners.map((corner) => corner.clone().project(camera));

            expect(fit.near).toBeGreaterThan(0);
            expect(fit.far).toBeGreaterThan(fit.near);
            for (const corner of projected) {
              expect(Math.abs(corner.x)).toBeLessThanOrEqual(fill + 1e-9);
              expect(Math.abs(corner.y)).toBeLessThanOrEqual(fill + 1e-9);
              expect(Math.abs(corner.z)).toBeLessThan(1);
            }
            const occupied = Math.max(
              ...projected.flatMap((corner) => [Math.abs(corner.x), Math.abs(corner.y)]),
            );
            expect(occupied).toBeCloseTo(fill, 9);
          }
        }
      }
    }
  });

  it('mantiene el objetivo en el centro del modelo sin modificar sus entradas', () => {
    const corners = [new Vector3(-4, -2, 0), new Vector3(6, 1, 0.5), new Vector3(-1, 4, 2)];
    const original = corners.map((corner) => corner.toArray());
    const dir = new Vector3(4, -3, 5);
    const up = new Vector3(0, 0, 2);
    const fit = fitPerspectiveBounds(corners, dir, up, 1.4, 0.9, 12);

    expect(fit.target.toArray()).toEqual([1, 1, 1]);
    expect(corners.map((corner) => corner.toArray())).toEqual(original);
    expect(dir.toArray()).toEqual([4, -3, 5]);
    expect(up.toArray()).toEqual([0, 0, 2]);
  });

  it('mantiene visible un modelo reducido a un punto', () => {
    const point = new Vector3(12, 4, -3);
    const fit = fitPerspectiveBounds(
      [point],
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 0),
      0.5,
      1,
      18,
    );
    const camera = new PerspectiveCamera(18, 0.5, fit.near, fit.far);
    camera.position.copy(fit.target).add(new Vector3(0, 0, fit.distance));
    camera.lookAt(fit.target);
    camera.updateMatrixWorld(true);
    const projected = point.clone().project(camera);

    expect(fit.target.toArray()).toEqual(point.toArray());
    expect(fit.distance).toBeGreaterThan(0);
    expect(fit.near).toBeGreaterThan(0);
    expect(fit.far).toBeGreaterThan(fit.near);
    expect(projected.x).toBeCloseTo(0);
    expect(projected.y).toBeCloseTo(0);
    expect(Math.abs(projected.z)).toBeLessThan(1);
  });

  it('rechaza limites, orientaciones, proporciones y angulos no validos', () => {
    const corners = [new Vector3()];
    const dir = new Vector3(0, 0, 1);
    const up = new Vector3(0, 1, 0);
    expect(() => fitPerspectiveBounds([], dir, up, 1, 0.9, 12)).toThrow(RangeError);
    expect(() => fitPerspectiveBounds([new Vector3(NaN, 0, 0)], dir, up, 1, 0.9, 12)).toThrow(
      RangeError,
    );
    expect(() => fitPerspectiveBounds(corners, dir, dir, 1, 0.9, 12)).toThrow(RangeError);
    expect(() => fitPerspectiveBounds(corners, new Vector3(), up, 1, 0.9, 12)).toThrow(RangeError);
    expect(() => fitPerspectiveBounds(corners, dir, new Vector3(), 1, 0.9, 12)).toThrow(RangeError);
    for (const aspect of [0, -1, NaN, Infinity]) {
      expect(() => fitPerspectiveBounds(corners, dir, up, aspect, 0.9, 12)).toThrow(RangeError);
    }
    for (const fill of [0, -1, 1.2, NaN, Infinity]) {
      expect(() => fitPerspectiveBounds(corners, dir, up, 1, fill, 12)).toThrow(RangeError);
    }
    for (const fov of [0, -1, 180, 181, NaN, Infinity]) {
      expect(() => fitPerspectiveBounds(corners, dir, up, 1, 0.9, fov)).toThrow(RangeError);
    }
  });
});

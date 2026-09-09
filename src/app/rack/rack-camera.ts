import { Box3, Vector3 } from 'three';

export interface OrthographicBounds {
  halfWidth: number;
  halfHeight: number;
  /** Centro del encuadre, en las mismas coordenadas que las esquinas. */
  target: Vector3;
  /** La camara se coloca en target + normalize(dir) * distance. */
  distance: number;
  near: number;
  far: number;
}

export interface PerspectiveBounds {
  target: Vector3;
  /** La camara se coloca en target + normalize(dir) * distance. */
  distance: number;
  near: number;
  far: number;
}

/**
 * Encuadra cualquier conjunto de esquinas sin deformarlo ni recortar su relieve.
 * dir apunta desde el objeto hacia la camara; fill es la fraccion util del cuadro.
 * No modifica las esquinas ni los vectores de orientacion recibidos.
 */
export function fitOrthographicBounds(
  corners: readonly Vector3[],
  dir: Vector3,
  up: Vector3,
  aspect: number,
  fill: number,
): OrthographicBounds {
  const finiteVector = (vector: Vector3) =>
    Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);

  if (
    corners.length === 0 ||
    corners.some((corner) => !finiteVector(corner)) ||
    !finiteVector(dir) ||
    !finiteVector(up) ||
    dir.lengthSq() === 0 ||
    up.lengthSq() === 0 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    !Number.isFinite(fill) ||
    fill <= 0 ||
    fill > 1
  ) {
    throw new RangeError(
      'El encuadre necesita limites y orientacion validos, aspect > 0 y 0 < fill <= 1.',
    );
  }

  const backward = dir.clone().normalize();
  const right = new Vector3().crossVectors(up.clone().normalize(), backward);
  if (right.lengthSq() < 1e-12) {
    throw new RangeError('El vector arriba no puede ser paralelo a la direccion de la camara.');
  }
  right.normalize();
  const cameraUp = new Vector3().crossVectors(backward, right).normalize();

  const projectedBounds = new Box3();
  const modelBounds = new Box3();
  const projected = new Vector3();
  for (const corner of corners) {
    projected.set(corner.dot(right), corner.dot(cameraUp), corner.dot(backward));
    projectedBounds.expandByPoint(projected);
    modelBounds.expandByPoint(corner);
  }

  const center = projectedBounds.getCenter(new Vector3());
  const size = projectedBounds.getSize(new Vector3());
  const target = right
    .clone()
    .multiplyScalar(center.x)
    .addScaledVector(cameraUp, center.y)
    .addScaledVector(backward, center.z);

  // El minimo solo evita una matriz singular en el caso degenerado de un punto.
  const diagonal = Math.max(modelBounds.getSize(new Vector3()).length(), 1e-6);
  const halfHeight = Math.max(size.y / 2, size.x / (2 * aspect), diagonal * 1e-6) / fill;
  const halfWidth = halfHeight * aspect;
  const depthPadding = diagonal * 0.05;
  const distance = diagonal + depthPadding;

  return {
    halfWidth,
    halfHeight,
    target,
    distance,
    near: distance - size.z / 2 - depthPadding,
    far: distance + size.z / 2 + depthPadding,
  };
}

/** Encuadra el relieve con perspectiva manteniendo el centro del modelo como objetivo. */
export function fitPerspectiveBounds(
  corners: readonly Vector3[],
  dir: Vector3,
  up: Vector3,
  aspect: number,
  fill: number,
  fovDegrees: number,
): PerspectiveBounds {
  const finiteVector = (vector: Vector3) =>
    Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);

  if (
    corners.length === 0 ||
    corners.some((corner) => !finiteVector(corner)) ||
    !finiteVector(dir) ||
    !finiteVector(up) ||
    dir.lengthSq() === 0 ||
    up.lengthSq() === 0 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    !Number.isFinite(fill) ||
    fill <= 0 ||
    fill > 1 ||
    !Number.isFinite(fovDegrees) ||
    fovDegrees <= 0 ||
    fovDegrees >= 180
  ) {
    throw new RangeError(
      'El encuadre necesita limites y orientacion validos, aspect > 0, 0 < fill <= 1 y 0 < fov < 180.',
    );
  }

  const backward = dir.clone().normalize();
  const right = new Vector3().crossVectors(up.clone().normalize(), backward);
  if (right.lengthSq() < 1e-12) {
    throw new RangeError('El vector arriba no puede ser paralelo a la direccion de la camara.');
  }
  right.normalize();
  const cameraUp = new Vector3().crossVectors(backward, right).normalize();
  const modelBounds = new Box3().setFromPoints([...corners]);
  const target = modelBounds.getCenter(new Vector3());
  const diagonal = Math.max(modelBounds.getSize(new Vector3()).length(), 1e-6);
  const verticalSlope = Math.tan((fovDegrees * Math.PI) / 360) * fill;
  const horizontalSlope = verticalSlope * aspect;
  let distance = 0;
  let minDepth = Infinity;
  let maxDepth = -Infinity;

  for (const corner of corners) {
    const offset = corner.clone().sub(target);
    const depth = offset.dot(backward);
    minDepth = Math.min(minDepth, depth);
    maxDepth = Math.max(maxDepth, depth);
    // Cada esquina ocupa un plano distinto; la mas cercana necesita mas distancia.
    distance = Math.max(
      distance,
      depth + Math.abs(offset.dot(right)) / horizontalSlope,
      depth + Math.abs(offset.dot(cameraUp)) / verticalSlope,
    );
  }

  const depthPadding = diagonal * 0.05;
  distance = Math.max(distance, maxDepth + depthPadding * 2);

  return {
    target,
    distance,
    near: distance - maxDepth - depthPadding,
    far: distance - minDepth + depthPadding,
  };
}

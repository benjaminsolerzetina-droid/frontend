import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/** Anchos de los cantos vistos desde +Z; todas las medidas son unidades de mundo. */
export interface BlockEdgeProfile {
  side: number;
  top: number;
  bottom: number;
  depth: number;
}

/**
 * Caja con cantos elípticos: +Y es el borde superior y -Y el inferior.
 * Los anchos de bisel son independientes de su descenso en Z. Los dos frentes
 * siguen siendo planos y los extremos permanecen exactamente en ±w/h/d / 2.
 * Los perfiles grandes se limitan conservando al menos un 10 % de cara plana.
 */
export function createBlockGeometry(
  w: number,
  h: number,
  d: number,
  profile: BlockEdgeProfile,
): BufferGeometry {
  if ([w, h, d].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Las dimensiones del bloque deben ser positivas y finitas.');
  }
  if (
    [profile.side, profile.top, profile.bottom, profile.depth].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new RangeError('Los cantos del bloque deben ser finitos y no negativos.');
  }

  const side = Math.min(profile.side, w * 0.45);
  // Dividir por el máximo evita desbordar al sumar perfiles muy grandes.
  const yMaximum = Math.max(profile.top, profile.bottom);
  const yRatio = yMaximum === 0 ? 0 : profile.top / yMaximum + profile.bottom / yMaximum;
  const yScale = yMaximum === 0 ? 1 : Math.min(1, (h * 0.9) / yMaximum / yRatio);
  const top = profile.top * yScale;
  const bottom = profile.bottom * yScale;
  const depth = Math.min(profile.depth, d * 0.45);
  if (side === 0 && top === 0 && bottom === 0 && depth === 0) {
    return new BoxGeometry(w, h, d);
  }

  // Un número impar de divisiones deja una región central totalmente plana.
  // Cada octante de esta caja se transforma en un octante de elipsoide,
  // incluyendo sus normales analíticas para evitar costuras de iluminación.
  const segments = 9;
  const source = new BoxGeometry(1, 1, 1, segments, segments, segments);
  const geometry = source.toNonIndexed();
  source.dispose();
  geometry.clearGroups();
  const positions = geometry.getAttribute('position');
  const normals = new Float32Array(positions.count * 3);
  const direction = new Vector3();
  const normal = new Vector3();
  const halfCell = 0.5 / segments;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const edgeY = y > 0 ? top : bottom;
    direction.set(
      x - Math.sign(x) * halfCell,
      y - Math.sign(y) * halfCell,
      z - Math.sign(z) * halfCell,
    );
    // Los vértices de BoxGeometry son float32: elimina solo su redondeo
    // alrededor de cero para que las caras planas no adquieran inclinación.
    if (Math.abs(direction.x) < 1e-7) direction.x = 0;
    if (Math.abs(direction.y) < 1e-7) direction.y = 0;
    if (Math.abs(direction.z) < 1e-7) direction.z = 0;
    direction.normalize();
    positions.setXYZ(
      i,
      Math.sign(x) * (w / 2 - side) + direction.x * side,
      Math.sign(y) * (h / 2 - edgeY) + direction.y * edgeY,
      Math.sign(z) * (d / 2 - depth) + direction.z * depth,
    );

    // Inversa traspuesta del escalado elíptico. Si un radio es cero, su
    // superficie colapsa en una cara recta y la normal sigue el eje de esa cara.
    normal.set(
      side === 0 ? direction.x : 0,
      edgeY === 0 ? direction.y : 0,
      depth === 0 ? direction.z : 0,
    );
    if (normal.lengthSq() === 0) {
      normal.set(
        side === 0 ? 0 : direction.x / side,
        edgeY === 0 ? 0 : direction.y / edgeY,
        depth === 0 ? 0 : direction.z / depth,
      );
    }
    normal.normalize().toArray(normals, i * 3);
  }
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));

  // Un canto de ancho cero puede colapsar triángulos. Se omiten del índice;
  // las caras vecinas conservan sus normales y no dejan superficies duplicadas.
  const indices: number[] = [];
  const a = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    ab.fromBufferAttribute(positions, i + 1).sub(a);
    ac.fromBufferAttribute(positions, i + 2).sub(a);
    if (ab.cross(ac).lengthSq() > 0) indices.push(i, i + 1, i + 2);
  }
  if (indices.length !== positions.count) geometry.setIndex(indices);
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

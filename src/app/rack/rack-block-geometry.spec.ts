import { BufferGeometry, Vector3 } from 'three';

import { BlockEdgeProfile, createBlockGeometry } from './rack-block-geometry';

const profile: BlockEdgeProfile = { side: 0.01, top: 0.013, bottom: 0.035, depth: 0.022 };

function expectSoundSurface(geometry: BufferGeometry) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const count = index?.count ?? positions.count;
  const vertex = (i: number) => index?.getX(i) ?? i;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const faceNormal = new Vector3();
  const shadingNormal = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    expect(Number.isFinite(positions.getX(i))).toBe(true);
    expect(Number.isFinite(positions.getY(i))).toBe(true);
    expect(Number.isFinite(positions.getZ(i))).toBe(true);
    shadingNormal.fromBufferAttribute(normals, i);
    expect(shadingNormal.length()).toBeCloseTo(1, 6);
  }
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(positions, vertex(i));
    b.fromBufferAttribute(positions, vertex(i + 1)).sub(a);
    c.fromBufferAttribute(positions, vertex(i + 2)).sub(a);
    faceNormal.crossVectors(b, c);
    expect(faceNormal.lengthSq()).toBeGreaterThan(0);
    faceNormal.normalize();
    shadingNormal.fromBufferAttribute(normals, vertex(i));
    expect(faceNormal.dot(shadingNormal)).toBeGreaterThanOrEqual(-1e-6);
  }
}

describe('createBlockGeometry', () => {
  it('conserva los extremos y una cara frontal plana con cantos asimétricos', () => {
    const geometry = createBlockGeometry(0.57, 0.4, 0.25, profile);
    const bounds = geometry.boundingBox!;
    expect(bounds.min.toArray()).toEqual([
      expect.closeTo(-0.285, 6), expect.closeTo(-0.2, 6), expect.closeTo(-0.125, 6),
    ]);
    expect(bounds.max.toArray()).toEqual([
      expect.closeTo(0.285, 6), expect.closeTo(0.2, 6), expect.closeTo(0.125, 6),
    ]);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const face: Vector3[] = [];
    for (let i = 0; i < positions.count; i++) {
      if (normals.getZ(i) > 1 - 1e-7) {
        expect(positions.getZ(i)).toBeCloseTo(0.125, 7);
        face.push(new Vector3().fromBufferAttribute(positions, i));
      }
    }
    expect(face.length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...face.map((p) => p.x))).toBeCloseTo(-0.275, 6);
    expect(Math.max(...face.map((p) => p.x))).toBeCloseTo(0.275, 6);
    expect(Math.min(...face.map((p) => p.y))).toBeCloseTo(-0.165, 6);
    expect(Math.max(...face.map((p) => p.y))).toBeCloseTo(0.187, 6);
    expectSoundSurface(geometry);
    geometry.dispose();
  });

  it('mantiene normales válidas y dimensiones pequeñas cuando limita cantos excesivos', () => {
    const geometry = createBlockGeometry(0.0001, 0.0002, 0.00003, {
      side: 100, top: 200, bottom: 300, depth: 400,
    });
    const size = geometry.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.0001, 10);
    expect(size.y).toBeCloseTo(0.0002, 10);
    expect(size.z).toBeCloseTo(0.00003, 10);
    expectSoundSurface(geometry);
    geometry.dispose();
  });

  it('admite cantos rectos sin normales no finitas ni triángulos colapsados', () => {
    for (const edges of [
      { side: 0, top: 0, bottom: 0, depth: 0 },
      { ...profile, side: 0 },
      { ...profile, bottom: 0 },
      { ...profile, depth: 0 },
    ]) {
      const geometry = createBlockGeometry(0.57, 0.4, 0.25, edges);
      expectSoundSurface(geometry);
      geometry.dispose();
    }
  });

  it('rechaza dimensiones y perfiles inválidos sin mutar el perfil recibido', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createBlockGeometry(value, 0.4, 0.25, profile)).toThrow(RangeError);
    }
    for (const key of ['side', 'top', 'bottom', 'depth'] as const) {
      for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => createBlockGeometry(0.57, 0.4, 0.25, { ...profile, [key]: value }))
          .toThrow(RangeError);
      }
    }
    const original = { ...profile };
    createBlockGeometry(0.001, 0.001, 0.001, profile).dispose();
    expect(profile).toEqual(original);
  });
});

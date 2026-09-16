/** Escala de textura en píxeles de referencia; relieve como intensidad del material. */
export const FINISH = {
  texture: 'assets/rack-prototype-fiber-detail.png',
  textureSpan: 520,
  roughness: 0.96,
  relief: { board: 2.4, platform: 1, accessory: 2.2 },
  /** El canto expuesto conserva un filo marfil más claro que la cara de cada pieza. */
  rim: { color: 0xfffdf9, strength: 0.9 },
  boardShade: 0.09,
} as const;

/** Cada cuadrante conserva su acabado y su perfil de borde del prototipo. */
export const CLUSTER_FINISH = {
  A: {
    color: 0xf6f3f2,
    relief: 1.2,
    roughness: 0.93,
    edges: { side: 1.8, top: 1.9, bottom: 2.6, depth: 2.4 },
  },
  B: {
    color: 0xf4ece3,
    relief: 1.5,
    roughness: 0.95,
    edges: { side: 2, top: 1.9, bottom: 2.6, depth: 2.4 },
  },
  C: {
    color: 0xd6cec7,
    relief: 3,
    roughness: 0.98,
    edges: { side: 1.6, top: 1.9, bottom: 1.9, depth: 1.8 },
  },
  D: {
    color: 0xd4d1ca,
    relief: 2.6,
    roughness: 0.98,
    edges: { side: 1.8, top: 1.9, bottom: 1.9, depth: 1.8 },
  },
} as const;

export const ACCESSORY_FINISH = {
  pills: { left: 0xe9e5e1, right: 0xece9e5 },
  panels: {
    'bottom-left': 0xddd6ce,
    'bottom-right': 0xddd8d3,
    'right-top': 0xf0eae3,
    'right-mid': 0xe8e3df,
    'right-bottom': 0xeae4df,
  },
} as const;

export const STUDIO = {
  cameraFov: 12,
  groundScale: 8,
  shadowMapSize: 2048,
  /** Radio del filtro continuo de cada mapa; conserva el contacto sin grano aleatorio. */
  shadowBlur: 3.2,
  lightSamples: 12,
  /** Dispersión angular gaussiana: penumbra algo más ancha en horizontal. */
  lightSpread: { x: 0.57, y: 0.5 },
  shadowMargin: 0.12,
  transitionMs: 700,
  colorVariation: 0.012,
} as const;

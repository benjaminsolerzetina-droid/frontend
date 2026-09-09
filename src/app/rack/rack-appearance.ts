/** Acabado en las mismas unidades de referencia que la geometría. */
export const FINISH = {
  texture: 'assets/rack-prototype-fiber-detail.png',
  textureSpan: 520,
  roughness: 0.96,
  relief: { board: 0.32, block: 0.3, platform: 0.18, accessory: 0.28 },
  boardShade: 0.075,
} as const;

/** Cada cuadrante conserva su acabado y su perfil de borde del prototipo. */
export const CLUSTER_FINISH = {
  A: { color: 0xf5f2f1, relief: 0.24, roughness: 0.93,
    edges: { side: 1.1, top: 1.3, bottom: 4.2, depth: 3.2 } },
  B: { color: 0xf5eee6, relief: 0.3, roughness: 0.95,
    edges: { side: 1.3, top: 1.3, bottom: 4.2, depth: 3.2 } },
  C: { color: 0xd5cfc8, relief: 0.44, roughness: 0.98,
    edges: { side: 1.0, top: 1.1, bottom: 1.9, depth: 1.8 } },
  D: { color: 0xd6d4cd, relief: 0.4, roughness: 0.98,
    edges: { side: 1.3, top: 1.1, bottom: 1.9, depth: 1.8 } },
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
  groundScale: 8,
  shadowMapSize: 2048,
  shadowBlur: 1.1,
  lightSamples: 12,
  lightSpread: 0.34,
  shadowMargin: 0.12,
  transitionMs: 700,
  colorVariation: 0.012,
} as const;

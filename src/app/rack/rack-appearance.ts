/** Acabado en las mismas unidades de referencia que la geometría. */
export const FINISH = {
  texture: 'assets/rack-prototype-fiber-detail.png',
  textureSpan: 850,
  roughness: 0.96,
  relief: { board: 0.65, block: 0.48, platform: 0.35, accessory: 0.48 },
} as const;

export const STUDIO = {
  groundScale: 8,
  shadowMapSize: 1024,
  shadowBlur: 2.5,
  lightSamples: 12,
  lightSpread: 0.48,
  shadowMargin: 0.12,
  transitionMs: 700,
  colorVariation: 0.018,
} as const;

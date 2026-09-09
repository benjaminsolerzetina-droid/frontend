/**
 * Medidas en píxeles del tablero del prototipo, sin el marco del navegador.
 * El origen de la escena es el centro de la placa; +Y apunta arriba y +Z fuera.
 * Las posiciones se derivan de la rejilla y sus separaciones en createRackLayout.
 */
import { CLUSTER_FINISH } from './rack-appearance';

export const PX = 0.01;

interface GridMeasurements {
  cols: number;
  rows: number;
  blockW: number;
  blockH: number;
  blockD: number;
  colGap: number;
  rowGap: number;
  bevel: number;
}

interface PlatformMeasurements {
  margin: number;
  thickness: number;
}

interface TileMeasurements {
  cell: number;
  size: number;
  depth: number;
  radius: number;
}

interface RackSpacing {
  columns: number;
  rows: number;
  bottomPanels: number;
  sidebar: number;
}

interface RackMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RackLayoutOptions {
  grid?: Partial<GridMeasurements>;
  platform?: Partial<PlatformMeasurements>;
  tile?: Partial<TileMeasurements>;
  spacing?: Partial<RackSpacing>;
  margins?: Partial<RackMargins>;
}

/** Medidas independientes. Los pasos, tamaños de grupos y anclas no se duplican. */
export const RACK_MEASUREMENTS = {
  grid: {
    cols: 10,
    rows: 6,
    blockW: 57,
    blockH: 40,
    blockD: 25,
    colGap: 1,
    rowGap: 25,
    bevel: 1.5,
  },
  platform: { margin: 0, thickness: 3 },
  tile: { cell: 20, size: 19, depth: 13, radius: 1.05 },
  spacing: { columns: 72, rows: 68, bottomPanels: 123, sidebar: 134 },
  margins: { left: 119, top: 91, right: 31, bottom: 39 },
  board: { radius: 38, depth: 24, bevel: 5 },
  accessories: {
    leftPill: { w: 59, h: 158, radius: 17, depth: 18, bevel: 2.2 },
    rightPill: { w: 86, h: 168, radius: 18, depth: 20, bevel: 2.2 },
    leftPillGap: 50,
    bottomPanelInset: 30,
    bottomPanelRows: 3,
    sidePanelCols: 3,
    sidePanelRows: [14, 5, 7],
    sidePanelTopOffset: 14,
    sidePillGap: 20,
    sideMidGap: 13,
    sideBottomGap: 31,
    cylinders: { length: 70, radius: 14, count: 3, pitch: 35, bottomInset: 17, xOffset: 5 },
  },
} as const;

/** La última celda termina en su ancho, no en un paso entero. */
const span = (count: number, pitch: number, size: number) => (count - 1) * pitch + size;

/**
 * Genera los cuatro grupos y sus accesorios desde una sola rejilla.
 * Cambiar filas, columnas o medidas desplaza los grupos, centra los paneles
 * inferiores y redimensiona el tablero conservando las separaciones elegidas.
 */
export function createRackLayout(options: RackLayoutOptions = {}) {
  const dimensions = { ...RACK_MEASUREMENTS.grid, ...options.grid };
  const platform = { ...RACK_MEASUREMENTS.platform, ...options.platform };
  const tile = { ...RACK_MEASUREMENTS.tile, ...options.tile };
  const spacing = { ...RACK_MEASUREMENTS.spacing, ...options.spacing };
  const margins = { ...RACK_MEASUREMENTS.margins, ...options.margins };
  const accessories = RACK_MEASUREMENTS.accessories;

  for (const count of [dimensions.cols, dimensions.rows]) {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError('La rejilla requiere cantidades enteras positivas de filas y columnas.');
    }
  }
  for (const value of [
    dimensions.blockW,
    dimensions.blockH,
    dimensions.blockD,
    platform.thickness,
    tile.cell,
    tile.size,
    tile.depth,
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError('Las dimensiones del rack deben ser positivas y finitas.');
    }
  }
  for (const value of [
    dimensions.colGap,
    dimensions.rowGap,
    dimensions.bevel,
    platform.margin,
    tile.radius,
    ...Object.values(spacing),
    ...Object.values(margins),
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('Las separaciones, márgenes y biseles no pueden ser negativos.');
    }
  }
  if (tile.size > tile.cell) {
    throw new RangeError('Las teselas no pueden ser mayores que su paso.');
  }
  if (margins.left < accessories.leftPill.w + accessories.leftPillGap) {
    throw new RangeError('El margen izquierdo debe alojar la pastilla y su separación.');
  }

  const grid = {
    ...dimensions,
    colPitch: dimensions.blockW + dimensions.colGap,
    rowPitch: dimensions.blockH + dimensions.rowGap,
  };
  const gridW = span(grid.cols, grid.colPitch, grid.blockW);
  const gridH = span(grid.rows, grid.rowPitch, grid.blockH);
  if (gridW < tile.size) {
    throw new RangeError('El grupo debe tener ancho suficiente para una tesela.');
  }
  const platformW = gridW + 2 * platform.margin;
  const platformH = gridH + 2 * platform.margin;
  const left = margins.left + platform.margin;
  const top = margins.top + platform.margin;
  const right = left + platformW + spacing.columns;
  const bottom = top + platformH + spacing.rows;
  const clusters = [
    { id: 'A', x: left, y: top, ...CLUSTER_FINISH.A },
    { id: 'B', x: right, y: top, ...CLUSTER_FINISH.B },
    { id: 'C', x: left, y: bottom, ...CLUSTER_FINISH.C },
    { id: 'D', x: right, y: bottom, ...CLUSTER_FINISH.D },
  ] as const;

  // La cantidad de teselas sigue el ancho del grupo sin estirar las celdas.
  const bottomCols = Math.max(
    1,
    Math.floor((gridW - 2 * accessories.bottomPanelInset - tile.size) / tile.cell) + 1,
  );
  const bottomPanelW = span(bottomCols, tile.cell, tile.size);
  const bottomPanelH = span(accessories.bottomPanelRows, tile.cell, tile.size);
  const bottomPanelY = bottom + gridH + platform.margin + spacing.bottomPanels;
  const sidePanelW = span(accessories.sidePanelCols, tile.cell, tile.size);
  const sidebarW = Math.max(
    accessories.rightPill.w,
    sidePanelW,
    accessories.cylinders.length + 2 * Math.abs(accessories.cylinders.xOffset),
  );
  const sidebarCenter = right + gridW + platform.margin + spacing.sidebar + sidebarW / 2;
  const sidePanelX = sidebarCenter - sidePanelW / 2;
  const sideTopY = top + accessories.sidePanelTopOffset;
  const sidePillY =
    sideTopY + span(accessories.sidePanelRows[0], tile.cell, tile.size) + accessories.sidePillGap;
  const sideMidY = sidePillY + accessories.rightPill.h + accessories.sideMidGap;
  const sideBottomY =
    sideMidY + span(accessories.sidePanelRows[1], tile.cell, tile.size) + accessories.sideBottomGap;
  const tilePanels = [
    {
      id: 'bottom-left',
      x: left + (gridW - bottomPanelW) / 2,
      y: bottomPanelY,
      cols: bottomCols,
      rows: accessories.bottomPanelRows,
    },
    {
      id: 'bottom-right',
      x: right + (gridW - bottomPanelW) / 2,
      y: bottomPanelY,
      cols: bottomCols,
      rows: accessories.bottomPanelRows,
    },
    {
      id: 'right-top',
      x: sidePanelX,
      y: sideTopY,
      cols: accessories.sidePanelCols,
      rows: accessories.sidePanelRows[0],
    },
    {
      id: 'right-mid',
      x: sidePanelX,
      y: sideMidY,
      cols: accessories.sidePanelCols,
      rows: accessories.sidePanelRows[1],
    },
    {
      id: 'right-bottom',
      x: sidePanelX,
      y: sideBottomY,
      cols: accessories.sidePanelCols,
      rows: accessories.sidePanelRows[2],
    },
  ];
  const pills = [
    {
      id: 'left',
      x: left - platform.margin - accessories.leftPillGap - accessories.leftPill.w,
      y: top,
      ...accessories.leftPill,
    },
    {
      id: 'right',
      x: sidebarCenter - accessories.rightPill.w / 2,
      y: sidePillY,
      ...accessories.rightPill,
    },
  ];

  const cylinder = accessories.cylinders;
  const cylinderSpan = (cylinder.count - 1) * cylinder.pitch + 2 * cylinder.radius;
  const sidebarBottom = sideBottomY + span(accessories.sidePanelRows[2], tile.cell, tile.size);
  // También cabe la columna lateral cuando se reduce el número de filas.
  const cylindersBottom = Math.max(
    bottomPanelY + bottomPanelH - cylinder.bottomInset,
    sidebarBottom + spacing.rows + cylinderSpan,
  );
  const cylinders = {
    x: sidebarCenter + cylinder.xOffset - cylinder.length / 2,
    length: cylinder.length,
    radius: cylinder.radius,
    centersY: Array.from(
      { length: cylinder.count },
      (_, index) =>
        cylindersBottom - cylinder.radius - (cylinder.count - 1 - index) * cylinder.pitch,
    ),
  };
  const board = {
    x: 0,
    y: 0,
    w: sidebarCenter + sidebarW / 2 + margins.right,
    h:
      Math.max(bottomPanelY + bottomPanelH, cylindersBottom, pills[0].y + pills[0].h) +
      margins.bottom,
    ...RACK_MEASUREMENTS.board,
  };

  return {
    board,
    grid,
    platform,
    platformW,
    platformH,
    tile,
    clusters,
    tilePanels,
    pills,
    cylinders,
    rowRise: platform.thickness + grid.blockD,
  };
}

export const RACK_LAYOUT = createRackLayout();
export const BOARD = RACK_LAYOUT.board;
export const GRID = RACK_LAYOUT.grid;
export const PLATFORM = RACK_LAYOUT.platform;
export const PLATFORM_W = RACK_LAYOUT.platformW;
export const PLATFORM_H = RACK_LAYOUT.platformH;
export const ROW_RISE = RACK_LAYOUT.rowRise;
export const CLUSTERS = RACK_LAYOUT.clusters;
export const TILE = RACK_LAYOUT.tile;
export const TILE_PANELS = RACK_LAYOUT.tilePanels;
export const PILLS = RACK_LAYOUT.pills;
export const CYLINDERS = RACK_LAYOUT.cylinders;
export const ORIGIN_X = BOARD.x + BOARD.w / 2;
export const ORIGIN_Y = BOARD.y + BOARD.h / 2;
export const FACE_Z = BOARD.depth / 2;
export const toX = (px: number) => (px - ORIGIN_X) * PX;
export const toY = (px: number) => (ORIGIN_Y - px) * PX;
export const toZ = (px: number) => px * PX;
export const len = (px: number) => px * PX;

export const COLORS = {
  background: 0xeeeae5,
  board: 0xeeeae5,
  cylinder: 0xeee9e3,
} as const;

/**
 * Reparto de iluminación entre la fuente principal, el relleno y el hemisferio.
 * La fracción restante aporta luz ambiente difusa; las tres participaciones
 * deben sumar como máximo 1. Los colores cálidos se definen en los materiales.
 */
export const LIGHT = {
  /** Dirección en el marco del tablero: sombras hacia abajo y a la izquierda. */
  keyDirection: [0.72, 0.84, 1],
  fillDirection: [-1, 0.15, 0.75],
  /** Aporte de la fuente principal, distribuido entre las muestras de STUDIO. */
  keyShare: 0.5,
  fillShare: 0.04,
  /** Luz difusa del entorno que conserva detalle en las caras laterales. */
  hemiShare: 0.25,
  hemiGround: 0xdcdcdc,
  /** Tinte lineal del entorno. La principal se compensa para conservar las caras. */
  indirectTint: [1.1, 1, 0.86],
} as const;

/** Oclusión ambiental para juntas y contacto entre piezas. Radio en unidades de mundo. */
export const AO = {
  radius: 0.07,
  distanceExponent: 1.2,
  thickness: 0.4,
  scale: 1,
  samples: 32,
  /** Intensidad del oscurecimiento de contacto. */
  intensity: 0.75,
  /** Suavizado del ruido de muestreo, conservando las juntas finas. */
  denoise: { radius: 2, samples: 24, rings: 3 },
} as const;

/** Supermuestreo para suavizar bordes y juntas, limitado por resolución y memoria. */
export const RENDER = {
  supersample: 2,
  maxPixelRatio: 3,
  /** Máximo de píxeles del búfer de renderizado. */
  maxBufferPixels: 8e6,
} as const;

/**
 * Las vistas se declaran en el marco de la placa, no en el del mundo: +Z es su
 * normal y +Y es el arriba de la imagen del prototipo. La escena rota ese marco
 * para dejar el rack tumbado.
 */
export interface RackView {
  id: string;
  label: string;
  /** Giro alrededor de la normal de la placa, en grados. */
  azimuth: number;
  /** Inclinación respecto a la normal, en grados. Negativo = hacia el borde cercano. */
  elevation: number;
  /** Holgura de encuadre: 1 = la placa toca los bordes. */
  fill: number;
  /**
   * Vector "arriba" de la cámara en el marco de la placa. La cenital conserva
   * el arriba de la referencia (0,1,0); las anguladas usan la normal (0,0,1).
   */
  up: readonly [number, number, number];
}

/** Vistas predefinidas. La cenital inicial conserva la orientación del prototipo. */
export const VIEWS: readonly RackView[] = [
  { id: 'superior', label: 'Superior', azimuth: 0, elevation: 0, fill: 0.973, up: [0, 1, 0] },
  {
    id: 'isometrica',
    label: 'Isométrica',
    azimuth: -32,
    elevation: -30,
    fill: 0.95,
    up: [0, 0, 1],
  },
  { id: 'lateral', label: 'Lateral', azimuth: 70, elevation: -10, fill: 0.95, up: [0, 0, 1] },
  { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: -70, fill: 0.95, up: [0, 0, 1] },
];

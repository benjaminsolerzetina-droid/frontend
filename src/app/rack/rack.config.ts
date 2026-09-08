/**
 * Medidas del prototipo del rack de inventario.
 *
 * Todo esta expresado en pixeles de la imagen de referencia (1546 x 1015) y se
 * convierte a unidades de mundo con PX. El origen del modelo es el centro de la
 * placa; +X a la derecha, +Y hacia arriba, +Z hacia el observador.
 */

/** Unidades de mundo por pixel de la imagen de referencia. */
export const PX = 0.01;

/** Placa base. x/y son la esquina superior izquierda en la imagen. */
export const BOARD = {
  x: 12,
  y: 12,
  w: 1428,
  h: 988,
  radius: 30,
  depth: 24,
} as const;

/** Centro de la placa en pixeles de la imagen: origen del modelo. */
export const ORIGIN_X = BOARD.x + BOARD.w / 2;
export const ORIGIN_Y = BOARD.y + BOARD.h / 2;

/** Cara frontal de la placa: todo lo demas se apoya sobre esta cota. */
export const FACE_Z = BOARD.depth / 2;

export const toX = (px: number) => (px - ORIGIN_X) * PX;
export const toY = (px: number) => (ORIGIN_Y - px) * PX;
export const toZ = (px: number) => px * PX;
export const len = (px: number) => px * PX;

/** Rejilla de bloques dentro de cada grupo: 6 filas x 10 bloques. */
export const GRID = {
  cols: 10,
  rows: 6,
  colPitch: 50.4,
  rowPitch: 57,
  blockW: 48.8,
  blockH: 34,
  blockD: 22,
} as const;

/**
 * Plataforma continua: una por conjunto, no una por fila.
 *
 * El rack esta tumbado y se mira desde arriba, asi que es una losa apoyada sobre
 * el tablero, con los diez bloques de las seis filas de pie encima. Al ser una
 * sola pieza por conjunto, lo que se ve en el hueco entre filas es su cara
 * superior, no el tablero.
 *
 * La plataforma llega exactamente al contorno de la rejilla. De esta manera,
 * en los cuatro grupos no queda un reborde visible alrededor de los bloques:
 * la placa queda a filo como en el prototipo.
 */
export const PLATFORM = {
  margin: 0,
  /** Cuanto se levanta del tablero. Los bloques se apoyan sobre su cara superior. */
  thickness: 8,
} as const;

// El ultimo bloque no ocupa un pitch completo: termina en su propio ancho.
export const PLATFORM_W =
  (GRID.cols - 1) * GRID.colPitch + GRID.blockW + 2 * PLATFORM.margin;
export const PLATFORM_H =
  (GRID.rows - 1) * GRID.rowPitch + GRID.blockH + 2 * PLATFORM.margin;

/** Altura total de una fila sobre el tablero: plataforma mas bloque. */
export const ROW_RISE = PLATFORM.thickness + GRID.blockD;

/** Los cuatro grupos de bloques. x/y son la esquina superior izquierda. */
export const CLUSTERS = [
  // La referencia es luminosa: son blancos matizados, no beige apagado.
  { id: 'A', x: 133, y: 90, color: 0xfcfcfa },
  { id: 'B', x: 704, y: 90, color: 0xf8f3e8 },
  { id: 'C', x: 133, y: 468, color: 0xeeece6 },
  { id: 'D', x: 704, y: 468, color: 0xe8ece7 },
] as const;

/** Modulo de las teselas pequenas: una sola celda para todos los paneles. */
export const TILE = {
  cell: 18.3,
  size: 16.4,
  depth: 8,
  radius: 1.4,
} as const;

/** Paneles de teselas. x/y son la esquina superior izquierda. */
export const TILE_PANELS = [
  { id: 'bottom-left', x: 152, y: 900, cols: 26, rows: 3 },
  { id: 'bottom-right', x: 722, y: 900, cols: 26, rows: 3 },
  { id: 'right-top', x: 1345, y: 110, cols: 3, rows: 14 },
  { id: 'right-mid', x: 1345, y: 535, cols: 3, rows: 5 },
  { id: 'right-bottom', x: 1345, y: 645, cols: 3, rows: 7 },
] as const;

/** Pastillas redondeadas. x/y son la esquina superior izquierda. */
export const PILLS = [
  { id: 'left', x: 30, y: 90, w: 48, h: 138, radius: 24, depth: 12 },
  { id: 'right', x: 1332, y: 372, w: 68, h: 144, radius: 24, depth: 14 },
] as const;

/** Cilindros tumbados de la esquina inferior derecha (eje en X). */
export const CYLINDERS = {
  x: 1345,
  length: 55,
  radius: 12,
  centersY: [869, 897, 925],
} as const;

export const COLORS = {
  background: 0xf4f3ef,
  board: 0xf9f8f5,
  pill: 0xf8f8f5,
  tile: 0xf3f0e8,
  cylinder: 0xf9f8f5,
} as const;

/**
 * Presupuesto de luz.
 *
 * three difunde con BRDF_Lambert = albedo / PI, asi que una superficie solo se
 * ve del color declarado en COLORS si la irradiancia total que recibe suma PI.
 * En vez de fijar intensidades a mano, aqui se declara que fraccion de esa luz
 * aporta cada fuente y la escena despeja las intensidades. Las fracciones suman
 * 1, de modo que una cara frontal (normal +Z) rinde exactamente su color.
 *
 * Todas las luces son blancas a proposito: cualquier tinte en la luz desvia el
 * color final respecto al del prototipo. El calor lo ponen los colores de COLORS.
 */
export const LIGHT = {
  /** Desde arriba y a la derecha: deja la sombra abajo-izquierda como el prototipo. */
  keyDirection: [0.26, 0.55, 1],
  fillDirection: [-1, 0.15, 0.75],
  /**
   * La clave es la unica que proyecta sombra, asi que su fraccion es tambien lo
   * que oscurece la sombra. Medido del prototipo: la placa pasa de #F0EBE2 a
   * ~#DDD7CC bajo cada fila, es decir ~18% menos luz.
   */
  keyShare: 0.22,
  fillShare: 0.032,
  /** Hemisferico casi neutro: mantiene iluminadas las caras que miran hacia abajo. */
  hemiShare: 0.40,
  hemiGround: 0xdcdcdc,
} as const;

/**
 * Oclusion ambiental.
 *
 * Como la luz del prototipo es casi uniforme, la definicion no viene de la luz
 * direccional sino del oscurecimiento en las ranuras entre bloques y en el
 * contacto con la placa. Sin esto la escena tiene los colores correctos pero se
 * ve plana. El radio va en unidades de mundo, del orden del alto de un bloque.
 */
export const AO = {
  radius: 0.07,
  distanceExponent: 1.2,
  thickness: 0.4,
  scale: 1,
  samples: 32,
  /** Cuanto oscurece. Medido del prototipo: las juntas caen ~23% respecto a la cara. */
  intensity: 0.5,
  /**
   * Filtrado del ruido de muestreo. El radio por defecto (8) difumina juntas de
   * pocos pixeles y deja las aristas punteadas, asi que se acorta y se compensa
   * con mas muestras.
   */
  denoise: { radius: 4, samples: 24, rings: 3 },
} as const;

/**
 * Resolucion de render.
 *
 * El AO en espacio de pantalla no resuelve limpio detalles de uno o dos pixeles:
 * las juntas entre bloques miden ~1.6 px y salian dentadas por el ruido 5x5 que
 * usa GTAO para rotar sus muestras. Ni mas muestras ni mas denoise lo quitan; lo
 * que lo quita es renderizar por encima de la resolucion de pantalla y dejar que
 * el navegador reduzca. Ese supermuestreo tambien hace las veces de antialias,
 * por eso el render target va sin MSAA.
 */
export const RENDER = {
  supersample: 2,
  maxPixelRatio: 3,
  /** Tope de pixeles del buffer, para no reventar la memoria en pantallas grandes. */
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
  /** Inclinacion respecto a la normal, en grados. Negativo = hacia el borde cercano. */
  elevation: number;
  /** Holgura de encuadre: 1 = la placa toca los bordes. */
  fill: number;
  /**
   * Vector "arriba" de la camara en el marco de la placa. La cenital usa el
   * arriba de la imagen (0,1,0), porque ahi la normal seria paralela a la
   * mirada. Las anguladas usan la normal (0,0,1): es lo que hace que el rack se
   * lea tumbado sobre una mesa y no colgado de una pared.
   */
  up: readonly [number, number, number];
}

/** Escenas fijas. La primera es la cenital: la identica a la imagen de referencia. */
export const VIEWS: readonly RackView[] = [
  { id: 'superior', label: 'Superior', azimuth: 0, elevation: 0, fill: 0.973, up: [0, 1, 0] },
  { id: 'isometrica', label: 'Isometrica', azimuth: -32, elevation: -30, fill: 0.95, up: [0, 0, 1] },
  { id: 'lateral', label: 'Lateral', azimuth: 70, elevation: -10, fill: 0.95, up: [0, 0, 1] },
  { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: -70, fill: 0.95, up: [0, 0, 1] },
];

export const CAMERA_FOV = 28;

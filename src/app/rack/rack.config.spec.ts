import {
  BOARD,
  CLUSTERS,
  CYLINDERS,
  GRID,
  PILLS,
  PLATFORM,
  PLATFORM_H,
  PLATFORM_W,
  TILE,
  TILE_PANELS,
  VIEWS,
} from './rack.config';

describe('rack.config', () => {
  it('tiene cuatro grupos de 6 x 10 bloques', () => {
    expect(CLUSTERS.length).toBe(4);
    expect(GRID.rows).toBe(6);
    expect(GRID.cols).toBe(10);
    expect(CLUSTERS.length * GRID.rows * GRID.cols).toBe(240);
  });

  it('mantiene los grupos dentro del tablero, plataforma incluida', () => {
    for (const cluster of CLUSTERS) {
      // La plataforma asoma `margin` alrededor de la rejilla, asi que es ella y
      // no los bloques la que marca el contorno del conjunto.
      const left = cluster.x - PLATFORM.margin;
      const top = cluster.y - PLATFORM.margin;
      expect(left).toBeGreaterThanOrEqual(BOARD.x);
      expect(top).toBeGreaterThanOrEqual(BOARD.y);
      expect(left + PLATFORM_W).toBeLessThanOrEqual(BOARD.x + BOARD.w);
      expect(top + PLATFORM_H).toBeLessThanOrEqual(BOARD.y + BOARD.h);
    }
  });

  it('alinea la plataforma exactamente con la rejilla de cada grupo', () => {
    expect(PLATFORM.margin).toBe(0);
    expect(PLATFORM_W).toBe(
      (GRID.cols - 1) * GRID.colPitch + GRID.blockW + 2 * PLATFORM.margin,
    );
    expect(PLATFORM_H - ((GRID.rows - 1) * GRID.rowPitch + GRID.blockH)).toBe(2 * PLATFORM.margin);
  });

  it('mantiene los paneles de teselas dentro de la placa', () => {
    for (const panel of TILE_PANELS) {
      expect(panel.x + panel.cols * TILE.cell).toBeLessThanOrEqual(BOARD.x + BOARD.w);
      expect(panel.y + panel.rows * TILE.cell).toBeLessThanOrEqual(BOARD.y + BOARD.h);
    }
  });

  it('declara los accesorios del prototipo', () => {
    expect(PILLS.length).toBe(2);
    expect(CYLINDERS.centersY.length).toBe(3);
    expect(TILE_PANELS.length).toBe(5);
  });

  it('arranca en la cenital, que es la del prototipo', () => {
    expect(VIEWS[0].id).toBe('superior');
    expect(VIEWS[0].azimuth).toBe(0);
    expect(VIEWS[0].elevation).toBe(0);
    // mirando por la normal, la normal no sirve de 'arriba': se usa el de la imagen
    expect(VIEWS[0].up).toEqual([0, 1, 0]);
  });
});

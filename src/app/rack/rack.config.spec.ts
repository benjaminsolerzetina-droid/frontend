import { createRackLayout, RACK_LAYOUT, RackLayoutOptions, VIEWS } from './rack.config';

type RackLayout = ReturnType<typeof createRackLayout>;

function rectangles(layout: RackLayout) {
  return [
    ...layout.clusters.map((cluster) => ({
      id: cluster.id,
      x: cluster.x - layout.platform.margin,
      y: cluster.y - layout.platform.margin,
      w: layout.platformW,
      h: layout.platformH,
    })),
    ...layout.tilePanels.map((panel) => ({
      id: panel.id,
      x: panel.x,
      y: panel.y,
      w: (panel.cols - 1) * layout.tile.cell + layout.tile.size,
      h: (panel.rows - 1) * layout.tile.cell + layout.tile.size,
    })),
    ...layout.pills,
    ...layout.cylinders.centersY.map((centerY, index) => ({
      id: `cylinder-${index}`,
      x: layout.cylinders.x,
      y: centerY - layout.cylinders.radius,
      w: layout.cylinders.length,
      h: 2 * layout.cylinders.radius,
    })),
  ];
}

function expectLayoutToFit(layout: RackLayout) {
  const elements = rectangles(layout);
  for (const element of elements) {
    expect(element.x, element.id).toBeGreaterThanOrEqual(layout.board.x);
    expect(element.y, element.id).toBeGreaterThanOrEqual(layout.board.y);
    expect(element.x + element.w, element.id).toBeLessThanOrEqual(layout.board.w);
    expect(element.y + element.h, element.id).toBeLessThanOrEqual(layout.board.h);
  }
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      expect(overlap, `${a.id} / ${b.id}`).toBe(false);
    }
  }
}

describe('rack.config', () => {
  it('conserva las medidas y cantidades observadas en el prototipo', () => {
    expect(RACK_LAYOUT.board.w).toBe(1600);
    expect(RACK_LAYOUT.board.h).toBe(1110);
    expect(RACK_LAYOUT.clusters.length * RACK_LAYOUT.grid.cols * RACK_LAYOUT.grid.rows).toBe(240);
    expect(RACK_LAYOUT.platformW).toBe(579);
    expect(RACK_LAYOUT.platformH).toBe(365);
    expect(RACK_LAYOUT.tilePanels.map(({ cols, rows }) => [cols, rows])).toEqual([
      [26, 3],
      [26, 3],
      [3, 14],
      [3, 5],
      [3, 7],
    ]);
  });

  const variants: RackLayoutOptions[] = [
    {},
    { grid: { cols: 1, rows: 1 } },
    { grid: { cols: 7, rows: 4 } },
    { grid: { cols: 14, rows: 9 } },
    {
      grid: { cols: 12, rows: 8, blockW: 61, blockH: 43, colGap: 2, rowGap: 23 },
      platform: { margin: 4, thickness: 5 },
      tile: { cell: 18, size: 17 },
      spacing: { columns: 84, rows: 70, bottomPanels: 100, sidebar: 140 },
    },
  ];
  for (const [index, options] of variants.entries()) {
    it(`mantiene todos los elementos dentro de la placa y sin cruces (variante ${index})`, () => {
      expectLayoutToFit(createRackLayout(options));
    });
  }

  it('adapta las anclas, la placa y las teselas cuando cambia el número de columnas', () => {
    const wider = createRackLayout({ grid: { cols: RACK_LAYOUT.grid.cols + 2 } });
    const addedWidth = 2 * RACK_LAYOUT.grid.colPitch;
    expect(wider.clusters[0].x).toBe(RACK_LAYOUT.clusters[0].x);
    expect(wider.clusters[1].x - RACK_LAYOUT.clusters[1].x).toBe(addedWidth);
    expect(wider.board.w - RACK_LAYOUT.board.w).toBe(2 * addedWidth);
    expect(wider.pills[1].x - RACK_LAYOUT.pills[1].x).toBe(2 * addedWidth);
    expect(wider.tilePanels[0].cols).toBeGreaterThan(RACK_LAYOUT.tilePanels[0].cols);
    const panel = wider.tilePanels[0];
    const panelWidth = (panel.cols - 1) * wider.tile.cell + wider.tile.size;
    expect(panel.x + panelWidth / 2).toBe(wider.clusters[0].x + wider.platformW / 2);
  });

  it('conserva pasillos y margen inferior al añadir filas', () => {
    const taller = createRackLayout({ grid: { rows: RACK_LAYOUT.grid.rows + 2 } });
    const addedHeight = 2 * RACK_LAYOUT.grid.rowPitch;
    expect(taller.clusters[2].y - RACK_LAYOUT.clusters[2].y).toBe(addedHeight);
    expect(taller.tilePanels[0].y - RACK_LAYOUT.tilePanels[0].y).toBe(2 * addedHeight);
    expect(taller.board.h - RACK_LAYOUT.board.h).toBe(2 * addedHeight);
    expect(taller.cylinders.centersY[0] - RACK_LAYOUT.cylinders.centersY[0]).toBe(2 * addedHeight);
  });

  it('rechaza medidas que producirían solapes o geometrías inválidas', () => {
    expect(() => createRackLayout({ grid: { cols: 0 } })).toThrow(RangeError);
    expect(() => createRackLayout({ grid: { rows: 2.5 } })).toThrow(RangeError);
    expect(() => createRackLayout({ grid: { colGap: -1 } })).toThrow(RangeError);
    expect(() => createRackLayout({ grid: { blockW: NaN } })).toThrow(RangeError);
    expect(() => createRackLayout({ tile: { size: 21, cell: 20 } })).toThrow(RangeError);
  });

  it('arranca mirando por la normal del tablero, con el arriba de la referencia', () => {
    expect(VIEWS[0].id).toBe('superior');
    expect(VIEWS[0].azimuth).toBe(0);
    expect(VIEWS[0].elevation).toBe(0);
    expect(VIEWS[0].up).toEqual([0, 1, 0]);
  });
});

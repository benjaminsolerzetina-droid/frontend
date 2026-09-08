import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

import {
  AO,
  BOARD,
  CAMERA_FOV,
  CLUSTERS,
  COLORS,
  CYLINDERS,
  FACE_Z,
  GRID,
  LIGHT,
  PILLS,
  PLATFORM,
  PLATFORM_H,
  PLATFORM_W,
  ROW_RISE,
  RENDER,
  RackView,
  TILE,
  TILE_PANELS,
  VIEWS,
  len,
  toX,
  toY,
  toZ,
} from './rack.config';

const TRANSITION_MS = 900;

/** Rectangulo redondeado centrado en el origen, en el plano XY. */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const radius = Math.max(0.0001, Math.min(r, w / 2, h / 2));
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + h - radius);
  shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  shape.lineTo(x + radius, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** Placa redondeada solida, centrada en el origen y con el canto biselado. */
function roundedPlateGeometry(w: number, h: number, r: number, depth: number, bevel: number) {
  const b = Math.min(bevel, depth / 3, w / 4, h / 4);
  const shape = roundedRectShape(w - 2 * b, h - 2 * b, r - b);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 24,
    steps: 1,
  });
  geometry.translate(0, 0, -(depth / 2 - b));
  geometry.computeVertexNormals();
  return geometry;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class RackScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly resizeObserver: ResizeObserver;

  /**
   * El rack se construye en el marco del prototipo (placa en el plano XY, normal
   * +Z, +Y hacia arriba en la imagen) y este grupo lo tumba: la normal pasa a ser
   * +Y del mundo y el rack queda apoyado como una bandeja. Se hace asi para no
   * tener que reescribir las medidas de rack.config.ts, que estan tomadas de la
   * imagen. Las luces van dentro, para que la sombra siga cayendo abajo-izquierda.
   */
  private readonly content = new THREE.Group();
  private readonly boardToWorld = new THREE.Quaternion();
  private readonly prototypeFiber: THREE.Texture;
  private readonly elementPrototypeFiber: THREE.Texture;
  private readonly platformPrototypeFiber: THREE.Texture;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private frame = 0;
  private needsRender = true;
  private disposed = false;

  private readonly fromDir = new THREE.Vector3(0, 0, 1);
  private readonly toDir = new THREE.Vector3(0, 0, 1);
  private readonly fromUp = new THREE.Vector3(...VIEWS[0].up);
  private readonly toUp = new THREE.Vector3(...VIEWS[0].up);
  private fromFill = VIEWS[0].fill;
  private toFill = VIEWS[0].fill;
  private transitionStart = 0;
  private transitionActive = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(COLORS.background);

    this.content.rotation.x = -Math.PI / 2;
    this.content.updateMatrixWorld();
    this.boardToWorld.setFromEuler(this.content.rotation);
    this.scene.add(this.content);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);
    this.scene.add(this.camera);

    // Acabado del prototipo: blanco calido, mate y de fibra prensada. La placa
    // y cada bloque usan escalas independientes para mantener el detalle fino.
    this.prototypeFiber = this.loadPrototypeFiberTexture(3);
    this.elementPrototypeFiber = this.loadPrototypeFiberTexture(1);
    this.platformPrototypeFiber = this.loadPrototypeFiberTexture(2);

    this.buildLights();
    this.buildBoard();
    this.buildClusters();
    this.buildTiles();
    this.buildPills();
    this.buildCylinders();

    this.composer = this.buildComposer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    this.directionFor(VIEWS[0], this.toDir);
    this.fromDir.copy(this.toDir);
    this.placeCamera(this.toDir, this.toUp, VIEWS[0].fill);

    this.loop();
  }

  // ---------------------------------------------------------------- escena

  private track<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private loadPrototypeFiberTexture(repeat: number): THREE.Texture {
    const texture = new THREE.TextureLoader().load('assets/rack-prototype-fiber-detail.png', () => {
      if (!this.disposed) this.needsRender = true;
    });
    // Es un mapa de acabado, no una fotografia de color: se conserva su valor
    // casi blanco para que aporte fibra sin ensuciar ni oscurecer la paleta.
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    this.textures.push(texture);
    return texture;
  }

  private surface(
    color: number,
    roughness: number,
    bump?: THREE.Texture,
    bumpScale = 0,
    useColorMap = true,
  ) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness: 0,
      map: useColorMap ? (bump ?? null) : null,
      bumpMap: bump ?? null,
      bumpScale,
    });
    this.materials.push(material);
    return material;
  }

  /**
   * Reparte PI de irradiancia entre las cuatro fuentes segun las fracciones de
   * LIGHT, de modo que una cara frontal rinda exactamente su color de COLORS.
   * Ver la nota del presupuesto de luz en rack.config.ts.
   */
  private buildLights() {
    const keyDir = new THREE.Vector3(...LIGHT.keyDirection).normalize();
    const fillDir = new THREE.Vector3(...LIGHT.fillDirection).normalize();

    // Una cara frontal recibe de cada direccional su intensidad por dotNL = dir.z,
    // y del hemisferico la mezcla a medio camino entre suelo y cielo.
    const ground = new THREE.Color(LIGHT.hemiGround).r; // ya convertido a lineal
    const hemiFrontal = (ground + 1) / 2;

    const ambientShare = 1 - LIGHT.keyShare - LIGHT.fillShare - LIGHT.hemiShare;

    const ambient = new THREE.AmbientLight(0xffffff, Math.PI * ambientShare);
    const hemisphere = new THREE.HemisphereLight(
      0xffffff,
      LIGHT.hemiGround,
      (Math.PI * LIGHT.hemiShare) / hemiFrontal,
    );

    const key = new THREE.DirectionalLight(0xffffff, (Math.PI * LIGHT.keyShare) / keyDir.z);
    key.position.copy(keyDir).multiplyScalar(40);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 4;
    const shadowCam = key.shadow.camera;
    // Con el rack tumbado la clave queda casi cenital y el arriba por defecto
    // (0,1,0) se acerca a ser paralelo a su mirada: se usa el de la placa.
    shadowCam.up.set(0, 0, -1);
    shadowCam.left = -8;
    shadowCam.right = 8;
    shadowCam.top = 6.5;
    shadowCam.bottom = -6.5;
    shadowCam.near = 10;
    shadowCam.far = 80;
    shadowCam.updateProjectionMatrix();

    const fill = new THREE.DirectionalLight(0xffffff, (Math.PI * LIGHT.fillShare) / fillDir.z);
    fill.position.copy(fillDir).multiplyScalar(40);

    this.content.add(ambient, hemisphere, key, fill);
  }

  /**
   * Beauty pass + oclusion ambiental + salida a sRGB.
   *
   * El target va sin MSAA a proposito: el antialias lo da el supermuestreo de
   * RENDER, y activar ademas MSAA sobre un buffer HalfFloat de esa resolucion
   * multiplicaria la memoria sin ganancia visible.
   */
  private buildComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(size.width * ratio, size.height * ratio, {
      type: THREE.HalfFloatType,
      samples: 0,
    });

    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const gtao = new GTAOPass(this.scene, this.camera, size.width, size.height);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = AO.intensity;
    gtao.updateGtaoMaterial({
      radius: AO.radius,
      distanceExponent: AO.distanceExponent,
      thickness: AO.thickness,
      scale: AO.scale,
      samples: AO.samples,
      screenSpaceRadius: false,
    });
    gtao.updatePdMaterial({ ...AO.denoise });
    composer.addPass(gtao);

    composer.addPass(new OutputPass());
    return composer;
  }

  private buildBoard() {
    const geometry = this.track(
      roundedPlateGeometry(len(BOARD.w), len(BOARD.h), len(BOARD.radius), len(BOARD.depth), len(6)),
    );
    const board = new THREE.Mesh(
      geometry,
      this.surface(COLORS.board, 0.96, this.prototypeFiber, 0.004),
    );
    board.receiveShadow = true;
    board.castShadow = true;
    this.content.add(board);
  }

  private buildClusters() {
    // Los elementos de los cuatro grupos son prismas de arista recta, como el
    // prototipo. Los accesorios del rack conservan sus propios redondeos.
    const blockGeometry = this.track(
      new THREE.BoxGeometry(len(GRID.blockW), len(GRID.blockH), len(GRID.blockD)),
    );
    const platformGeometry = this.track(
      new THREE.BoxGeometry(len(PLATFORM_W), len(PLATFORM_H), len(PLATFORM.thickness)),
    );

    const matrix = new THREE.Matrix4();
    const platformZ = toZ(FACE_Z + PLATFORM.thickness / 2);
    // Los bloques no se apoyan en el tablero sino en la cara superior de la plataforma.
    const blockZ = toZ(FACE_Z + PLATFORM.thickness + GRID.blockD / 2);

    for (const cluster of CLUSTERS) {
      // El grano debe leerse sobre cada frente, incluso en la vista superior.
      // Solo se acentua el micro-relieve: la plataforma permanece lisa.
      const blockMaterial = this.surface(cluster.color, 0.9, this.elementPrototypeFiber, 0.007);
      // La plataforma solo recibe el relieve: el mapa de color se concentra en
      // los bloques para evitar las bandas nubosas que no existen en la referencia.
      const platformMaterial = this.surface(
        cluster.color,
        0.94,
        this.platformPrototypeFiber,
        0.0005,
        false,
      );

      // Una sola plataforma por conjunto, bajo las seis filas.
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.set(
        toX(cluster.x - PLATFORM.margin + PLATFORM_W / 2),
        toY(cluster.y - PLATFORM.margin + PLATFORM_H / 2),
        platformZ,
      );
      platform.castShadow = true;
      platform.receiveShadow = true;

      const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, GRID.rows * GRID.cols);
      blocks.castShadow = true;
      blocks.receiveShadow = true;

      let i = 0;
      for (let row = 0; row < GRID.rows; row++) {
        const rowTop = cluster.y + row * GRID.rowPitch;
        for (let col = 0; col < GRID.cols; col++) {
          matrix.setPosition(
            toX(cluster.x + (col + 0.5) * GRID.colPitch),
            toY(rowTop + GRID.blockH / 2),
            blockZ,
          );
          blocks.setMatrixAt(i++, matrix);
        }
      }

      blocks.instanceMatrix.needsUpdate = true;
      this.content.add(platform, blocks);
    }
  }

  private buildTiles() {
    const geometry = this.track(
      new RoundedBoxGeometry(len(TILE.size), len(TILE.size), len(TILE.depth), 2, len(TILE.radius)),
    );
    const count = TILE_PANELS.reduce((total, panel) => total + panel.cols * panel.rows, 0);
    const mesh = new THREE.InstancedMesh(
      geometry,
      this.surface(COLORS.tile, 0.91, this.elementPrototypeFiber, 0.005),
      count,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const z = toZ(FACE_Z + TILE.depth / 2);
    let i = 0;
    for (const panel of TILE_PANELS) {
      for (let row = 0; row < panel.rows; row++) {
        for (let col = 0; col < panel.cols; col++) {
          matrix.setPosition(
            toX(panel.x + (col + 0.5) * TILE.cell),
            toY(panel.y + (row + 0.5) * TILE.cell),
            z,
          );
          mesh.setMatrixAt(i++, matrix);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.content.add(mesh);
  }

  private buildPills() {
    const material = this.surface(COLORS.pill, 0.94, this.elementPrototypeFiber, 0.004);
    for (const pill of PILLS) {
      const geometry = this.track(
        roundedPlateGeometry(len(pill.w), len(pill.h), len(pill.radius), len(pill.depth), len(2.5)),
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        toX(pill.x + pill.w / 2),
        toY(pill.y + pill.h / 2),
        toZ(FACE_Z + pill.depth / 2),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.content.add(mesh);
    }
  }

  private buildCylinders() {
    const geometry = this.track(
      new THREE.CylinderGeometry(
        len(CYLINDERS.radius),
        len(CYLINDERS.radius),
        len(CYLINDERS.length),
        40,
        1,
      ),
    );
    const material = this.surface(COLORS.cylinder, 0.9, this.elementPrototypeFiber, 0.004);
    for (const centerY of CYLINDERS.centersY) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(
        toX(CYLINDERS.x + CYLINDERS.length / 2),
        toY(centerY),
        toZ(FACE_Z + CYLINDERS.radius),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.content.add(mesh);
    }
  }

  // ---------------------------------------------------------------- camara

  private directionFor(view: RackView, out: THREE.Vector3) {
    const az = THREE.MathUtils.degToRad(view.azimuth);
    const el = THREE.MathUtils.degToRad(view.elevation);
    return out
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      .normalize();
  }

  /**
   * Distancia minima a la que el rack completo entra en cuadro desde `dir`.
   * Proyecta las ocho esquinas de su caja sobre los ejes de la camara, de modo
   * que el encuadre se conserva en cualquier proporcion de canvas. Trabaja en el
   * marco de la placa, igual que las vistas.
   */
  private fitDistance(dir: THREE.Vector3, up: THREE.Vector3, fill: number): number {
    const tanY = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * fill;
    const tanX = tanY * this.camera.aspect;

    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, up);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const camUp = new THREE.Vector3().crossVectors(right, forward).normalize();

    const hw = len(BOARD.w) / 2;
    const hh = len(BOARD.h) / 2;
    // La caja no es simetrica en Z: la placa baja hasta -depth/2 y las filas
    // sobresalen por arriba. En las vistas rasantes eso si asoma en cuadro.
    const zLow = -len(BOARD.depth) / 2;
    const zHigh = len(FACE_Z + ROW_RISE);
    const corner = new THREE.Vector3();

    let distance = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const z of [zLow, zHigh]) {
          corner.set(sx * hw, sy * hh, z);
          const along = corner.dot(dir);
          distance = Math.max(
            distance,
            Math.abs(corner.dot(right)) / tanX + along,
            Math.abs(corner.dot(camUp)) / tanY + along,
          );
        }
      }
    }
    return distance;
  }

  /** `dir` y `up` llegan en el marco de la placa; aqui se pasan al del mundo. */
  private placeCamera(dir: THREE.Vector3, up: THREE.Vector3, fill: number) {
    const distance = this.fitDistance(dir, up, fill);

    this.camera.position.copy(dir).applyQuaternion(this.boardToWorld).multiplyScalar(distance);
    this.camera.up.copy(up).applyQuaternion(this.boardToWorld).normalize();
    this.camera.lookAt(0, 0, 0);

    // Ceñir near/far a la placa: el AO lee profundidad y un rango 0.1-200 le
    // deja demasiado poca precision para resolver ranuras de milimetros.
    const margin = len(BOARD.w) / 2 + len(BOARD.h) / 2;
    this.camera.near = Math.max(0.1, distance - margin);
    this.camera.far = distance + margin;
    this.camera.updateProjectionMatrix();

    this.needsRender = true;
  }

  setView(id: string) {
    const view = VIEWS.find((v) => v.id === id);
    if (!view) return;
    this.fromDir.copy(this.toDir);
    this.fromUp.copy(this.toUp);
    this.fromFill = this.toFill;
    this.directionFor(view, this.toDir);
    this.toUp.set(...view.up).normalize();
    this.toFill = view.fill;
    this.transitionStart = performance.now();
    this.transitionActive = true;
    this.needsRender = true;
  }

  // ----------------------------------------------------------------- ciclo

  private resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    // Se recalcula en cada resize porque el zoom del navegador cambia
    // devicePixelRatio: si no, el canvas se sigue dibujando a la resolucion vieja
    // y el navegador lo escala. Ver la nota de RENDER en rack.config.ts.
    const ratio = Math.min(
      window.devicePixelRatio * RENDER.supersample,
      RENDER.maxPixelRatio,
      Math.sqrt(RENDER.maxBufferPixels / (width * height)),
    );
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);

    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.placeCamera(
      this.transitionActive ? this.fromDir : this.toDir,
      this.transitionActive ? this.fromUp : this.toUp,
      this.toFill,
    );
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);

    if (this.transitionActive) {
      const t = Math.min(1, (performance.now() - this.transitionStart) / TRANSITION_MS);
      const e = easeInOutCubic(t);
      const dir = this.fromDir.clone().lerp(this.toDir, e).normalize();
      const up = this.fromUp.clone().lerp(this.toUp, e).normalize();
      this.placeCamera(dir, up, THREE.MathUtils.lerp(this.fromFill, this.toFill, e));
      if (t >= 1) {
        this.transitionActive = false;
        this.fromDir.copy(this.toDir);
        this.fromUp.copy(this.toUp);
        this.fromFill = this.toFill;
      }
    }

    if (this.needsRender) {
      this.needsRender = false;
      this.composer.render();
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.composer.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

import {
  AO,
  BOARD,
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
import { ACCESSORY_FINISH, FINISH, STUDIO } from './rack-appearance';
import { fitOrthographicBounds, fitPerspectiveBounds } from './rack-camera';
import { createBlockGeometry } from './rack-block-geometry';

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

function roundedPlateGeometry(w: number, h: number, r: number, depth: number, bevel: number) {
  const b = Math.min(bevel, depth / 3, w / 4, h / 4);
  const shape = roundedRectShape(w - 2 * b, h - 2 * b, r - b);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
    curveSegments: 24,
    steps: 1,
  });
  geometry.translate(0, 0, -(depth / 2 - b));
  geometry.computeVertexNormals();
  return geometry;
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);

export class RackScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(STUDIO.cameraFov);
  private readonly composer: EffectComposer;
  private readonly resizeObserver: ResizeObserver;
  private readonly content = new THREE.Group();
  private readonly boardToWorld = new THREE.Quaternion();
  private readonly fiber: THREE.Texture;
  private readonly bounds: THREE.Box3;
  private readonly corners: THREE.Vector3[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private aspect = 1;
  private frame = 0;
  private needsRender = true;
  private disposed = false;
  private readonly currentDir = new THREE.Vector3(0, 0, 1);
  private readonly currentUp = new THREE.Vector3(...VIEWS[0].up);
  private readonly fromDir = this.currentDir.clone();
  private readonly toDir = this.currentDir.clone();
  private readonly fromUp = this.currentUp.clone();
  private readonly toUp = this.currentUp.clone();
  private currentFill = VIEWS[0].fill;
  private fromFill = this.currentFill;
  private toFill = this.currentFill;
  private transitionStart = 0;
  private transitionActive = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // La geometría y la luz son estáticas; cambiar de vista no rehace las sombras.
    this.renderer.shadowMap.autoUpdate = false;
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.add(this.content, this.camera);
    this.fiber = this.loadFiber();
    this.buildBoard();
    this.buildClusters();
    this.buildTiles();
    this.buildPills();
    this.buildCylinders();
    // Límites de todas las piezas, antes de añadir el suelo del estudio.
    this.bounds = new THREE.Box3().setFromObject(this.content);
    for (const x of [this.bounds.min.x, this.bounds.max.x]) {
      for (const y of [this.bounds.min.y, this.bounds.max.y]) {
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          this.corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    this.buildGround();
    this.buildLights();
    // Marco del prototipo XY → rack apoyado sobre el plano horizontal del mundo.
    this.content.rotation.x = -Math.PI / 2;
    this.boardToWorld.setFromEuler(this.content.rotation);
    this.content.updateMatrixWorld(true);
    this.renderer.shadowMap.needsUpdate = true;
    this.composer = this.buildComposer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.loop();
  }

  /** Un mismo tamaño de fibra para placa, bloques, accesorios y suelo. */
  private track(geometry: THREE.BufferGeometry, lightEdges = false): THREE.BufferGeometry {
    if (geometry.index) {
      const unindexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = unindexed;
    }
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const uv = new Float32Array(positions.count * 2);
    const span = len(FINISH.textureSpan);
    // Una proyección por triángulo evita estirar la fibra al cruzar un bisel.
    for (let triangle = 0; triangle < positions.count; triangle += 3) {
      const nx = Math.abs(
        normals.getX(triangle) + normals.getX(triangle + 1) + normals.getX(triangle + 2),
      );
      const ny = Math.abs(
        normals.getY(triangle) + normals.getY(triangle + 1) + normals.getY(triangle + 2),
      );
      const nz = Math.abs(
        normals.getZ(triangle) + normals.getZ(triangle + 1) + normals.getZ(triangle + 2),
      );
      for (let i = triangle; i < triangle + 3; i++) {
        const u = nx > nz && nx > ny ? positions.getZ(i) : positions.getX(i);
        const v = ny > nz && ny > nx ? positions.getZ(i) : positions.getY(i);
        uv[i * 2] = u / span + 0.5;
        uv[i * 2 + 1] = v / span + 0.5;
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (lightEdges) {
      const rimWeights = new Float32Array(positions.count);
      for (let i = 0; i < positions.count; i++) {
        const front = THREE.MathUtils.clamp(normals.getZ(i), 0, 1);
        // Solo el bisel frontal: la cara plana y los laterales mantienen su tono.
        rimWeights[i] =
          front > 1e-5 && front < 1 - 1e-5 ? Math.pow(4 * front * (1 - front), 0.7) : 0;
      }
      geometry.setAttribute('rimWeight', new THREE.BufferAttribute(rimWeights, 1));
    }
    this.geometries.push(geometry);
    return geometry;
  }

  private loadFiber(): THREE.Texture {
    const texture = new THREE.TextureLoader().load(FINISH.texture, () => {
      if (!this.disposed) this.needsRender = true;
    });
    // Mapa claro de acabado: su modulación se aplica en espacio lineal.
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  private surface(
    color: number,
    relief: number,
    roughness: number = FINISH.roughness,
    lightEdges = false,
  ) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0,
      // bumpScale regula la perturbación de la normal; no es una medida del rack.
      map: this.fiber,
      bumpMap: this.fiber,
      bumpScale: relief,
    });
    if (lightEdges) material.defines = { ...material.defines, RACK_RIM: 1 };
    // Cada instancia toma una zona distinta del acabado, a la misma escala física.
    material.onBeforeCompile = (shader) => {
      shader.uniforms['rimColor'] = { value: new THREE.Color(FINISH.rim.color) };
      shader.uniforms['rimStrength'] = { value: FINISH.rim.strength };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `
        #include <common>
        #ifdef RACK_RIM
          attribute float rimWeight;
          varying float vRimWeight;
        #endif
        #ifdef USE_INSTANCING
          attribute vec2 surfaceOffset;
        #endif
      `,
        )
        .replace(
          '#include <uv_vertex>',
          `
        #include <uv_vertex>
        #ifdef RACK_RIM
          vRimWeight = rimWeight;
        #endif
        #ifdef USE_INSTANCING
          vMapUv += surfaceOffset;
          vBumpMapUv += surfaceOffset;
        #endif
      `,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `
        #include <common>
        #ifdef RACK_RIM
          uniform vec3 rimColor;
          uniform float rimStrength;
          varying float vRimWeight;
        #endif
      `,
        )
        .replace(
          '#include <color_fragment>',
          `
        #include <color_fragment>
        #ifdef RACK_RIM
          vec3 rimFinishColor = rimColor;
          #ifdef USE_MAP
            rimFinishColor *= sampledDiffuseColor.rgb;
          #endif
          diffuseColor.rgb = mix(diffuseColor.rgb, rimFinishColor, vRimWeight * rimStrength);
        #endif
      `,
        );
    };
    this.materials.push(material);
    return material;
  }

  private addSolid(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.content.add(mesh);
  }

  private boardSurface(geometry: THREE.BufferGeometry) {
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const down = THREE.MathUtils.clamp(0.5 - positions.getY(i) / len(BOARD.h), 0, 1);
      const shade = 1 - FINISH.boardShade * down;
      colors.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = this.surface(COLORS.board, FINISH.relief.board);
    material.vertexColors = true;
    return material;
  }

  private buildBoard() {
    const geometry = this.track(
      roundedPlateGeometry(
        len(BOARD.w),
        len(BOARD.h),
        len(BOARD.radius),
        len(BOARD.depth),
        len(BOARD.bevel),
      ),
    );
    this.addSolid(new THREE.Mesh(geometry, this.boardSurface(geometry)));
  }

  private buildGround() {
    const size = this.bounds.getSize(new THREE.Vector3()).length() * STUDIO.groundScale;
    const geometry = this.track(new THREE.PlaneGeometry(size, size));
    const ground = new THREE.Mesh(geometry, this.boardSurface(geometry));
    ground.position.z = this.bounds.min.z;
    ground.receiveShadow = true;
    this.content.add(ground);
  }

  private buildClusters() {
    const platformGeometry = this.track(
      new RoundedBoxGeometry(
        len(PLATFORM_W),
        len(PLATFORM_H),
        len(PLATFORM.thickness),
        2,
        len(Math.min(GRID.bevel, PLATFORM.thickness / 3)),
      ),
    );
    const matrix = new THREE.Matrix4();
    for (const cluster of CLUSTERS) {
      const edges = cluster.edges;
      const blockGeometry = this.track(
        createBlockGeometry(len(GRID.blockW), len(GRID.blockH), len(GRID.blockD), {
          side: len(edges.side),
          top: len(edges.top),
          bottom: len(edges.bottom),
          depth: len(edges.depth),
        }),
        true,
      );
      const surfaceOffsets = new Float32Array(GRID.rows * GRID.cols * 2);
      const platform = new THREE.Mesh(
        platformGeometry,
        this.surface(cluster.color, FINISH.relief.platform),
      );
      platform.position.set(
        toX(cluster.x - PLATFORM.margin + PLATFORM_W / 2),
        toY(cluster.y - PLATFORM.margin + PLATFORM_H / 2),
        toZ(FACE_Z + PLATFORM.thickness / 2),
      );
      this.addSolid(platform);
      const blocks = new THREE.InstancedMesh(
        blockGeometry,
        this.surface(cluster.color, cluster.relief, cluster.roughness, true),
        GRID.rows * GRID.cols,
      );
      let i = 0;
      for (let row = 0; row < GRID.rows; row++) {
        for (let col = 0; col < GRID.cols; col++) {
          matrix.makeTranslation(
            toX(cluster.x + col * GRID.colPitch + GRID.blockW / 2),
            toY(cluster.y + row * GRID.rowPitch + GRID.blockH / 2),
            toZ(FACE_Z + PLATFORM.thickness + GRID.blockD / 2),
          );
          blocks.setMatrixAt(i, matrix);
          surfaceOffsets[i * 2] = (cluster.x + col * GRID.colPitch) / FINISH.textureSpan;
          surfaceOffsets[i * 2 + 1] = (cluster.y + row * GRID.rowPitch) / FINISH.textureSpan;
          const variation = ((i * 37 + cluster.x) % 17) / 16;
          blocks.setColorAt(
            i++,
            new THREE.Color().setScalar(1 - variation * STUDIO.colorVariation),
          );
        }
      }
      blockGeometry.setAttribute(
        'surfaceOffset',
        new THREE.InstancedBufferAttribute(surfaceOffsets, 2),
      );
      blocks.instanceMatrix.needsUpdate = true;
      this.addSolid(blocks);
    }
  }

  private buildTiles() {
    const geometry = this.track(
      new RoundedBoxGeometry(len(TILE.size), len(TILE.size), len(TILE.depth), 2, len(TILE.radius)),
      true,
    );
    const mesh = new THREE.InstancedMesh(
      geometry,
      this.surface(0xffffff, FINISH.relief.accessory, FINISH.roughness, true),
      TILE_PANELS.reduce((total, panel) => total + panel.cols * panel.rows, 0),
    );
    const matrix = new THREE.Matrix4();
    const surfaceOffsets = new Float32Array(mesh.count * 2);
    let i = 0;
    for (const panel of TILE_PANELS) {
      const color = new THREE.Color(
        ACCESSORY_FINISH.panels[panel.id as keyof typeof ACCESSORY_FINISH.panels],
      );
      for (let row = 0; row < panel.rows; row++) {
        for (let col = 0; col < panel.cols; col++) {
          matrix.makeTranslation(
            toX(panel.x + col * TILE.cell + TILE.size / 2),
            toY(panel.y + row * TILE.cell + TILE.size / 2),
            toZ(FACE_Z + TILE.depth / 2),
          );
          surfaceOffsets[i * 2] = (panel.x + col * TILE.cell) / FINISH.textureSpan;
          surfaceOffsets[i * 2 + 1] = (panel.y + row * TILE.cell) / FINISH.textureSpan;
          mesh.setColorAt(i, color);
          mesh.setMatrixAt(i++, matrix);
        }
      }
    }
    geometry.setAttribute('surfaceOffset', new THREE.InstancedBufferAttribute(surfaceOffsets, 2));
    mesh.instanceMatrix.needsUpdate = true;
    this.addSolid(mesh);
  }

  private buildPills() {
    for (const pill of PILLS) {
      const material = this.surface(
        ACCESSORY_FINISH.pills[pill.id as keyof typeof ACCESSORY_FINISH.pills],
        FINISH.relief.accessory,
      );
      const mesh = new THREE.Mesh(
        this.track(
          roundedPlateGeometry(
            len(pill.w),
            len(pill.h),
            len(pill.radius),
            len(pill.depth),
            len(pill.bevel),
          ),
        ),
        material,
      );
      mesh.position.set(
        toX(pill.x + pill.w / 2),
        toY(pill.y + pill.h / 2),
        toZ(FACE_Z + pill.depth / 2),
      );
      this.addSolid(mesh);
    }
  }

  private buildCylinders() {
    const geometry = this.track(
      new THREE.CylinderGeometry(
        len(CYLINDERS.radius),
        len(CYLINDERS.radius),
        len(CYLINDERS.length),
        48,
      ),
    );
    const material = this.surface(COLORS.cylinder, FINISH.relief.accessory);
    for (const centerY of CYLINDERS.centersY) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(
        toX(CYLINDERS.x + CYLINDERS.length / 2),
        toY(centerY),
        toZ(FACE_Z + CYLINDERS.radius),
      );
      this.addSolid(mesh);
    }
  }

  private buildLights() {
    const keyDir = new THREE.Vector3(...LIGHT.keyDirection).normalize();
    const fillDir = new THREE.Vector3(...LIGHT.fillDirection).normalize();
    const ground = new THREE.Color(LIGHT.hemiGround).r;
    const ambientShare = 1 - LIGHT.keyShare - LIGHT.fillShare - LIGHT.hemiShare;
    const indirect = new THREE.Color().setRGB(...LIGHT.indirectTint);
    const direct = new THREE.Color().setRGB(
      (1 - indirect.r * (1 - LIGHT.keyShare)) / LIGHT.keyShare,
      (1 - indirect.g * (1 - LIGHT.keyShare)) / LIGHT.keyShare,
      (1 - indirect.b * (1 - LIGHT.keyShare)) / LIGHT.keyShare,
    );
    const ambient = new THREE.AmbientLight(indirect, Math.PI * ambientShare);
    const hemisphere = new THREE.HemisphereLight(
      indirect,
      new THREE.Color(LIGHT.hemiGround).multiply(indirect),
      (Math.PI * LIGHT.hemiShare) / ((ground + 1) / 2),
    );
    const fill = new THREE.DirectionalLight(indirect, (Math.PI * LIGHT.fillShare) / fillDir.z);
    const diagonal = this.bounds.getSize(new THREE.Vector3()).length();
    fill.position.copy(fillDir).multiplyScalar(diagonal * 2);
    // Una fuente amplia: la penumbra crece con la altura de la pieza.
    // Las teselas conservan su contacto y las filas proyectan sombras suaves.
    for (let i = 0; i < STUDIO.lightSamples; i++) {
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      const radius = STUDIO.lightSpread * Math.sqrt((i + 0.5) / STUDIO.lightSamples);
      const direction = new THREE.Vector3(
        keyDir.x / keyDir.z + Math.cos(angle) * radius,
        keyDir.y / keyDir.z + Math.sin(angle) * radius,
        1,
      ).normalize();
      const key = new THREE.DirectionalLight(
        direct,
        (Math.PI * LIGHT.keyShare) / (direction.z * STUDIO.lightSamples),
      );
      key.castShadow = true;
      key.shadow.mapSize.set(STUDIO.shadowMapSize, STUDIO.shadowMapSize);
      key.shadow.radius = STUDIO.shadowBlur;
      key.shadow.bias = -0.00005;
      key.shadow.normalBias = len(GRID.bevel) / 4;
      const shadowCamera = key.shadow.camera;
      const fit = fitOrthographicBounds(
        this.corners,
        direction,
        new THREE.Vector3(0, 1, 0),
        1,
        1 / (1 + STUDIO.shadowMargin),
      );
      key.target.position.copy(fit.target);
      key.position.copy(fit.target).addScaledVector(direction, fit.distance);
      shadowCamera.left = -fit.halfWidth;
      shadowCamera.right = fit.halfWidth;
      shadowCamera.top = fit.halfHeight;
      shadowCamera.bottom = -fit.halfHeight;
      shadowCamera.near = fit.near;
      shadowCamera.far = fit.far;
      shadowCamera.up.set(0, 0, -1);
      shadowCamera.updateProjectionMatrix();
      this.content.add(key, key.target);
    }
    this.content.add(ambient, hemisphere, fill, fill.target);
  }

  private buildComposer() {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const gtao = new GTAOPass(this.scene, this.camera, 1, 1);
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

  private directionFor(view: RackView, out: THREE.Vector3) {
    const az = THREE.MathUtils.degToRad(view.azimuth);
    const el = THREE.MathUtils.degToRad(view.elevation);
    return out
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      .normalize();
  }

  private placeCamera() {
    const fit = fitPerspectiveBounds(
      this.corners,
      this.currentDir,
      this.currentUp,
      this.aspect,
      this.currentFill,
      STUDIO.cameraFov,
    );
    this.camera.aspect = this.aspect;
    // Un teleobjetivo conserva las proporciones y deja ver el canto de cada fila.
    // La profundidad adicional incluye el suelo en las vistas inclinadas.
    const studioRadius = this.bounds.getSize(new THREE.Vector3()).length() * STUDIO.groundScale;
    this.camera.near = fit.near / 4;
    this.camera.far = fit.far + studioRadius;
    this.camera.position
      .copy(fit.target)
      .addScaledVector(this.currentDir, fit.distance)
      .applyQuaternion(this.boardToWorld);
    this.camera.up.copy(this.currentUp).applyQuaternion(this.boardToWorld).normalize();
    this.camera.lookAt(fit.target.clone().applyQuaternion(this.boardToWorld));
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  setView(id: string) {
    const view = VIEWS.find((v) => v.id === id);
    if (!view) return;
    this.fromDir.copy(this.currentDir);
    this.fromUp.copy(this.currentUp);
    this.fromFill = this.currentFill;
    this.directionFor(view, this.toDir);
    this.toUp.set(...view.up).normalize();
    this.toFill = view.fill;
    this.transitionStart = performance.now();
    this.transitionActive = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.transitionStart -= STUDIO.transitionMs;
    }
  }

  private resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const ratio = Math.min(
      window.devicePixelRatio * RENDER.supersample,
      RENDER.maxPixelRatio,
      Math.sqrt(RENDER.maxBufferPixels / (width * height)),
    );
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.aspect = width / height;
    this.placeCamera();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (this.transitionActive) {
      const t = Math.min(1, (performance.now() - this.transitionStart) / STUDIO.transitionMs);
      const e = easeInOut(t);
      this.currentDir.copy(this.fromDir).lerp(this.toDir, e).normalize();
      this.currentUp.copy(this.fromUp).lerp(this.toUp, e).normalize();
      this.currentFill = THREE.MathUtils.lerp(this.fromFill, this.toFill, e);
      this.placeCamera();
      this.transitionActive = t < 1;
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
    this.composer.passes.forEach((pass) => pass.dispose());
    this.composer.dispose();
    this.content.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.fiber.dispose();
    this.renderer.dispose();
  }
}

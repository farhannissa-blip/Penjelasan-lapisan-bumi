import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LAYER_MAP, type AtmosSubLayerId, type LayerId } from '../data/earthContent';
import {
  createCloudTexture,
  createCoreGlowTexture,
  createCrossSectionRingTexture,
  createEarthSurfaceTextures,
  createGeologicalShellTexture,
  sampleEarthElevation,
} from './textures';

import {
  createSurfaceDiorama,
  type SurfaceDioramaAssembly,
} from './surfaceDiorama';

export type CutawayMode = 'teleskop' | 'oktan' | 'permukaan';

export type TourStage =
  | 'idle'
  | 'whole'
  | 'kerak'
  | 'mantel'
  | 'inti-luar'
  | 'inti-dalam'
  | 'surface-intro'
  | 'litosfer'
  | 'hidrosfer'
  | 'biosfer'
  | 'atmosfer'
  | 'atmos-intro'
  | 'troposfer'
  | 'stratosfer'
  | 'mesosfer'
  | 'termosfer'
  | 'done';

export interface ProjectedLabelPoint {
  layerId: LayerId;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface ProjectedAtmosLabelPoint {
  id: AtmosSubLayerId;
  x: number;
  y: number;
  visible: boolean;
}

export interface EarthSceneCallbacks {
  onSelectLayer: (layerId: LayerId) => void;
  onSelectAtmosSubLayer?: (subId: AtmosSubLayerId) => void;
  onProjectLabels?: (labels: ProjectedLabelPoint[]) => void;
  onProjectAtmosLabels?: (labels: ProjectedAtmosLabelPoint[]) => void;
  onTourStageChange?: (stage: TourStage, cutawayProgress: number) => void;
  onWebGLContextLost?: () => void;
  onWebGLContextRestored?: () => void;
}

export interface EarthSceneOptions {
  initialCutaway: number;
  initialCutawayMode: CutawayMode;
  initialAutoRotate: boolean;
  initialShadows: boolean;
  initialEcoMode: boolean;
}

export function detectLightweightDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const isSmallOrTouch =
    window.innerWidth < 1024 ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
  const mem =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8
      : 8;
  return isSmallOrTouch || cores <= 4 || mem <= 4;
}

// Radii for concentric geological layers
const R_INNER_CORE = 0.6;
const R_OUTER_CORE = 1.14;
const R_MANTLE = 1.88;
const R_CRUST = 2.0;
const R_CLOUDS = 2.055;
const R_ATMOS = 2.18;

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _v3 = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _pointerNdc = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function latLonToSpherePos(
  latDeg: number,
  lonDeg: number,
  radius: number,
  out: THREE.Vector3,
): { phi: number; theta: number } {
  const phi = ((lonDeg + 180) / 360) * Math.PI * 2;
  const theta = ((90 - latDeg) / 180) * Math.PI;
  const sinT = Math.sin(theta);
  out.set(
    -radius * Math.cos(phi) * sinT,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinT,
  );
  return { phi, theta };
}

export class EarthSceneController {
  private container: HTMLElement;
  private callbacks: EarthSceneCallbacks;
  private isSoftwareGl: boolean;
  private isMobile: boolean;
  private ecoMode: boolean;
  private paused = false;
  private shadowsDirty = true;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();

  private frameId = 0;
  private disposed = false;

  // Root & mode assemblies
  private earthRoot = new THREE.Group();
  private atmosMesh!: THREE.Mesh;
  private holoGraticule!: THREE.Group;

  // Animated geological textures (gentle magma & liquid metal flow)
  private mantleFlowTex!: THREE.CanvasTexture;
  private outerCoreFlowTex!: THREE.CanvasTexture;
  private cutMantleFaceTele!: THREE.Mesh;
  private cutOuterCoreFaceTele!: THREE.Mesh;

  // Mode 1: Telescoping Hemisphere Cutaway (Reference Images 1 & 2)
  private teleRoot = new THREE.Group();
  private teleCrustGroup = new THREE.Group();
  private teleMantleGroup = new THREE.Group();
  private teleOuterCoreGroup = new THREE.Group();
  private teleInnerCoreGroup = new THREE.Group();
  private teleRightShellGroup = new THREE.Group();
  private teleCloudLeft!: THREE.Mesh;
  private teleCloudRight!: THREE.Mesh;

  // Mode 2: 3-Plane Octant 1/8 Cutaway (Reference Image 4)
  private octRoot = new THREE.Group();
  private octMainGroup = new THREE.Group();
  private octWedgeGroup = new THREE.Group();
  private octInnerCoreMesh!: THREE.Mesh;
  private octCloudSouth!: THREE.Mesh;
  private octCloudNorth!: THREE.Mesh;
  private octCloudWedge!: THREE.Mesh;

  // Mode 3: Interactive 3D Surface Components Diorama (Litosfer, Hidrosfer, Biosfer, Atmosfer)
  private surfaceDiorama!: SurfaceDioramaAssembly;

  // 3D Animated Guide Character: "Astro Bumi" (10-part composite astronaut mounted gently in camera view!)
  private astroRoot = new THREE.Group();
  private astroBody = new THREE.Group();
  private astroWaveArm = new THREE.Group();
  private astroPointArm = new THREE.Group();
  private astroEyeLeft!: THREE.Mesh;
  private astroEyeRight!: THREE.Mesh;
  private astroWaveBoost = 1.0; // flares briefly when user picks a layer!
  private astroVisible = true;

  // Shared decorative/educational actors
  private satellitePivot = new THREE.Group();
  private satelliteGroup = new THREE.Group();
  private coreGlowSpriteTele!: THREE.Sprite;
  private coreGlowSpriteOct!: THREE.Sprite;

  // 3D Label anchor nodes
  private labelAnchorsTele: Array<{ id: LayerId; label: string; node: THREE.Object3D }> = [];
  private labelAnchorsOct: Array<{ id: LayerId; label: string; node: THREE.Object3D }> = [];
  private labelBuffer: ProjectedLabelPoint[] = [
    { layerId: 'kerak', label: 'Kerak Bumi', x: 0, y: 0, visible: false },
    { layerId: 'mantel', label: 'Mantel Bumi', x: 0, y: 0, visible: false },
    { layerId: 'inti-luar', label: 'Inti Luar', x: 0, y: 0, visible: false },
    { layerId: 'inti-dalam', label: 'Inti Dalam', x: 0, y: 0, visible: false },
  ];
  private atmosLabelBuffer: ProjectedAtmosLabelPoint[] = [
    { id: 'troposfer', x: 0, y: 0, visible: false },
    { id: 'stratosfer', x: 0, y: 0, visible: false },
    { id: 'mesosfer', x: 0, y: 0, visible: false },
    { id: 'termosfer', x: 0, y: 0, visible: false },
  ];

  // Dynamic lighting
  private sunLight!: THREE.DirectionalLight;
  private coreGlowLight!: THREE.PointLight;

  // Interactive picking
  private raycaster = new THREE.Raycaster();
  private pickableTele: THREE.Object3D[] = [];
  private pickableOct: THREE.Object3D[] = [];
  private pickableShared: THREE.Object3D[] = [];
  private pickableTeleAll: THREE.Object3D[] = [];
  private pickableOctAll: THREE.Object3D[] = [];
  private pointerDownPos = { x: 0, y: 0 };
  private isDraggingPointer = false;

  // State targets with exponential damping
  private cutawayMode: CutawayMode = 'teleskop';
  private targetCutaway = 0.68;
  private currentCutaway = 0.68;
  private autoRotateEnabled = true;
  private shadowsEnabled = true;
  private activeLayerId: LayerId | null = null;
  private activeAtmosSubId: AtmosSubLayerId | null = null;
  private cameraTransitionActive = false;
  private cameraGoalPos = new THREE.Vector3();
  private cameraTargetGoal = new THREE.Vector3();
  private desiredZoomDistance: number | null = null;

  // Audio-synchronized Sequential Guided Tour ("Putar Animasi Lapisan")
  private tourRunning = false;
  private tourStage: TourStage = 'idle';
  private tourRevealedCount = 4; // 0..4 progressive label reveal during tour

  // Highlightable materials map
  private layerHighlightMaterials = new Map<LayerId, THREE.MeshStandardMaterial[]>();
  private baseEmissiveIntensity = new Map<THREE.MeshStandardMaterial, number>();

  // Resource tracking
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  constructor(
    container: HTMLElement,
    options: EarthSceneOptions,
    callbacks: EarthSceneCallbacks,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.isMobile = window.innerWidth < 768;
    this.ecoMode = options.initialEcoMode;

    this.cutawayMode = options.initialCutawayMode;
    this.targetCutaway = options.initialCutaway;
    this.currentCutaway = options.initialCutaway;
    this.autoRotateEnabled = options.initialAutoRotate;
    this.shadowsEnabled = options.initialShadows;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    // 1. Renderer setup (PBR, ACESFilmic, software WebGL guard, adaptive pixel-budget DPR)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.ecoMode,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.setPixelRatio(this.computeOptimalPixelRatio(width, height));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    // 2. Scene & Space Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050914);
    this.scene.fog = new THREE.FogExp2(0x050914, 0.016);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.textures.push(envRT.texture);
    pmremGenerator.dispose();

    // 3. Camera (added to scene so camera-anchored Astro Bumi renders cleanly!)
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 130);
    const startDist = this.isMobile ? 8.6 : 7.3;
    this.camera.position.set(startDist * 0.56, startDist * 0.22, startDist * 0.8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);

    // 4. OrbitControls (rotate, zoom, and safe clamped pan/geser for mobile/tablet/PID)
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.6;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 14.0;
    this.controls.rotateSpeed = this.isMobile ? 0.75 : 0.65;
    this.controls.zoomSpeed = 0.9;
    this.controls.autoRotate = !this.isSoftwareGl && this.autoRotateEnabled;
    this.controls.autoRotateSpeed = 0.5;

    this.controls.addEventListener('start', () => {
      // Stop scripted camera glide immediately so we never fight manual touch/drag
      this.cameraTransitionActive = false;
      this.desiredZoomDistance = null;
    });

    // 5. Build Scene, Earth Assemblies, and 3D Astro Bumi Guide
    this.buildLighting();
    this.buildStarfieldAndHoloGrid();
    this.buildEarthAssemblies();
    this.buildAstroBumiCharacter();
    this.pickableTeleAll = [...this.pickableTele, ...this.pickableShared];
    this.pickableOctAll = [...this.pickableOct, ...this.pickableShared];
    this.applyCutawayModeVisibility();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 6. Events
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.clock.start();
    this.tick();
  }

  /**
   * Computes an adaptive pixel ratio that keeps mobile phones (3x DPR) and 4K PIDs
   * inside a lightweight GPU fragment budget while staying sharp.
   */
  private computeOptimalPixelRatio(width: number, height: number): number {
    if (this.isSoftwareGl) return 1;
    const dpr = window.devicePixelRatio || 1;
    const area = Math.max(1, width * height);
    const maxPixels = this.ecoMode ? 780_000 : 1_850_000;
    const maxDprCap = this.ecoMode ? 1.0 : 1.5;
    const budgetDpr = Math.sqrt(maxPixels / area);
    return Math.max(0.65, Math.min(dpr, maxDprCap, budgetDpr));
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private trackTex<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  private registerLayerMaterial(layerId: LayerId, mat: THREE.MeshStandardMaterial) {
    const list = this.layerHighlightMaterials.get(layerId) || [];
    list.push(mat);
    this.layerHighlightMaterials.set(layerId, list);
    this.baseEmissiveIntensity.set(mat, mat.emissiveIntensity);
  }

  private buildLighting() {
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.7);
    this.sunLight.position.set(7.2, 4.6, 6.8);
    this.sunLight.castShadow = !this.isSoftwareGl && this.shadowsEnabled;
    const shadowSize = this.ecoMode || this.isMobile ? 512 : 768;
    this.sunLight.shadow.mapSize.width = shadowSize;
    this.sunLight.shadow.mapSize.height = shadowSize;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 22;
    const d = 5.2;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    const hemiLight = new THREE.HemisphereLight(0x7cc4ff, 0x160e24, 0.78);
    this.scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(-7.5, 2.2, -5.8);
    this.scene.add(rimLight);

    this.coreGlowLight = new THREE.PointLight(0xff9c33, 2.6, 6.5, 1.4);
    this.coreGlowLight.position.set(0.9, 0.2, 0.6);
    this.scene.add(this.coreGlowLight);
  }

  private buildStarfieldAndHoloGrid() {
    const starCount = this.ecoMode || this.isMobile ? 120 : 220;
    const starGeo = this.trackGeo(new THREE.OctahedronGeometry(0.052, 0));
    const starMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        fog: false,
      }),
    );
    const stars = new THREE.InstancedMesh(starGeo, starMat, starCount);
    stars.frustumCulled = false;

    const palette = [0xdbeafe, 0xfef3c7, 0xffffff, 0x93c5fd];
    for (let i = 0; i < starCount; i++) {
      const r = 24 + Math.random() * 32;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      _v3.set(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.cos(theta),
        r * Math.sin(theta) * Math.sin(phi),
      );
      _scale.setScalar(0.4 + Math.random() * 1.15);
      _quat.identity();
      _mat4.compose(_v3, _quat, _scale);
      stars.setMatrixAt(i, _mat4);
      _color.setHex(palette[i % palette.length]);
      stars.setColorAt(i, _color);
    }
    stars.instanceMatrix.needsUpdate = true;
    if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
    stars.computeBoundingSphere();
    this.scene.add(stars);

    const ringSegs = this.ecoMode ? 56 : 72;
    this.holoGraticule = new THREE.Group();
    const eqRing = new THREE.Mesh(
      this.trackGeo(new THREE.TorusGeometry(2.68, 0.007, 6, ringSegs)),
      this.trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
      ),
    );
    eqRing.rotation.x = Math.PI / 2;

    const meridianRing = new THREE.Mesh(
      this.trackGeo(new THREE.TorusGeometry(2.68, 0.005, 6, ringSegs)),
      this.trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.09,
          depthWrite: false,
        }),
      ),
    );
    meridianRing.rotation.y = Math.PI / 4;

    this.holoGraticule.add(eqRing, meridianRing);
    this.holoGraticule.rotation.z = THREE.MathUtils.degToRad(12);
    this.scene.add(this.holoGraticule);
  }

  private buildEarthAssemblies() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const lightweightTex = this.ecoMode || this.isMobile;

    const surfaceTex = createEarthSurfaceTextures(maxAniso, lightweightTex);
    this.trackTex(surfaceTex.colorMap);
    this.trackTex(surfaceTex.bumpMap);
    this.trackTex(surfaceTex.roughnessMap);

    const cloudTex = this.trackTex(createCloudTexture(maxAniso, lightweightTex));

    const crustRockTex = createGeologicalShellTexture('crust-rock', maxAniso, lightweightTex);
    this.trackTex(crustRockTex.colorMap);
    this.trackTex(crustRockTex.bumpMap);

    const mantleTex = createGeologicalShellTexture('mantle', maxAniso, lightweightTex);
    this.mantleFlowTex = this.trackTex(mantleTex.colorMap);
    this.trackTex(mantleTex.bumpMap);

    const outerCoreTex = createGeologicalShellTexture('outer-core', maxAniso, lightweightTex);
    this.outerCoreFlowTex = this.trackTex(outerCoreTex.colorMap);
    this.trackTex(outerCoreTex.bumpMap);

    const innerCoreTex = createGeologicalShellTexture('inner-core', maxAniso, lightweightTex);
    this.trackTex(innerCoreTex.colorMap);
    this.trackTex(innerCoreTex.bumpMap);

    const cutCrustTex = this.trackTex(createCrossSectionRingTexture('kerak', maxAniso, lightweightTex));
    const cutMantleTex = this.trackTex(createCrossSectionRingTexture('mantel', maxAniso, lightweightTex));
    const cutOuterCoreTex = this.trackTex(createCrossSectionRingTexture('inti-luar', maxAniso, lightweightTex));
    const coreGlowTex = this.trackTex(createCoreGlowTexture());

    // --- SHARED PBR MATERIALS ---
    const earthSurfaceMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: surfaceTex.colorMap,
        bumpMap: surfaceTex.bumpMap,
        bumpScale: 0.05,
        roughnessMap: surfaceTex.roughnessMap,
        roughness: 1.0,
        metalness: 0.08,
        emissive: new THREE.Color(0x0a2545),
        emissiveIntensity: 0.05,
      }),
    );
    this.registerLayerMaterial('kerak', earthSurfaceMat);
    this.registerLayerMaterial('litosfer', earthSurfaceMat);
    this.registerLayerMaterial('hidrosfer', earthSurfaceMat);

    const crustRockMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: crustRockTex.colorMap,
        bumpMap: crustRockTex.bumpMap,
        bumpScale: 0.065,
        roughness: 0.92,
        metalness: 0.05,
        emissive: new THREE.Color(0x4a2c16),
        emissiveIntensity: 0.08,
      }),
    );
    this.registerLayerMaterial('kerak', crustRockMat);

    const mantleShellMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: mantleTex.colorMap,
        bumpMap: mantleTex.bumpMap,
        bumpScale: 0.045,
        roughness: 0.65,
        metalness: 0.08,
        emissive: new THREE.Color(0xd9480f),
        emissiveIntensity: 0.52,
      }),
    );
    this.registerLayerMaterial('mantel', mantleShellMat);

    const outerCoreShellMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: outerCoreTex.colorMap,
        bumpMap: outerCoreTex.bumpMap,
        bumpScale: 0.032,
        roughness: 0.25,
        metalness: 0.52,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 0.82,
      }),
    );
    this.registerLayerMaterial('inti-luar', outerCoreShellMat);

    const innerCoreMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: innerCoreTex.colorMap,
        bumpMap: innerCoreTex.bumpMap,
        bumpScale: 0.02,
        roughness: 0.16,
        metalness: 0.68,
        emissive: new THREE.Color(0xfff3a8),
        emissiveIntensity: 1.25,
      }),
    );
    this.registerLayerMaterial('inti-dalam', innerCoreMat);

    const cutCrustMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: cutCrustTex,
        bumpMap: crustRockTex.bumpMap,
        bumpScale: 0.05,
        roughness: 0.9,
        metalness: 0.04,
        emissive: new THREE.Color(0x52341c),
        emissiveIntensity: 0.08,
      }),
    );
    this.registerLayerMaterial('kerak', cutCrustMat);

    const cutMantleMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: cutMantleTex,
        roughness: 0.6,
        metalness: 0.08,
        emissive: new THREE.Color(0xea580c),
        emissiveIntensity: 0.56,
      }),
    );
    this.registerLayerMaterial('mantel', cutMantleMat);

    const cutOuterCoreMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: cutOuterCoreTex,
        roughness: 0.26,
        metalness: 0.45,
        emissive: new THREE.Color(0xfbbf24),
        emissiveIntensity: 0.88,
      }),
    );
    this.registerLayerMaterial('inti-luar', cutOuterCoreMat);

    const cloudMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.84,
        roughness: 0.92,
        metalness: 0.0,
        depthWrite: false,
      }),
    );

    const coreGlowSpriteMat = this.trackMat(
      new THREE.SpriteMaterial({
        map: coreGlowTex,
        color: 0xffd56b,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    this.earthRoot.rotation.z = THREE.MathUtils.degToRad(11);
    this.scene.add(this.earthRoot);

    // =========================================================================
    // MODE 1: TELESCOPING HEMISPHERE CUTAWAY (Reference Images 1 & 2)
    // =========================================================================
    this.earthRoot.add(this.teleRoot);
    this.teleRoot.add(
      this.teleCrustGroup,
      this.teleMantleGroup,
      this.teleOuterCoreGroup,
      this.teleInnerCoreGroup,
      this.teleRightShellGroup,
    );

    const hemiSegW = lightweightTex ? 24 : 34;
    const hemiSegH = lightweightTex ? 18 : 26;
    const ringSegs = lightweightTex ? 28 : 42;

    // 1A. Crust Left Hemisphere + Craggy Rocky Collar
    const leftCrustMesh = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CRUST, hemiSegW, hemiSegH, -Math.PI / 2, Math.PI)),
      earthSurfaceMat,
    );
    leftCrustMesh.userData.layerId = 'surface';
    leftCrustMesh.castShadow = true;
    leftCrustMesh.receiveShadow = true;
    this.teleCrustGroup.add(leftCrustMesh);
    this.pickableTele.push(leftCrustMesh);

    const crustCollar = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(R_CRUST - 0.004, R_CRUST - 0.004, 0.14, ringSegs, 1, true)),
      crustRockMat,
    );
    crustCollar.rotation.z = Math.PI / 2;
    crustCollar.position.x = 0.068;
    crustCollar.userData.layerId = 'kerak';
    crustCollar.castShadow = true;
    crustCollar.receiveShadow = true;
    this.teleCrustGroup.add(crustCollar);
    this.pickableTele.push(crustCollar);

    const crustFaceCap = new THREE.Mesh(
      this.trackGeo(new THREE.RingGeometry(R_MANTLE - 0.01, R_CRUST - 0.004, ringSegs)),
      cutCrustMat,
    );
    crustFaceCap.rotation.y = Math.PI / 2;
    crustFaceCap.position.x = 0.138;
    crustFaceCap.userData.layerId = 'kerak';
    crustFaceCap.castShadow = true;
    crustFaceCap.receiveShadow = true;
    this.teleCrustGroup.add(crustFaceCap);
    this.pickableTele.push(crustFaceCap);

    const crustInnerBack = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_MANTLE + 0.01, hemiSegW, hemiSegH, -Math.PI / 2, Math.PI)),
      this.trackMat(
        new THREE.MeshStandardMaterial({
          map: crustRockTex.colorMap,
          roughness: 0.9,
          side: THREE.BackSide,
        }),
      ),
    );
    this.teleCrustGroup.add(crustInnerBack);

    this.teleCloudLeft = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CLOUDS, hemiSegW, hemiSegH, -Math.PI / 2, Math.PI)),
      cloudMat,
    );
    this.teleCloudLeft.renderOrder = 2;
    this.teleCrustGroup.add(this.teleCloudLeft);

    // 1B. Mantle Telescoping Hemisphere + Slowly Flowing Convection Face
    const mantleLeftHemi = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_MANTLE, hemiSegW, hemiSegH, -Math.PI / 2, Math.PI)),
      mantleShellMat,
    );
    mantleLeftHemi.userData.layerId = 'mantel';
    mantleLeftHemi.castShadow = true;
    mantleLeftHemi.receiveShadow = true;
    this.teleMantleGroup.add(mantleLeftHemi);
    this.pickableTele.push(mantleLeftHemi);

    const mantleCollar = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(R_MANTLE - 0.003, R_MANTLE - 0.003, 0.24, ringSegs, 1, true)),
      mantleShellMat,
    );
    mantleCollar.rotation.z = Math.PI / 2;
    mantleCollar.position.x = 0.12;
    mantleCollar.userData.layerId = 'mantel';
    mantleCollar.castShadow = true;
    mantleCollar.receiveShadow = true;
    this.teleMantleGroup.add(mantleCollar);
    this.pickableTele.push(mantleCollar);

    this.cutMantleFaceTele = new THREE.Mesh(
      this.trackGeo(new THREE.RingGeometry(R_OUTER_CORE - 0.01, R_MANTLE - 0.003, ringSegs)),
      cutMantleMat,
    );
    this.cutMantleFaceTele.rotation.y = Math.PI / 2;
    this.cutMantleFaceTele.position.x = 0.24;
    this.cutMantleFaceTele.userData.layerId = 'mantel';
    this.cutMantleFaceTele.castShadow = true;
    this.cutMantleFaceTele.receiveShadow = true;
    this.teleMantleGroup.add(this.cutMantleFaceTele);
    this.pickableTele.push(this.cutMantleFaceTele);

    const mantleInnerCavity = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(R_OUTER_CORE - 0.01, R_OUTER_CORE - 0.01, 0.26, ringSegs, 1, true)),
      this.trackMat(
        new THREE.MeshStandardMaterial({
          map: mantleTex.colorMap,
          roughness: 0.62,
          side: THREE.BackSide,
          emissive: new THREE.Color(0xea580c),
          emissiveIntensity: 0.45,
        }),
      ),
    );
    mantleInnerCavity.rotation.z = Math.PI / 2;
    mantleInnerCavity.position.x = 0.11;
    this.teleMantleGroup.add(mantleInnerCavity);

    // 1C. Outer Core Telescoping Hemisphere (Slow Swirling Liquid Metal)
    const outerCoreHemi = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_OUTER_CORE, hemiSegW, hemiSegH, -Math.PI / 2, Math.PI)),
      outerCoreShellMat,
    );
    outerCoreHemi.userData.layerId = 'inti-luar';
    outerCoreHemi.castShadow = true;
    outerCoreHemi.receiveShadow = true;
    this.teleOuterCoreGroup.add(outerCoreHemi);
    this.pickableTele.push(outerCoreHemi);

    const outerCoreCollar = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(R_OUTER_CORE - 0.002, R_OUTER_CORE - 0.002, 0.26, ringSegs, 1, true)),
      outerCoreShellMat,
    );
    outerCoreCollar.rotation.z = Math.PI / 2;
    outerCoreCollar.position.x = 0.13;
    outerCoreCollar.userData.layerId = 'inti-luar';
    outerCoreCollar.castShadow = true;
    outerCoreCollar.receiveShadow = true;
    this.teleOuterCoreGroup.add(outerCoreCollar);
    this.pickableTele.push(outerCoreCollar);

    this.cutOuterCoreFaceTele = new THREE.Mesh(
      this.trackGeo(new THREE.RingGeometry(R_INNER_CORE * 0.82, R_OUTER_CORE - 0.002, ringSegs)),
      cutOuterCoreMat,
    );
    this.cutOuterCoreFaceTele.rotation.y = Math.PI / 2;
    this.cutOuterCoreFaceTele.position.x = 0.26;
    this.cutOuterCoreFaceTele.userData.layerId = 'inti-luar';
    this.cutOuterCoreFaceTele.castShadow = true;
    this.cutOuterCoreFaceTele.receiveShadow = true;
    this.teleOuterCoreGroup.add(this.cutOuterCoreFaceTele);
    this.pickableTele.push(this.cutOuterCoreFaceTele);

    // 1D. Inner Core Solid Glowing Sphere + Soft Halo
    const teleInnerCoreSphere = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_INNER_CORE, 24, 18)),
      innerCoreMat,
    );
    teleInnerCoreSphere.userData.layerId = 'inti-dalam';
    teleInnerCoreSphere.castShadow = true;
    this.teleInnerCoreGroup.add(teleInnerCoreSphere);
    this.pickableTele.push(teleInnerCoreSphere);

    this.coreGlowSpriteTele = new THREE.Sprite(coreGlowSpriteMat);
    this.coreGlowSpriteTele.scale.set(1.9, 1.9, 1);
    this.coreGlowSpriteTele.renderOrder = 4;
    this.teleInnerCoreGroup.add(this.coreGlowSpriteTele);

    // 1E. Right Earth Hemisphere
    const rightCrustMesh = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CRUST, hemiSegW, hemiSegH, Math.PI / 2, Math.PI)),
      earthSurfaceMat,
    );
    rightCrustMesh.userData.layerId = 'surface';
    rightCrustMesh.castShadow = true;
    rightCrustMesh.receiveShadow = true;
    this.teleRightShellGroup.add(rightCrustMesh);
    this.pickableTele.push(rightCrustMesh);

    const rightInnerCap = new THREE.Mesh(
      this.trackGeo(new THREE.CircleGeometry(R_CRUST - 0.005, ringSegs)),
      cutMantleMat,
    );
    rightInnerCap.rotation.y = -Math.PI / 2;
    rightInnerCap.userData.layerId = 'mantel';
    rightInnerCap.receiveShadow = true;
    this.teleRightShellGroup.add(rightInnerCap);
    this.pickableTele.push(rightInnerCap);

    const rightCrustRim = new THREE.Mesh(
      this.trackGeo(new THREE.RingGeometry(R_MANTLE, R_CRUST - 0.003, ringSegs)),
      cutCrustMat,
    );
    rightCrustRim.rotation.y = -Math.PI / 2;
    rightCrustRim.position.x = -0.004;
    rightCrustRim.userData.layerId = 'kerak';
    this.teleRightShellGroup.add(rightCrustRim);

    this.teleCloudRight = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CLOUDS, hemiSegW, hemiSegH, Math.PI / 2, Math.PI)),
      cloudMat,
    );
    this.teleCloudRight.renderOrder = 2;
    this.teleRightShellGroup.add(this.teleCloudRight);

    const addTeleAnchor = (
      id: LayerId,
      label: string,
      parent: THREE.Object3D,
      pos: [number, number, number],
    ) => {
      const node = new THREE.Object3D();
      node.position.set(pos[0], pos[1], pos[2]);
      parent.add(node);
      this.labelAnchorsTele.push({ id, label, node });
    };
    addTeleAnchor('kerak', 'Kerak Bumi', this.teleCrustGroup, [0.1, 1.94, 0.35]);
    addTeleAnchor('mantel', 'Mantel Bumi', this.teleMantleGroup, [0.24, 1.48, 0.45]);
    addTeleAnchor('inti-luar', 'Inti Luar', this.teleOuterCoreGroup, [0.26, 0.88, 0.35]);
    addTeleAnchor('inti-dalam', 'Inti Dalam', this.teleInnerCoreGroup, [0.35, 0.0, 0.45]);

    // =========================================================================
    // MODE 2: 3-PLANE OCTANT 1/8 CUTAWAY (Reference Image 4)
    // =========================================================================
    this.earthRoot.add(this.octRoot);
    this.octRoot.add(this.octMainGroup, this.octWedgeGroup);

    const fullSegW = lightweightTex ? 30 : 42;
    const octSegH = lightweightTex ? 12 : 18;
    const octWedgeSeg = lightweightTex ? 12 : 18;
    const qRingSegs = lightweightTex ? 16 : 24;

    const octSouthMesh = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CRUST, fullSegW, octSegH, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
      earthSurfaceMat,
    );
    octSouthMesh.userData.layerId = 'surface';
    octSouthMesh.castShadow = true;
    octSouthMesh.receiveShadow = true;

    const octNorthMesh = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CRUST, Math.floor(fullSegW * 0.75), octSegH, Math.PI, Math.PI * 1.5, 0, Math.PI / 2)),
      earthSurfaceMat,
    );
    octNorthMesh.userData.layerId = 'surface';
    octNorthMesh.castShadow = true;
    octNorthMesh.receiveShadow = true;

    this.octMainGroup.add(octSouthMesh, octNorthMesh);
    this.pickableOct.push(octSouthMesh, octNorthMesh);

    this.octCloudSouth = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CLOUDS, fullSegW, octSegH, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
      cloudMat,
    );
    this.octCloudSouth.renderOrder = 2;
    this.octCloudNorth = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CLOUDS, Math.floor(fullSegW * 0.75), octSegH, Math.PI, Math.PI * 1.5, 0, Math.PI / 2)),
      cloudMat,
    );
    this.octCloudNorth.renderOrder = 2;
    this.octMainGroup.add(this.octCloudSouth, this.octCloudNorth);

    this.octInnerCoreMesh = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_INNER_CORE, 24, 18)),
      innerCoreMat,
    );
    this.octInnerCoreMesh.userData.layerId = 'inti-dalam';
    this.octInnerCoreMesh.castShadow = true;
    this.octMainGroup.add(this.octInnerCoreMesh);
    this.pickableOct.push(this.octInnerCoreMesh);

    this.coreGlowSpriteOct = new THREE.Sprite(coreGlowSpriteMat);
    this.coreGlowSpriteOct.scale.set(1.75, 1.75, 1);
    this.coreGlowSpriteOct.renderOrder = 4;
    this.octInnerCoreMesh.add(this.coreGlowSpriteOct);

    const octLayers: Array<{ id: LayerId; rIn: number; rOut: number; mat: THREE.MeshStandardMaterial }> = [
      { id: 'inti-luar', rIn: R_INNER_CORE, rOut: R_OUTER_CORE, mat: cutOuterCoreMat },
      { id: 'mantel', rIn: R_OUTER_CORE, rOut: R_MANTLE, mat: cutMantleMat },
      { id: 'kerak', rIn: R_MANTLE, rOut: R_CRUST - 0.003, mat: cutCrustMat },
    ];

    for (const l of octLayers) {
      const mZ = new THREE.Mesh(
        this.trackGeo(new THREE.RingGeometry(l.rIn, l.rOut, qRingSegs, 1, 0, Math.PI / 2)),
        l.mat,
      );
      mZ.userData.layerId = l.id;
      mZ.castShadow = true;
      mZ.receiveShadow = true;

      const mX = new THREE.Mesh(
        this.trackGeo(new THREE.RingGeometry(l.rIn, l.rOut, qRingSegs, 1, Math.PI / 2, Math.PI / 2)),
        l.mat,
      );
      mX.rotation.y = Math.PI / 2;
      mX.userData.layerId = l.id;
      mX.castShadow = true;
      mX.receiveShadow = true;

      const mY = new THREE.Mesh(
        this.trackGeo(new THREE.RingGeometry(l.rIn, l.rOut, qRingSegs, 1, -Math.PI / 2, Math.PI / 2)),
        l.mat,
      );
      mY.rotation.x = -Math.PI / 2;
      mY.userData.layerId = l.id;
      mY.castShadow = true;
      mY.receiveShadow = true;

      this.octMainGroup.add(mZ, mX, mY);
      this.pickableOct.push(mZ, mX, mY);

      const wZ = new THREE.Mesh(
        this.trackGeo(new THREE.RingGeometry(l.rIn, l.rOut, qRingSegs, 1, Math.PI / 2, Math.PI / 2)),
        l.mat,
      );
      wZ.rotation.y = Math.PI;
      wZ.userData.layerId = l.id;
      wZ.castShadow = true;
      wZ.receiveShadow = true;

      const wX = new THREE.Mesh(
        this.trackGeo(new THREE.RingGeometry(l.rIn, l.rOut, qRingSegs, 1, 0, Math.PI / 2)),
        l.mat,
      );
      wX.rotation.y = -Math.PI / 2;
      wX.userData.layerId = l.id;
      wX.castShadow = true;
      wX.receiveShadow = true;

      const wY = new THREE.Mesh(
        this.trackGeo(new THREE.RingGeometry(l.rIn, l.rOut, qRingSegs, 1, 0, Math.PI / 2)),
        l.mat,
      );
      wY.rotation.x = Math.PI / 2;
      wY.userData.layerId = l.id;
      wY.castShadow = true;
      wY.receiveShadow = true;

      this.octWedgeGroup.add(wZ, wX, wY);
      this.pickableOct.push(wZ, wX, wY);
    }

    const octWedgeCrust = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CRUST, octWedgeSeg, octSegH, Math.PI / 2, Math.PI / 2, 0, Math.PI / 2)),
      earthSurfaceMat,
    );
    octWedgeCrust.userData.layerId = 'kerak';
    octWedgeCrust.castShadow = true;
    octWedgeCrust.receiveShadow = true;
    this.octWedgeGroup.add(octWedgeCrust);
    this.pickableOct.push(octWedgeCrust);

    const octWedgeInnerCap = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_INNER_CORE + 0.015, 16, 12, Math.PI / 2, Math.PI / 2, 0, Math.PI / 2)),
      this.trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          roughness: 0.25,
          side: THREE.BackSide,
          emissive: new THREE.Color(0xf59e0b),
          emissiveIntensity: 0.7,
        }),
      ),
    );
    this.octWedgeGroup.add(octWedgeInnerCap);

    this.octCloudWedge = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(R_CLOUDS, octWedgeSeg, octSegH, Math.PI / 2, Math.PI / 2, 0, Math.PI / 2)),
      cloudMat,
    );
    this.octCloudWedge.renderOrder = 2;
    this.octWedgeGroup.add(this.octCloudWedge);

    const addOctAnchor = (id: LayerId, label: string, pos: [number, number, number]) => {
      const node = new THREE.Object3D();
      node.position.set(pos[0], pos[1], pos[2]);
      this.octMainGroup.add(node);
      this.labelAnchorsOct.push({ id, label, node });
    };
    addOctAnchor('kerak', 'Kerak Bumi', [1.45, 1.32, 0.04]);
    addOctAnchor('mantel', 'Mantel Bumi', [0.06, 1.48, 0.65]);
    addOctAnchor('inti-luar', 'Inti Luar', [0.64, 0.62, 0.06]);
    addOctAnchor('inti-dalam', 'Inti Dalam', [0.32, 0.26, 0.32]);

    this.buildSurfaceReliefFeatures();

    // Rayleigh Atmospheric Glow Halo
    const atmosGeo = this.trackGeo(new THREE.SphereGeometry(R_ATMOS, lightweightTex ? 26 : 34, lightweightTex ? 18 : 24));
    const atmosMat = this.trackMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        uniforms: {
          uColor: { value: new THREE.Color(0x38bdf8) },
          uIntensity: { value: 1.05 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPosition.xyz);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float rim = clamp(0.64 + dot(vNormal, vViewDir), 0.0, 1.0);
            float glow = pow(rim, 3.0) * uIntensity;
            gl_FragColor = vec4(uColor, glow);
          }
        `,
      }),
    );
    this.atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.atmosMesh.renderOrder = 3;
    this.earthRoot.add(this.atmosMesh);

    this.buildCompositeSatellite();

    // =========================================================================
    // MODE 3: INTERACTIVE 3D SURFACE COMPONENTS DIORAMA (Litosfer, Hidrosfer, Biosfer, Atmosfer)
    // =========================================================================
    this.surfaceDiorama = createSurfaceDiorama(maxAniso, lightweightTex);
    this.surfaceDiorama.highlightMaterials.forEach(({ id, mat }) => {
      this.registerLayerMaterial(id, mat);
    });
    this.scene.add(this.surfaceDiorama.root);
  }

  /**
   * Builds "Astro Bumi": a cute, friendly 10-part 3D composite procedural astronaut
   * floating gently in the lower-left camera margin (never blocking Earth!),
   * with blinking eyes, waving right arm, and Earth-pointing left hand.
   */
  private buildAstroBumiCharacter() {
    const suitWhite = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.34,
        metalness: 0.08,
        emissive: new THREE.Color(0x1e293b),
        emissiveIntensity: 0.22,
      }),
    );
    const suitNavy = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e3a8a,
        roughness: 0.45,
        metalness: 0.25,
        emissive: new THREE.Color(0x0f172a),
        emissiveIntensity: 0.2,
      }),
    );
    const suitAccentOrange = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.38,
        metalness: 0.2,
        emissive: new THREE.Color(0x9a3412),
        emissiveIntensity: 0.2,
      }),
    );
    const visorMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0b1530,
        roughness: 0.1,
        metalness: 0.8,
        emissive: new THREE.Color(0x0c244f),
        emissiveIntensity: 0.45,
      }),
    );
    const eyeGlowMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
      }),
    );

    // 1. Helmet shell
    const helmet = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.22, 14, 12)),
      suitWhite,
    );
    helmet.position.y = 0.28;

    // 2. Curved dark visor
    const visor = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.185, 16, 12, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.24, Math.PI * 0.52)),
      visorMat,
    );
    visor.position.set(0, 0.28, 0.065);
    visor.rotation.y = Math.PI / 2; // face +Z cleanly

    // 3. Cute blinking eyes inside visor
    const eyeGeo = this.trackGeo(new THREE.SphereGeometry(0.028, 10, 8));
    this.astroEyeLeft = new THREE.Mesh(eyeGeo, eyeGlowMat);
    this.astroEyeLeft.position.set(-0.065, 0.3, 0.215);
    this.astroEyeRight = new THREE.Mesh(eyeGeo, eyeGlowMat);
    this.astroEyeRight.position.set(0.065, 0.3, 0.215);

    // 4. Helmet ear pods & top antenna with cyan light tip
    const earGeo = this.trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10));
    const leftEar = new THREE.Mesh(earGeo, suitAccentOrange);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.22, 0.28, 0);
    const rightEar = new THREE.Mesh(earGeo, suitAccentOrange);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.22, 0.28, 0);

    const antennaRod = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.13, 6)),
      suitNavy,
    );
    antennaRod.position.set(0.08, 0.52, -0.02);
    antennaRod.rotation.z = -0.22;
    const antennaTip = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.028, 10, 8)),
      eyeGlowMat,
    );
    antennaTip.position.set(0.095, 0.59, -0.02);

    // 5. Spacesuit Torso & Chest Control Badge
    const torso = new THREE.Mesh(
      this.trackGeo(new THREE.CapsuleGeometry(0.145, 0.14, 8, 14)),
      suitWhite,
    );
    torso.position.y = -0.02;

    const chestPack = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.14, 0.1, 0.05)),
      suitNavy,
    );
    chestPack.position.set(0, 0.01, 0.13);

    const chestBtn = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.05, 0.028, 0.02)),
      suitAccentOrange,
    );
    chestBtn.position.set(0.025, 0.02, 0.155);

    // 6. Oxygen Backpack
    const backpack = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.2, 0.24, 0.12)),
      suitNavy,
    );
    backpack.position.set(0, 0.02, -0.15);

    // 7. Waving Arm (left side of screen, waves cheerfully!)
    const armGeo = this.trackGeo(new THREE.CapsuleGeometry(0.046, 0.13, 6, 10));
    const gloveGeo = this.trackGeo(new THREE.SphereGeometry(0.052, 10, 8));

    this.astroWaveArm.position.set(-0.17, 0.06, 0.02);
    const waveArmMesh = new THREE.Mesh(armGeo, suitWhite);
    waveArmMesh.position.set(-0.04, 0.07, 0);
    waveArmMesh.rotation.z = 0.45;
    const waveGlove = new THREE.Mesh(gloveGeo, suitAccentOrange);
    waveGlove.position.set(-0.085, 0.155, 0);
    this.astroWaveArm.add(waveArmMesh, waveGlove);

    // 8. Pointing Arm (points gently rightward toward the 3D Earth!)
    this.astroPointArm.position.set(0.17, 0.04, 0.03);
    const pointArmMesh = new THREE.Mesh(armGeo, suitWhite);
    pointArmMesh.position.set(0.08, -0.01, 0.03);
    pointArmMesh.rotation.z = -1.25;
    const pointGlove = new THREE.Mesh(gloveGeo, suitAccentOrange);
    pointGlove.position.set(0.17, -0.02, 0.05);
    this.astroPointArm.add(pointArmMesh, pointGlove);

    // 9 & 10. Floating Legs & Boots
    const legGeo = this.trackGeo(new THREE.CapsuleGeometry(0.052, 0.1, 6, 10));
    const bootGeo = this.trackGeo(new THREE.BoxGeometry(0.095, 0.065, 0.13));

    const leftLeg = new THREE.Mesh(legGeo, suitWhite);
    leftLeg.position.set(-0.075, -0.22, 0);
    leftLeg.rotation.x = 0.18;
    const leftBoot = new THREE.Mesh(bootGeo, suitNavy);
    leftBoot.position.set(-0.075, -0.31, 0.03);

    const rightLeg = new THREE.Mesh(legGeo, suitWhite);
    rightLeg.position.set(0.075, -0.22, -0.02);
    rightLeg.rotation.x = -0.15;
    const rightBoot = new THREE.Mesh(bootGeo, suitNavy);
    rightBoot.position.set(0.075, -0.31, 0.0);

    this.astroBody.add(
      helmet,
      visor,
      this.astroEyeLeft,
      this.astroEyeRight,
      leftEar,
      rightEar,
      antennaRod,
      antennaTip,
      torso,
      chestPack,
      chestBtn,
      backpack,
      this.astroWaveArm,
      this.astroPointArm,
      leftLeg,
      leftBoot,
      rightLeg,
      rightBoot,
    );

    // No extra PointLight here (saves a full per-pixel PointLight loop across every PBR material!)
    this.astroRoot.add(this.astroBody);

    this.astroRoot.rotation.y = 0.34; // angled slightly toward Earth
    this.camera.add(this.astroRoot);
    this.positionAstroBumi();
  }

  private positionAstroBumi() {
    const aspect = Math.max(0.45, this.camera.aspect);
    const z = -5.2;
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * Math.abs(z);
    const halfW = halfH * aspect;

    if (this.isMobile) {
      // Polite upper-left margin below header on narrow mobile so centered Earth & bottom bubble stay 100% clear
      this.astroRoot.position.set(-halfW * 0.72, halfH * 0.62, z);
      this.astroRoot.scale.setScalar(0.45);
    } else {
      // Far lower-left corner on tablet/laptop/PID pointing smoothly toward the bottom thought bubble
      this.astroRoot.position.set(-halfW * 0.86, -halfH * 0.56, z);
      this.astroRoot.scale.setScalar(0.68);
    }
    this.astroRoot.visible = this.astroVisible;
  }

  private buildSurfaceReliefFeatures() {
    const teleLeftTrees: THREE.Matrix4[] = [];
    const teleRightTrees: THREE.Matrix4[] = [];
    const teleLeftMtns: THREE.Matrix4[] = [];
    const teleRightMtns: THREE.Matrix4[] = [];

    const octMainTrees: THREE.Matrix4[] = [];
    const octWedgeTrees: THREE.Matrix4[] = [];
    const octMainMtns: THREE.Matrix4[] = [];
    const octWedgeMtns: THREE.Matrix4[] = [];

    const sampleCount = this.ecoMode ? 200 : 280;
    for (let i = 0; i < sampleCount; i++) {
      const y = 1 - (i / (sampleCount - 1)) * 2;
      const latDeg = Math.asin(Math.max(-0.9, Math.min(0.9, y))) * (180 / Math.PI);
      const lonDeg = (((i * 137.508) % 360) + 360) % 360 - 180;

      if (Math.abs(latDeg) > 64) continue;
      const elev = sampleEarthElevation(latDeg, lonDeg);
      if (elev <= 0.1) continue;

      const { phi, theta } = latLonToSpherePos(latDeg, lonDeg, R_CRUST - 0.008, _v3);
      const normal = _v3.clone().normalize();
      _quat.setFromUnitVectors(_up, normal);
      _scale.setScalar(0.8 + ((i * 29) % 100) / 340);
      const mat = new THREE.Matrix4().compose(_v3, _quat, _scale);

      const isMtn = elev > 0.25;

      if (Math.abs(_v3.x) > 0.14) {
        if (_v3.x < 0) {
          if (isMtn) teleLeftMtns.push(mat);
          else teleLeftTrees.push(mat);
        } else {
          if (isMtn) teleRightMtns.push(mat);
          else teleRightTrees.push(mat);
        }
      }

      const nearSeam =
        Math.abs(phi - Math.PI / 2) < 0.06 ||
        Math.abs(phi - Math.PI) < 0.06 ||
        (phi > Math.PI / 2 && phi < Math.PI && Math.abs(theta - Math.PI / 2) < 0.06);
      if (!nearSeam) {
        const inOctWedge = phi > Math.PI / 2 && phi < Math.PI && theta < Math.PI / 2;
        if (inOctWedge) {
          if (isMtn) octWedgeMtns.push(mat);
          else octWedgeTrees.push(mat);
        } else {
          if (isMtn) octMainMtns.push(mat);
          else octMainTrees.push(mat);
        }
      }
    }

    const canopyGeo = this.trackGeo(new THREE.ConeGeometry(0.04, 0.105, 6));
    canopyGeo.translate(0, 0.068, 0);
    const trunkGeo = this.trackGeo(new THREE.CylinderGeometry(0.011, 0.014, 0.036, 5));
    trunkGeo.translate(0, 0.018, 0);

    const canopyMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        roughness: 0.78,
        metalness: 0.02,
      }),
    );
    this.registerLayerMaterial('biosfer', canopyMat);

    const trunkMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x78350f,
        roughness: 0.92,
      }),
    );

    const mtnGeo = this.trackGeo(new THREE.ConeGeometry(0.062, 0.125, 5));
    mtnGeo.translate(0, 0.056, 0);
    const mtnMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x9a7b5c,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    this.registerLayerMaterial('litosfer', mtnMat);

    const spawnTrees = (
      transforms: THREE.Matrix4[],
      parent: THREE.Group,
      pickList: THREE.Object3D[],
    ) => {
      if (transforms.length === 0) return;
      const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, transforms.length);
      const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, transforms.length);
      canopy.userData.layerId = 'biosfer';
      for (let i = 0; i < transforms.length; i++) {
        canopy.setMatrixAt(i, transforms[i]);
        trunk.setMatrixAt(i, transforms[i]);
        _color.setHSL(0.34 + (i % 5) * 0.018, 0.6, 0.3 + (i % 4) * 0.04);
        canopy.setColorAt(i, _color);
      }
      canopy.instanceMatrix.needsUpdate = true;
      trunk.instanceMatrix.needsUpdate = true;
      if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
      canopy.computeBoundingSphere();
      trunk.computeBoundingSphere();
      parent.add(canopy, trunk);
      pickList.push(canopy);
    };

    const spawnMtns = (
      transforms: THREE.Matrix4[],
      parent: THREE.Group,
      pickList: THREE.Object3D[],
    ) => {
      if (transforms.length === 0) return;
      const mtn = new THREE.InstancedMesh(mtnGeo, mtnMat, transforms.length);
      mtn.userData.layerId = 'litosfer';
      for (let i = 0; i < transforms.length; i++) {
        mtn.setMatrixAt(i, transforms[i]);
        _color.setHSL(0.08 + (i % 4) * 0.01, 0.25, 0.42 + (i % 3) * 0.07);
        mtn.setColorAt(i, _color);
      }
      mtn.instanceMatrix.needsUpdate = true;
      if (mtn.instanceColor) mtn.instanceColor.needsUpdate = true;
      mtn.computeBoundingSphere();
      parent.add(mtn);
      pickList.push(mtn);
    };

    spawnTrees(teleLeftTrees, this.teleCrustGroup, this.pickableTele);
    spawnTrees(teleRightTrees, this.teleRightShellGroup, this.pickableTele);
    spawnMtns(teleLeftMtns, this.teleCrustGroup, this.pickableTele);
    spawnMtns(teleRightMtns, this.teleRightShellGroup, this.pickableTele);

    spawnTrees(octMainTrees, this.octMainGroup, this.pickableOct);
    spawnTrees(octWedgeTrees, this.octWedgeGroup, this.pickableOct);
    spawnMtns(octMainMtns, this.octMainGroup, this.pickableOct);
    spawnMtns(octWedgeMtns, this.octWedgeGroup, this.pickableOct);
  }

  private buildCompositeSatellite() {
    this.satellitePivot.rotation.x = 0.34;
    this.satellitePivot.rotation.z = -0.22;
    this.scene.add(this.satellitePivot);

    this.satelliteGroup.position.set(2.68, 0, 0);
    this.satellitePivot.add(this.satelliteGroup);

    const busMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.85,
        roughness: 0.22,
      }),
    );
    this.registerLayerMaterial('atmosfer', busMat);
    const bus = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.062, 0.062, 0.135, 6)),
      busMat,
    );
    bus.userData.layerId = 'atmosfer';

    const solarMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        metalness: 0.55,
        roughness: 0.18,
        emissive: new THREE.Color(0x1e3a8a),
        emissiveIntensity: 0.25,
      }),
    );
    const wingGeo = this.trackGeo(new THREE.BoxGeometry(0.24, 0.008, 0.082));
    const leftWing = new THREE.Mesh(wingGeo, solarMat);
    leftWing.position.set(-0.18, 0, 0);
    leftWing.userData.layerId = 'atmosfer';

    const rightWing = new THREE.Mesh(wingGeo, solarMat);
    rightWing.position.set(0.18, 0, 0);
    rightWing.userData.layerId = 'atmosfer';

    const strutMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.82,
        roughness: 0.26,
      }),
    );
    const strut = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.44, 6)),
      strutMat,
    );
    strut.rotation.z = Math.PI / 2;
    strut.userData.layerId = 'atmosfer';

    const dishPoints = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.028, 0.006),
      new THREE.Vector2(0.054, 0.024),
    ];
    const dish = new THREE.Mesh(
      this.trackGeo(new THREE.LatheGeometry(dishPoints, 14)),
      strutMat,
    );
    dish.position.set(-0.072, -0.02, 0);
    dish.rotation.z = -Math.PI / 2;
    dish.userData.layerId = 'atmosfer';

    this.satelliteGroup.add(bus, leftWing, rightWing, strut, dish);
    this.pickableShared.push(bus, leftWing, rightWing);
  }

  private applyCutawayModeVisibility() {
    const isSurface = this.cutawayMode === 'permukaan';
    this.earthRoot.visible = !isSurface;
    this.satellitePivot.visible = !isSurface;
    this.holoGraticule.visible = !isSurface;
    this.teleRoot.visible = this.cutawayMode === 'teleskop';
    this.octRoot.visible = this.cutawayMode === 'oktan';
    if (this.surfaceDiorama) {
      this.surfaceDiorama.root.visible = isSurface;
    }
  }

  // --- PUBLIC CONTROLS API ---

  public setAstroVisible(visible: boolean) {
    this.astroVisible = visible;
    this.astroRoot.visible = visible;
  }

  public triggerAstroWave() {
    this.astroWaveBoost = 1.0;
  }

  public setEcoMode(enabled: boolean) {
    if (this.ecoMode === enabled) return;
    this.ecoMode = enabled;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(this.computeOptimalPixelRatio(width, height));
    this.renderer.setSize(width, height);
    this.shadowsDirty = true;
  }

  public setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.frameId);
      window.clearTimeout(this.frameId);
    } else if (!this.disposed && !document.hidden) {
      this.clock.getDelta(); // discard paused time jump
      this.tick();
    }
  }

  public setCutawayMode(mode: CutawayMode) {
    if (this.cutawayMode === mode) return;
    this.cutawayMode = mode;
    this.activeAtmosSubId = null;
    this.applyCutawayModeVisibility();
    this.shadowsDirty = true;

    const dist = this.isMobile ? 8.6 : 7.3;
    if (mode === 'permukaan') {
      this.cameraTargetGoal.set(0, 0.32, 0);
      this.cameraGoalPos.set(dist * 0.44, dist * 0.42, dist * 0.88);
    } else if (mode === 'teleskop') {
      this.cameraTargetGoal.set(0, 0, 0);
      this.cameraGoalPos.set(dist * 0.56, dist * 0.22, dist * 0.8);
    } else {
      this.cameraTargetGoal.set(0, 0, 0);
      this.cameraGoalPos.set(dist * 0.62, dist * 0.5, dist * 0.6);
    }
    this.cameraTransitionActive = true;
    this.desiredZoomDistance = null;
  }

  public setCutaway(amount: number) {
    this.stopLayerTourAnimation();
    this.targetCutaway = THREE.MathUtils.clamp(amount, 0, 1);
    this.shadowsDirty = true;
  }

  public setAutoRotate(enabled: boolean) {
    this.autoRotateEnabled = enabled;
    this.controls.autoRotate = !this.isSoftwareGl && enabled;
  }

  public setShadowsEnabled(enabled: boolean) {
    this.shadowsEnabled = enabled;
    const allow = !this.isSoftwareGl && enabled;
    this.renderer.shadowMap.enabled = allow;
    this.sunLight.castShadow = allow;
    this.shadowsDirty = allow;
    this.renderer.shadowMap.needsUpdate = allow;
  }

  public zoomBy(deltaDistance: number) {
    this.cameraTransitionActive = false;
    const currentDist = this.camera.position.distanceTo(this.controls.target);
    const base = this.desiredZoomDistance ?? currentDist;
    this.desiredZoomDistance = THREE.MathUtils.clamp(
      base + deltaDistance,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
  }

  public resetView() {
    this.stopLayerTourAnimation();
    this.activeLayerId = null;
    this.activeAtmosSubId = null;
    this.updateLayerHighlights(0);
    const dist = this.isMobile ? 8.6 : 7.3;
    if (this.cutawayMode === 'permukaan') {
      this.targetCutaway = 0.22;
      this.cameraTargetGoal.set(0, 0.32, 0);
      this.cameraGoalPos.set(dist * 0.44, dist * 0.42, dist * 0.88);
    } else {
      this.cameraTargetGoal.set(0, 0, 0);
      this.targetCutaway = 0.68;
      if (this.cutawayMode === 'teleskop') {
        this.cameraGoalPos.set(dist * 0.56, dist * 0.22, dist * 0.8);
      } else {
        this.cameraGoalPos.set(dist * 0.62, dist * 0.5, dist * 0.6);
      }
    }
    this.cameraTransitionActive = true;
    this.desiredZoomDistance = null;
  }

  public focusLayer(layerId: LayerId, applyRecommendedCutaway = true) {
    const info = LAYER_MAP[layerId];
    if (!info) return;

    this.stopLayerTourAnimation();
    this.activeLayerId = layerId;
    this.activeAtmosSubId = null;
    this.triggerAstroWave();
    this.cameraTargetGoal.set(0, 0, 0);

    const mobileScale = this.isMobile ? 1.18 : 1.0;

    if (info.category === 'komponen-bumi') {
      if (this.cutawayMode !== 'permukaan') {
        this.cutawayMode = 'permukaan';
        this.applyCutawayModeVisibility();
        this.shadowsDirty = true;
      }
      if (layerId === 'litosfer') {
        if (applyRecommendedCutaway) this.targetCutaway = 0.15;
        this.cameraTargetGoal.set(-1.25, 0.12, -0.1);
        this.cameraGoalPos.set(-3.1 * mobileScale, 2.2 * mobileScale, 4.35 * mobileScale);
      } else if (layerId === 'hidrosfer') {
        if (applyRecommendedCutaway) this.targetCutaway = 0.22;
        this.cameraTargetGoal.set(1.25, -0.2, 0.15);
        this.cameraGoalPos.set(3.3 * mobileScale, 1.95 * mobileScale, 4.25 * mobileScale);
      } else if (layerId === 'biosfer') {
        if (applyRecommendedCutaway) this.targetCutaway = 0.18;
        this.cameraTargetGoal.set(-0.22, 0.04, 0.45);
        this.cameraGoalPos.set(0.85 * mobileScale, 1.8 * mobileScale, 4.35 * mobileScale);
      } else {
        // atmosfer: lift strata bands and shift lookAt slightly right so all 4 right-side labels are fully visible
        if (applyRecommendedCutaway) this.targetCutaway = 0.76;
        this.cameraTargetGoal.set(0.95, 1.78, 0.1);
        this.cameraGoalPos.set(0.45 * mobileScale, 2.35 * mobileScale, 7.8 * mobileScale);
      }
      this.updateLayerHighlights(0);
      this.cameraTransitionActive = true;
      this.desiredZoomDistance = null;
      return;
    }

    // Internal layers: switch back from permukaan to teleskop if needed
    if (this.cutawayMode === 'permukaan') {
      this.cutawayMode = 'teleskop';
      this.applyCutawayModeVisibility();
      this.shadowsDirty = true;
    }

    this.updateLayerHighlights(0);

    if (applyRecommendedCutaway) {
      this.targetCutaway = info.camera.recommendedCutaway;
    }

    const dist = this.isMobile ? info.camera.distance * 1.15 : info.camera.distance;
    const { azimuth, polar } = info.camera;

    if (this.cutawayMode === 'teleskop' && info.category === 'lapisan-dalam') {
      if (layerId === 'kerak') {
        this.cameraTargetGoal.set(-0.18, 0.34, 0.1);
        this.cameraGoalPos.set(dist * 0.62, dist * 0.32, dist * 0.64);
      } else if (layerId === 'mantel') {
        this.cameraTargetGoal.set(0.06, 0.2, 0.1);
        this.cameraGoalPos.set(dist * 0.76, dist * 0.2, dist * 0.56);
      } else if (layerId === 'inti-luar') {
        this.cameraTargetGoal.set(0.32, 0.08, 0.08);
        this.cameraGoalPos.set(dist * 0.84, dist * 0.12, dist * 0.48);
      } else {
        this.cameraTargetGoal.set(0.66, 0.0, 0.06);
        this.cameraGoalPos.set(dist * 0.9, dist * 0.06, dist * 0.42);
      }
    } else {
      this.cameraGoalPos.set(
        dist * Math.sin(polar) * Math.sin(azimuth),
        dist * Math.cos(polar),
        dist * Math.sin(polar) * Math.cos(azimuth),
      );
    }
    this.cameraTransitionActive = true;
    this.desiredZoomDistance = null;
  }

  public setActiveLayerHighlight(layerId: LayerId | null) {
    this.activeLayerId = layerId;
    if (layerId !== 'atmosfer') {
      this.activeAtmosSubId = null;
    }
    this.updateLayerHighlights(0);
  }

  public setActiveAtmosSubLayer(subId: AtmosSubLayerId | null) {
    this.activeAtmosSubId = subId;
    if (subId) {
      this.activeLayerId = 'atmosfer';
    }
    this.updateLayerHighlights(0);
  }

  /**
   * Smoothly opens the 4 atmospheric strata bands and glides the 3D camera
   * directly to the selected atmospheric layer (Troposfer -> Termosfer).
   */
  public focusAtmosSubLayer(subId: AtmosSubLayerId) {
    this.stopLayerTourAnimation();
    if (this.cutawayMode !== 'permukaan') {
      this.cutawayMode = 'permukaan';
      this.applyCutawayModeVisibility();
      this.shadowsDirty = true;
    }
    this.activeLayerId = 'atmosfer';
    this.activeAtmosSubId = subId;
    this.targetCutaway = 0.72;
    this.triggerAstroWave();

    const mobileScale = this.isMobile ? 1.2 : 1.0;
    const focusYBySub: Record<AtmosSubLayerId, number> = {
      troposfer: 0.92,
      stratosfer: 1.56,
      mesosfer: 2.24,
      termosfer: 2.86,
    };
    const ty = focusYBySub[subId];
    // Shift lookAt target right (+1.05) so the 3D layers sit left-center and full right-side labels are unobstructed
    this.cameraTargetGoal.set(1.05, ty, 0.12);
    this.cameraGoalPos.set(
      0.55 * mobileScale,
      ty + 0.55 * mobileScale,
      7.15 * mobileScale,
    );
    this.updateLayerHighlights(0);
    this.cameraTransitionActive = true;
    this.desiredZoomDistance = null;
  }

  /**
   * Synchronizes the 3D cutaway, camera framing, lookAt target, label reveal,
   * and glowing highlight directly to the active audio-guided tour chapter.
   */
  public setTourStage(stage: TourStage) {
    this.tourStage = stage;
    this.activeAtmosSubId = null;
    this.desiredZoomDistance = null;
    this.shadowsDirty = true;

    if (stage === 'idle') {
      this.tourRunning = false;
      this.tourRevealedCount = 4;
      this.activeLayerId = null;
      this.updateLayerHighlights(0);
      this.controls.autoRotate = !this.isSoftwareGl && this.autoRotateEnabled;
      this.callbacks.onTourStageChange?.('idle', this.targetCutaway);
      return;
    }

    if (stage === 'done') {
      this.tourRunning = false;
      this.tourRevealedCount = 4;
      this.activeLayerId = null;
      this.updateLayerHighlights(0);
      this.controls.autoRotate = !this.isSoftwareGl && this.autoRotateEnabled;
      const dist = this.isMobile ? 8.6 : 7.3;
      if (this.cutawayMode === 'permukaan') {
        this.targetCutaway = 0.25;
        this.cameraTargetGoal.set(0, 0.32, 0);
        this.cameraGoalPos.set(dist * 0.44, dist * 0.42, dist * 0.88);
      } else {
        this.targetCutaway = 1.0;
        this.cameraTargetGoal.set(0, 0, 0);
        this.cameraGoalPos.set(dist * 0.56, dist * 0.22, dist * 0.8);
      }
      this.cameraTransitionActive = true;
      this.callbacks.onTourStageChange?.('done', this.targetCutaway);
      return;
    }

    const isAtmosTourStage =
      stage === 'atmos-intro' ||
      stage === 'troposfer' ||
      stage === 'stratosfer' ||
      stage === 'mesosfer' ||
      stage === 'termosfer';

    const isSurfaceStage =
      stage === 'surface-intro' ||
      stage === 'litosfer' ||
      stage === 'hidrosfer' ||
      stage === 'biosfer' ||
      stage === 'atmosfer' ||
      isAtmosTourStage;

    this.tourRunning = true;
    this.controls.autoRotate = false;
    const mobileScale = this.isMobile ? 1.18 : 1.0;

    if (isAtmosTourStage) {
      if (this.cutawayMode !== 'permukaan') {
        this.cutawayMode = 'permukaan';
        this.applyCutawayModeVisibility();
      }
      this.targetCutaway = 0.78;
      this.tourRevealedCount = 4;
      this.activeLayerId = 'atmosfer';

      if (stage === 'atmos-intro') {
        this.activeAtmosSubId = null;
        this.cameraTargetGoal.set(0.95, 1.62, 0.1);
        this.cameraGoalPos.set(0.45 * mobileScale, 2.25 * mobileScale, 8.2 * mobileScale);
      } else {
        this.activeAtmosSubId = stage;
        const focusYBySub: Record<AtmosSubLayerId, number> = {
          troposfer: 0.82,
          stratosfer: 1.48,
          mesosfer: 2.16,
          termosfer: 2.78,
        };
        const ty = focusYBySub[stage];
        this.cameraTargetGoal.set(1.05, ty, 0.12);
        this.cameraGoalPos.set(
          0.5 * mobileScale,
          ty + 0.52 * mobileScale,
          7.35 * mobileScale,
        );
      }
    } else if (isSurfaceStage) {
      if (this.cutawayMode !== 'permukaan') {
        this.cutawayMode = 'permukaan';
        this.applyCutawayModeVisibility();
      }
      if (stage === 'surface-intro') {
        this.targetCutaway = 0.22;
        this.tourRevealedCount = 4;
        this.activeLayerId = null;
        this.cameraTargetGoal.set(0.35, 0.15, 0);
        this.cameraGoalPos.set(2.45 * mobileScale, 3.15 * mobileScale, 7.65 * mobileScale);
      } else if (stage === 'litosfer') {
        this.targetCutaway = 0.14;
        this.tourRevealedCount = 1;
        this.activeLayerId = 'litosfer';
        this.cameraTargetGoal.set(-1.25, -0.12, -0.1);
        this.cameraGoalPos.set(-3.45 * mobileScale, 2.35 * mobileScale, 4.95 * mobileScale);
      } else if (stage === 'hidrosfer') {
        this.targetCutaway = 0.22;
        this.tourRevealedCount = 2;
        this.activeLayerId = 'hidrosfer';
        this.cameraTargetGoal.set(1.25, -0.4, 0.15);
        this.cameraGoalPos.set(3.65 * mobileScale, 2.1 * mobileScale, 4.85 * mobileScale);
      } else if (stage === 'biosfer') {
        this.targetCutaway = 0.18;
        this.tourRevealedCount = 3;
        this.activeLayerId = 'biosfer';
        this.cameraTargetGoal.set(-0.22, -0.18, 0.45);
        this.cameraGoalPos.set(0.95 * mobileScale, 1.95 * mobileScale, 4.95 * mobileScale);
      } else if (stage === 'atmosfer') {
        this.targetCutaway = 0.78;
        this.tourRevealedCount = 4;
        this.activeLayerId = 'atmosfer';
        this.cameraTargetGoal.set(0.95, 1.62, 0.1);
        this.cameraGoalPos.set(0.45 * mobileScale, 2.25 * mobileScale, 8.2 * mobileScale);
      }
    } else {
      // Active internal guided chapter: switch to Telescoping mode so stepped layers are unmistakable
      if (this.cutawayMode !== 'teleskop') {
        this.cutawayMode = 'teleskop';
        this.applyCutawayModeVisibility();
      }

      if (stage === 'whole') {
        this.targetCutaway = 1.0;
        this.tourRevealedCount = 4;
        this.activeLayerId = null;
        const dist = 8.2 * mobileScale;
        this.cameraTargetGoal.set(0.08, -0.26, 0);
        this.cameraGoalPos.set(dist * 0.62, dist * 0.22, dist * 0.76);
      } else if (stage === 'kerak') {
        this.targetCutaway = 1.0;
        this.tourRevealedCount = 1;
        this.activeLayerId = 'kerak';
        const dist = 7.1 * mobileScale;
        this.cameraTargetGoal.set(-0.34, 0.04, 0.1);
        this.cameraGoalPos.set(dist * 0.56, dist * 0.3, dist * 0.7);
      } else if (stage === 'mantel') {
        this.targetCutaway = 1.0;
        this.tourRevealedCount = 2;
        this.activeLayerId = 'mantel';
        const dist = 6.7 * mobileScale;
        this.cameraTargetGoal.set(0.04, -0.08, 0.1);
        this.cameraGoalPos.set(dist * 0.76, dist * 0.18, dist * 0.56);
      } else if (stage === 'inti-luar') {
        this.targetCutaway = 1.0;
        this.tourRevealedCount = 3;
        this.activeLayerId = 'inti-luar';
        const dist = 6.2 * mobileScale;
        this.cameraTargetGoal.set(0.38, -0.18, 0.08);
        this.cameraGoalPos.set(dist * 0.86, dist * 0.1, dist * 0.46);
      } else if (stage === 'inti-dalam') {
        this.targetCutaway = 1.0;
        this.tourRevealedCount = 4;
        this.activeLayerId = 'inti-dalam';
        const dist = 5.75 * mobileScale;
        this.cameraTargetGoal.set(0.7, -0.22, 0.06);
        this.cameraGoalPos.set(dist * 0.92, dist * 0.06, dist * 0.38);
      }
    }

    this.updateLayerHighlights(0);
    this.triggerAstroWave();
    this.cameraTransitionActive = true;
    this.callbacks.onTourStageChange?.(stage, this.targetCutaway);
  }

  public playLayerTourAnimation() {
    this.setTourStage(this.cutawayMode === 'permukaan' ? 'surface-intro' : 'whole');
  }

  public stopLayerTourAnimation() {
    if (!this.tourRunning && this.tourStage === 'idle') return;
    this.setTourStage('idle');
  }

  private advanceLayerTour(dt: number) {
    if (!this.tourRunning) return;
    if (this.cutawayMode === 'permukaan') {
      if (this.tourStage === 'surface-intro') {
        this.surfaceDiorama.root.rotation.y = Math.sin(this.clock.getElapsedTime() * 0.35) * 0.16;
      } else {
        this.surfaceDiorama.root.rotation.y = THREE.MathUtils.damp(
          this.surfaceDiorama.root.rotation.y,
          0,
          4.5,
          dt,
        );
      }
      return;
    }
    if (this.tourStage === 'whole') {
      // Gently sway the 100%-open cutaway facing forward so all 4 layers remain clearly visible
      const targetSway = Math.sin(this.clock.getElapsedTime() * 0.42) * 0.2;
      const currentY = ((this.earthRoot.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.earthRoot.rotation.y = THREE.MathUtils.damp(currentY, targetSway, 3.2, dt);
    } else {
      // Smoothly align cutaway face directly toward camera during layer explanations
      const currentY = ((this.earthRoot.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.earthRoot.rotation.y = THREE.MathUtils.damp(currentY, 0, 4.5, dt);
    }
  }

  private updateLayerHighlights(elapsed: number) {
    const activeMats = this.activeLayerId
      ? this.layerHighlightMaterials.get(this.activeLayerId)
      : undefined;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);

    this.baseEmissiveIntensity.forEach((baseVal, mat) => {
      const isHighlighted = activeMats ? activeMats.includes(mat) : false;
      if (isHighlighted) {
        // Luminous pulsing spotlight glow on the currently explained/selected layer!
        const boost = this.tourRunning ? 0.55 + pulse * 0.45 : 0.36 + pulse * 0.24;
        mat.emissiveIntensity = Math.min(2.1, baseVal + boost);
      } else if (this.tourRunning && this.activeLayerId) {
        // Softly dim surrounding layers during guided tour so explained layer pops unmistakably
        mat.emissiveIntensity = baseVal * 0.42;
      } else {
        mat.emissiveIntensity = baseVal;
      }
    });
  }

  // --- POINTER & RAYCAST INTERACTION ---

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos.x = e.clientX;
    this.pointerDownPos.y = e.clientY;
    this.isDraggingPointer = false;
  };

  private handlePointerMove = (e: PointerEvent) => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) {
      this.isDraggingPointer = true;
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.isDraggingPointer) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    const activePickables =
      this.cutawayMode === 'permukaan'
        ? this.surfaceDiorama.pickables
        : this.cutawayMode === 'teleskop'
          ? this.pickableTeleAll
          : this.pickableOctAll;

    const hits = this.raycaster.intersectObjects(activePickables, false);
    if (hits.length === 0) return;

    const hit = hits[0];
    const atmosSubId = hit.object.userData.atmosSubId as AtmosSubLayerId | undefined;
    if (this.cutawayMode === 'permukaan' && atmosSubId) {
      this.focusAtmosSubLayer(atmosSubId);
      this.callbacks.onSelectAtmosSubLayer?.(atmosSubId);
      return;
    }

    const rawId = hit.object.userData.layerId as LayerId | 'surface' | undefined;
    if (!rawId) return;

    let resolvedId: LayerId;
    if (rawId === 'surface' && hit.uv) {
      const lonDeg = hit.uv.x * 360 - 180;
      const latDeg = hit.uv.y * 180 - 90;
      const elev = sampleEarthElevation(latDeg, lonDeg);
      resolvedId = elev > 0.02 ? 'kerak' : 'hidrosfer';
    } else if (rawId === 'surface') {
      resolvedId = 'kerak';
    } else {
      resolvedId = rawId;
    }

    this.stopLayerTourAnimation();
    this.activeAtmosSubId = null;
    this.activeLayerId = resolvedId;
    this.updateLayerHighlights(0);
    this.triggerAstroWave();
    this.callbacks.onSelectLayer(resolvedId);
  };

  private handleVisibilityChange = () => {
    if (this.disposed) return;
    if (document.hidden) {
      cancelAnimationFrame(this.frameId);
      window.clearTimeout(this.frameId);
    } else if (!this.paused) {
      this.clock.getDelta();
      this.tick();
    }
  };

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.isMobile = width < 768;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.computeOptimalPixelRatio(width, height));
    this.renderer.setSize(width, height);
    this.positionAstroBumi();
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.callbacks.onWebGLContextLost?.();
  };

  private handleContextRestored = () => {
    this.callbacks.onWebGLContextRestored?.();
    this.shadowsDirty = true;
    this.clock.start();
    if (!this.paused && !document.hidden) {
      this.tick();
    }
  };

  private updateProjectedLabels() {
    if (!this.callbacks.onProjectLabels) return;
    const isSurface = this.cutawayMode === 'permukaan';
    const anchors = isSurface
      ? this.surfaceDiorama.labelAnchors
      : this.cutawayMode === 'teleskop'
        ? this.labelAnchorsTele
        : this.labelAnchorsOct;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const show = isSurface ? true : this.currentCutaway > 0.2;

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const target = this.labelBuffer[i];
      target.layerId = a.id;
      target.label = a.label;

      if (!show || i >= this.tourRevealedCount) {
        target.visible = false;
        continue;
      }

      a.node.getWorldPosition(_projVec);
      _projVec.project(this.camera);

      const inFront = _projVec.z >= -1 && _projVec.z <= 1;
      const sx = ((_projVec.x + 1) * 0.5) * width;
      const sy = ((-_projVec.y + 1) * 0.5) * height;
      const insideBounds = sx > 24 && sx < width - 24 && sy > 52 && sy < height - 115;

      target.x = sx;
      target.y = sy;
      target.visible = inFront && insideBounds;
    }

    this.callbacks.onProjectLabels(this.labelBuffer);

    // Project the 4 stratified 3D atmospheric layer explanations (Troposfer -> Termosfer)
    if (this.callbacks.onProjectAtmosLabels) {
      const showAtmosStrata =
        isSurface &&
        (!this.tourRunning ||
          this.tourStage === 'surface-intro' ||
          this.tourStage === 'atmosfer' ||
          this.tourStage === 'atmos-intro' ||
          this.tourStage === 'troposfer' ||
          this.tourStage === 'stratosfer' ||
          this.tourStage === 'mesosfer' ||
          this.tourStage === 'termosfer');
      const atmosAnchors = this.surfaceDiorama.atmosLabelAnchors;

      for (let i = 0; i < atmosAnchors.length; i++) {
        const a = atmosAnchors[i];
        const target = this.atmosLabelBuffer[i];
        target.id = a.id;

        if (!showAtmosStrata) {
          target.visible = false;
          continue;
        }

        a.node.getWorldPosition(_projVec);
        _projVec.project(this.camera);

        const inFront = _projVec.z >= -1 && _projVec.z <= 1;
        const sx = ((_projVec.x + 1) * 0.5) * width;
        const sy = ((-_projVec.y + 1) * 0.5) * height;
        const insideBounds = sx > 8 && sx < width - 8 && sy > 36 && sy < height - 104;

        target.x = sx;
        target.y = sy;
        target.visible = inFront && insideBounds;
      }

      this.callbacks.onProjectAtmosLabels(this.atmosLabelBuffer);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed || this.paused || document.hidden) return;

    const dt = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.getElapsedTime();

    // 1. Advance sequential layer unpacking tour if running
    if (this.tourRunning) {
      this.advanceLayerTour(dt);
      this.shadowsDirty = true;
    }

    // 2. Smooth cutaway / telescoping animation
    const prevCutaway = this.currentCutaway;
    this.currentCutaway = THREE.MathUtils.damp(this.currentCutaway, this.targetCutaway, 5.5, dt);
    const c = this.currentCutaway;
    if (Math.abs(c - prevCutaway) > 0.0008) {
      this.shadowsDirty = true;
    }

    if (this.cutawayMode === 'permukaan') {
      this.coreGlowLight.intensity = 0;
      this.surfaceDiorama.update(
        elapsed,
        c,
        this.isSoftwareGl,
        this.activeLayerId,
        this.tourRunning,
        this.activeAtmosSubId,
      );
      if (!this.tourRunning && Math.abs(this.surfaceDiorama.root.rotation.y) > 0.001) {
        this.surfaceDiorama.root.rotation.y = THREE.MathUtils.damp(
          this.surfaceDiorama.root.rotation.y,
          0,
          4.0,
          dt,
        );
      }
    } else if (this.cutawayMode === 'teleskop') {
      const centerShift = -c * 0.42;
      this.teleCrustGroup.position.set(centerShift, 0, 0);
      this.teleMantleGroup.position.set(centerShift + c * 0.24, 0, 0);
      this.teleOuterCoreGroup.position.set(centerShift + c * 0.64, 0, 0);
      this.teleInnerCoreGroup.position.set(centerShift + c * 1.12, 0, 0);

      this.teleRightShellGroup.position.set(centerShift + c * 2.18, 0, c * -0.18);
      this.teleRightShellGroup.rotation.y = c * 0.22;
      this.teleRightShellGroup.visible = c < 0.98;

      this.atmosMesh.position.set(centerShift, 0, 0);
      this.coreGlowSpriteTele.material.opacity = Math.min(0.9, c * 1.25);
      this.coreGlowLight.intensity = 0.4 + c * 2.6;
    } else {
      const diag = 0.57735027;
      const offset = c * 1.38;
      this.octWedgeGroup.position.set(diag * offset, diag * offset, diag * offset);
      this.octWedgeGroup.visible = c < 0.96;
      this.atmosMesh.position.set(0, 0, 0);
      this.coreGlowSpriteOct.material.opacity = Math.min(0.85, c * 1.2);
      this.coreGlowLight.intensity = 0.4 + c * 2.6;
    }

    // 3. Organic slow planetary & Astro Bumi character animations (only update visible mode!)
    if (!this.isSoftwareGl) {
      if (this.cutawayMode !== 'permukaan') {
        const cloudRot = elapsed * 0.012;
        const corePulse = 1 + Math.sin(elapsed * 2.3) * 0.016;

        if (this.cutawayMode === 'teleskop') {
          this.teleCloudLeft.rotation.y = cloudRot;
          if (this.teleRightShellGroup.visible) {
            this.teleCloudRight.rotation.y = cloudRot;
          }
          this.cutMantleFaceTele.rotation.x = Math.sin(elapsed * 0.15) * 0.02;
          this.cutOuterCoreFaceTele.rotation.x = Math.sin(elapsed * 0.28) * 0.04;
          this.teleInnerCoreGroup.scale.setScalar(corePulse);
        } else {
          this.octCloudSouth.rotation.y = cloudRot;
          this.octCloudNorth.rotation.y = cloudRot;
          if (this.octWedgeGroup.visible) {
            this.octCloudWedge.rotation.y = cloudRot;
          }
          this.octInnerCoreMesh.scale.setScalar(corePulse);
        }

        // Slow mantle magma drift & outer core liquid metal swirl (cheap UV uniform offset)
        this.mantleFlowTex.offset.x = (elapsed * 0.012) % 1;
        this.outerCoreFlowTex.offset.x = (-elapsed * 0.022) % 1;
        this.outerCoreFlowTex.offset.y = (elapsed * 0.008) % 1;

        this.satellitePivot.rotation.y = elapsed * 0.22;
        this.satelliteGroup.rotation.y = -elapsed * 0.4;
        this.holoGraticule.rotation.y = elapsed * 0.028;
      }

      // Astro Bumi gentle floating, blinking eyes, waving arm, & pointing gesture
      if (this.astroRoot.visible) {
        this.astroBody.position.y = Math.sin(elapsed * 2.0) * 0.055;
        this.astroBody.rotation.z = Math.sin(elapsed * 1.3) * 0.06;

        const blinkCycle = elapsed % 3.4;
        const eyeScaleY = blinkCycle > 3.24 ? 0.12 : 1.0;
        this.astroEyeLeft.scale.y = eyeScaleY;
        this.astroEyeRight.scale.y = eyeScaleY;

        this.astroWaveBoost = THREE.MathUtils.damp(this.astroWaveBoost, 0.25, 1.8, dt);
        this.astroWaveArm.rotation.z =
          Math.sin(elapsed * 6.2) * (0.48 * this.astroWaveBoost) + 0.15;

        this.astroPointArm.rotation.z = Math.sin(elapsed * 2.6) * 0.1;
      }
    }

    // Breathing highlight pulse on active / explained layer
    if (this.activeLayerId) {
      this.updateLayerHighlights(elapsed);
    }

    // 4. Clamp pan target safely so kids never lose Earth or high Termosfer off-screen
    if (this.controls.target.lengthSq() > 12.96) {
      this.controls.target.setLength(3.6);
    }

    // 5. Smooth camera position & lookAt target transitions + zoom damping
    if (this.cameraTransitionActive) {
      const alpha = 1 - Math.exp(-3.8 * dt);
      this.camera.position.lerp(this.cameraGoalPos, alpha);
      this.controls.target.lerp(this.cameraTargetGoal, alpha);
      if (
        this.camera.position.distanceTo(this.cameraGoalPos) < 0.04 &&
        this.controls.target.distanceTo(this.cameraTargetGoal) < 0.03
      ) {
        this.camera.position.copy(this.cameraGoalPos);
        this.controls.target.copy(this.cameraTargetGoal);
        this.cameraTransitionActive = false;
      }
    } else if (this.desiredZoomDistance !== null) {
      const currentDist = this.camera.position.distanceTo(this.controls.target);
      const nextDist = THREE.MathUtils.damp(currentDist, this.desiredZoomDistance, 8, dt);
      _targetCamPos
        .copy(this.camera.position)
        .sub(this.controls.target)
        .normalize()
        .multiplyScalar(nextDist)
        .add(this.controls.target);
      this.camera.position.copy(_targetCamPos);
      if (Math.abs(nextDist - this.desiredZoomDistance) < 0.02) {
        this.desiredZoomDistance = null;
      }
    }

    this.controls.update();

    // Update shadow map strictly on demand (0 ms GPU shadow pass cost during orbit/idle!)
    if (this.renderer.shadowMap.enabled && this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }

    this.renderer.render(this.scene, this.camera);
    this.updateProjectedLabels();

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    const canvas = this.renderer.domElement;
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.controls.dispose();
    if (this.surfaceDiorama) {
      this.surfaceDiorama.dispose();
    }
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}

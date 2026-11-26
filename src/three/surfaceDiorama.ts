import * as THREE from 'three';
import type { AtmosSubLayerId, LayerId } from '../data/earthContent';

export interface SurfaceLabelAnchor {
  id: LayerId;
  label: string;
  node: THREE.Object3D;
}

export interface AtmosLabelAnchor {
  id: AtmosSubLayerId;
  node: THREE.Object3D;
}

export interface SurfaceDioramaAssembly {
  root: THREE.Group;
  pickables: THREE.Object3D[];
  labelAnchors: SurfaceLabelAnchor[];
  atmosLabelAnchors: AtmosLabelAnchor[];
  highlightMaterials: Array<{ id: LayerId; mat: THREE.MeshStandardMaterial }>;
  update: (
    elapsed: number,
    separation: number,
    isSoftwareGl: boolean,
    activeLayerId: LayerId | null,
    tourRunning: boolean,
    activeAtmosSubId: AtmosSubLayerId | null,
  ) => void;
  dispose: () => void;
}

const WIDTH = 5.0;
const DEPTH = 3.4;
const HALF_W = WIDTH * 0.5;
const HALF_D = DEPTH * 0.5;
const BASE_Y = -1.02;
const WATER_Y = 0.04;
const COAST_X = 0.42;

const _dummy = new THREE.Object3D();
const _v3 = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * Winding river centerline Z coordinate as a function of X (flows from mountains to sea).
 */
function riverCenterZ(x: number): number {
  return Math.sin(x * 1.45 + 0.5) * 0.42 - 0.14;
}

/**
 * Deterministic sculpted terrain heightfield for the 3D surface components diorama.
 * Left (x < -0.55): rising alpine mountain massif.
 * Center (-0.55..0.42): fertile rolling green valley with carved river channel.
 * Right (x > 0.42): sandy coastline sloping smoothly into ocean seabed.
 */
export function surfaceHeightAt(x: number, z: number): number {
  // Base continental slope from highland left to coastal right
  let h = 0.24;

  if (x < COAST_X) {
    const landT = Math.min(1, (COAST_X - x) / (HALF_W + COAST_X));
    // Rolling valley + rising foothills
    h = 0.06 + Math.pow(landT, 1.35) * 0.52;
    h += Math.sin(x * 2.1 + 0.4) * Math.cos(z * 1.9) * 0.055;

    // 3 sculpted mountain peaks in the left highland massif
    const peak1 = Math.exp(-((x + 1.82) ** 2 * 1.9 + (z + 0.65) ** 2 * 1.65)) * 0.96;
    const peak2 = Math.exp(-((x + 1.32) ** 2 * 2.3 + (z - 0.55) ** 2 * 2.1)) * 0.72;
    const peak3 = Math.exp(-((x + 2.05) ** 2 * 2.6 + (z - 0.78) ** 2 * 2.2)) * 0.62;
    // Slight ridge detail
    const ridgeNoise =
      Math.max(0, -x - 0.7) * 0.06 * (Math.sin(x * 7.2 + z * 5.1) * 0.5 + 0.5);
    h += peak1 + peak2 + peak3 + ridgeNoise;

    // Carve smooth river channel winding down from highland spring (-1.35) to coast
    if (x > -1.45) {
      const rz = riverCenterZ(x);
      const distRiver = Math.abs(z - rz);
      const riverWidth = 0.24 + Math.max(0, (x + 1.45) * 0.06);
      if (distRiver < riverWidth) {
        const carve = Math.cos((distRiver / riverWidth) * Math.PI * 0.5);
        const depth = 0.14 * carve * carve;
        h = Math.max(WATER_Y - 0.05, h - depth);
      }
    }

    // Gentle flattening near eco-village terrace (x ~ -0.18, z ~ 0.68)
    const villageDistSq = (x + 0.18) ** 2 + (z - 0.68) ** 2;
    if (villageDistSq < 0.28) {
      const blend = Math.exp(-villageDistSq * 9.0);
      h = THREE.MathUtils.lerp(h, 0.22, blend * 0.7);
    }
  } else {
    // Coastal shelf sloping smoothly into deep ocean basin
    const seaT = Math.min(1, (x - COAST_X) / (HALF_W - COAST_X));
    h = 0.06 - Math.pow(seaT, 0.78) * 0.58;
    h += Math.sin(x * 3.4) * Math.cos(z * 2.8) * 0.025;
  }

  return h;
}

/**
 * Procedural geological strata texture (topsoil, sandstone, limestone, deep basalt)
 * painted onto a 2D canvas in sRGB color space for the cutaway block walls.
 */
function createSurfaceStrataTexture(maxAniso: number, lightweight: boolean): THREE.CanvasTexture {
  const w = lightweight ? 256 : 512;
  const h = lightweight ? 128 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Layered soil & sedimentary rock strata (top to bottom)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#6b4423');
  grad.addColorStop(0.14, '#8b5a2b');
  grad.addColorStop(0.18, '#a16207');
  grad.addColorStop(0.36, '#7c4d2b');
  grad.addColorStop(0.42, '#9a6842');
  grad.addColorStop(0.62, '#5c4338');
  grad.addColorStop(0.72, '#4a3a37');
  grad.addColorStop(1.0, '#2b2426');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle wavy sedimentary bedding lines
  const bands = [0.16, 0.34, 0.52, 0.69, 0.84];
  bands.forEach((b, idx) => {
    ctx.beginPath();
    ctx.moveTo(0, b * h);
    for (let x = 0; x <= w; x += 12) {
      const wave = Math.sin((x / w) * Math.PI * 4 + idx * 1.4) * (h * 0.022);
      ctx.lineTo(x, b * h + wave);
    }
    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(255, 224, 178, 0.22)' : 'rgba(18, 12, 10, 0.32)';
    ctx.lineWidth = lightweight ? 2 : 3;
    ctx.stroke();
  });

  // Deterministic rock pebble grain
  let seed = 1337;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const speckCount = lightweight ? 280 : 650;
  for (let i = 0; i < speckCount; i++) {
    const px = rand() * w;
    const py = rand() * h;
    const rw = 2 + rand() * 5;
    const rh = 1 + rand() * 3;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(245, 215, 176, 0.14)' : 'rgba(20, 15, 14, 0.22)';
    ctx.fillRect(px, py, rw, rh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(4, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the 4 cutaway side skirts from top terrain edge down to BASE_Y.
 */
function buildTerrainSkirtGeometry(segX: number, segZ: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertOffset = 0;

  const addEdgeWall = (
    samples: number,
    samplePt: (t: number) => [number, number],
    flipWinding: boolean,
  ) => {
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const [x, z] = samplePt(t);
      const topY = surfaceHeightAt(x, z);
      // Top vertex
      positions.push(x, topY, z);
      uvs.push(t * 2, 0);
      // Bottom vertex
      positions.push(x, BASE_Y, z);
      uvs.push(t * 2, 1);
    }
    for (let i = 0; i < samples; i++) {
      const a = vertOffset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (flipWinding) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
    vertOffset += (samples + 1) * 2;
  };

  // Front edge (z = +HALF_D, left to right)
  addEdgeWall(segX, (t) => [-HALF_W + t * WIDTH, HALF_D], false);
  // Back edge (z = -HALF_D, left to right)
  addEdgeWall(segX, (t) => [-HALF_W + t * WIDTH, -HALF_D], true);
  // Left edge (x = -HALF_W, back to front)
  addEdgeWall(segZ, (t) => [-HALF_W, -HALF_D + t * DEPTH], false);
  // Right edge (x = +HALF_W, back to front)
  addEdgeWall(segZ, (t) => [HALF_W, -HALF_D + t * DEPTH], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the 3 translucent cutaway side walls of the ocean volume (between seabed and WATER_Y).
 */
function buildOceanWallGeometry(segX: number, segZ: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let vertOffset = 0;

  const oceanStartX = COAST_X + 0.02;
  const oceanWidth = HALF_W - oceanStartX;

  const addWaterWall = (
    samples: number,
    samplePt: (t: number) => [number, number],
    flipWinding: boolean,
  ) => {
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const [x, z] = samplePt(t);
      const bedY = Math.min(WATER_Y - 0.01, surfaceHeightAt(x, z));
      positions.push(x, WATER_Y, z);
      positions.push(x, bedY, z);
    }
    for (let i = 0; i < samples; i++) {
      const a = vertOffset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (flipWinding) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
    vertOffset += (samples + 1) * 2;
  };

  // Front ocean wall (z = +HALF_D)
  addWaterWall(segX, (t) => [oceanStartX + t * oceanWidth, HALF_D + 0.004], false);
  // Back ocean wall (z = -HALF_D)
  addWaterWall(segX, (t) => [oceanStartX + t * oceanWidth, -HALF_D - 0.004], true);
  // Right ocean wall (x = +HALF_W)
  addWaterWall(segZ, (t) => [HALF_W + 0.004, -HALF_D + t * DEPTH], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a complete, interactive 3D diorama illustrating Earth's 4 Surface Components:
 * Litosfer, Hidrosfer, Biosfer, and stratified Atmosfer (Troposfer -> Termosfer).
 */
export function createSurfaceDiorama(
  maxAniso: number,
  lightweight: boolean,
): SurfaceDioramaAssembly {
  const root = new THREE.Group();
  root.position.set(0, -0.52, 0);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const pickables: THREE.Object3D[] = [];
  const highlightMaterials: Array<{ id: LayerId; mat: THREE.MeshStandardMaterial }> = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };
  const regMat = (id: LayerId, mat: THREE.MeshStandardMaterial) => {
    highlightMaterials.push({ id, mat });
    return mat;
  };

  // =========================================================================
  // 1. LITOSFER (Terrain, Stratified Rock Cutaway, Snow-Capped Mountains, Rocks)
  // =========================================================================
  const litosferGroup = new THREE.Group();
  root.add(litosferGroup);

  const segX = lightweight ? 32 : 46;
  const segZ = lightweight ? 22 : 32;

  const terrainGeo = trackGeo(new THREE.PlaneGeometry(WIDTH, DEPTH, segX, segZ));
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cSnow = new THREE.Color(0xf1f5f9);
  const cRock = new THREE.Color(0x7c7166);
  const cGrass = new THREE.Color(0x4b8f38);
  const cMeadow = new THREE.Color(0x63a642);
  const cSand = new THREE.Color(0xd9b97e);
  const cSeabed = new THREE.Color(0x28566e);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = surfaceHeightAt(x, z);
    posAttr.setY(i, y);

    if (y > 0.94) {
      _color.copy(cRock).lerp(cSnow, Math.min(1, (y - 0.94) / 0.24));
    } else if (y > 0.56) {
      _color.copy(cGrass).lerp(cRock, Math.min(1, (y - 0.56) / 0.34));
    } else if (y > 0.11) {
      const t = Math.min(1, (y - 0.11) / 0.45);
      _color.copy(cMeadow).lerp(cGrass, t);
    } else if (y > -0.02) {
      const t = Math.min(1, (y + 0.02) / 0.13);
      _color.copy(cSand).lerp(cMeadow, t);
    } else {
      const t = Math.min(1, (-y - 0.02) / 0.42);
      _color.copy(cSand).lerp(cSeabed, t);
    }

    colors[i * 3] = _color.r;
    colors[i * 3 + 1] = _color.g;
    colors[i * 3 + 2] = _color.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = regMat(
    'litosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.02,
        emissive: new THREE.Color(0x5c3a16),
        emissiveIntensity: 0.04,
      }),
    ),
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.userData.layerId = 'litosfer';
  litosferGroup.add(terrainMesh);
  pickables.push(terrainMesh);

  // Stratified geological cutaway walls + bottom slab
  const strataTex = trackTex(createSurfaceStrataTexture(maxAniso, lightweight));
  const strataMat = regMat(
    'litosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        map: strataTex,
        roughness: 0.92,
        metalness: 0.03,
        emissive: new THREE.Color(0x6b3e1b),
        emissiveIntensity: 0.07,
      }),
    ),
  );
  const skirtMesh = new THREE.Mesh(
    trackGeo(buildTerrainSkirtGeometry(segX, segZ)),
    strataMat,
  );
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  skirtMesh.userData.layerId = 'litosfer';
  litosferGroup.add(skirtMesh);
  pickables.push(skirtMesh);

  const bottomPlate = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(WIDTH, DEPTH)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x241d1f,
        roughness: 0.95,
      }),
    ),
  );
  bottomPlate.rotation.x = Math.PI / 2;
  bottomPlate.position.y = BASE_Y;
  bottomPlate.userData.layerId = 'litosfer';
  litosferGroup.add(bottomPlate);

  // Composite Alpine Peaks (faceted granite body + distinct snow cap)
  const peakRockMat = regMat(
    'litosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x78716c,
        roughness: 0.92,
        metalness: 0.04,
        flatShading: true,
        emissive: new THREE.Color(0x78431b),
        emissiveIntensity: 0.05,
      }),
    ),
  );
  const snowCapMat = regMat(
    'litosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.52,
        metalness: 0.02,
        flatShading: true,
        emissive: new THREE.Color(0x94a3b8),
        emissiveIntensity: 0.06,
      }),
    ),
  );

  const peakSpecs: Array<[number, number, number, number]> = [
    [-1.82, -0.65, 0.52, 0.92],
    [-1.32, 0.55, 0.42, 0.72],
    [-2.05, 0.78, 0.36, 0.62],
  ];
  peakSpecs.forEach(([px, pz, rad, h]) => {
    const baseH = surfaceHeightAt(px, pz) - 0.36;
    const peakGroup = new THREE.Group();
    peakGroup.position.set(px, baseH, pz);

    const rockCone = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(rad, h, 7)),
      peakRockMat,
    );
    rockCone.position.y = h * 0.5;
    rockCone.castShadow = true;
    rockCone.receiveShadow = true;
    rockCone.userData.layerId = 'litosfer';

    const capH = h * 0.34;
    const snowCone = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(rad * 0.36, capH, 7)),
      snowCapMat,
    );
    snowCone.position.y = h - capH * 0.48;
    snowCone.userData.layerId = 'litosfer';

    peakGroup.add(rockCone, snowCone);
    litosferGroup.add(peakGroup);
    pickables.push(rockCone, snowCone);
  });

  // Instanced rocky boulders along mountain foothills
  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(0.085, 0));
  const boulderCoords: Array<[number, number, number]> = [
    [-1.15, -0.95, 1.15],
    [-0.92, -0.48, 0.9],
    [-1.45, 0.02, 1.25],
    [-1.08, 0.98, 1.05],
    [-0.78, 1.18, 0.85],
    [-1.65, 1.25, 1.1],
    [-0.65, -1.15, 0.95],
    [-2.15, -0.1, 1.3],
    [-0.85, 0.25, 0.8],
    [-1.55, -1.25, 1.15],
  ];
  const boulders = new THREE.InstancedMesh(rockGeo, peakRockMat, boulderCoords.length);
  boulders.userData.layerId = 'litosfer';
  boulderCoords.forEach(([bx, bz, sc], idx) => {
    const by = surfaceHeightAt(bx, bz) + 0.02;
    _dummy.position.set(bx, by, bz);
    _dummy.rotation.set(idx * 0.7, idx * 1.3, idx * 0.4);
    _dummy.scale.set(sc * 1.1, sc * 0.75, sc);
    _dummy.updateMatrix();
    boulders.setMatrixAt(idx, _dummy.matrix);
    _color.setHSL(0.07, 0.14, 0.42 + (idx % 3) * 0.07);
    boulders.setColorAt(idx, _color);
  });
  boulders.instanceMatrix.needsUpdate = true;
  if (boulders.instanceColor) boulders.instanceColor.needsUpdate = true;
  boulders.computeBoundingSphere();
  litosferGroup.add(boulders);
  pickables.push(boulders);

  // =========================================================================
  // 2. HIDROSFER (3D Ocean Volume, Cutaway Depth Walls, Winding River, Water Cycle)
  // =========================================================================
  const hidrosferGroup = new THREE.Group();
  root.add(hidrosferGroup);

  const oceanStartX = COAST_X + 0.02;
  const oceanWidth = HALF_W - oceanStartX;
  const oceanSegX = lightweight ? 14 : 22;
  const oceanSegZ = lightweight ? 14 : 22;

  const oceanTopGeo = trackGeo(
    new THREE.PlaneGeometry(oceanWidth, DEPTH, oceanSegX, oceanSegZ),
  );
  oceanTopGeo.rotateX(-Math.PI / 2);
  const oceanBaseY = new Float32Array(oceanTopGeo.attributes.position.count);

  const oceanTopMat = regMat(
    'hidrosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.14,
        metalness: 0.18,
        transparent: true,
        opacity: 0.84,
        emissive: new THREE.Color(0x0369a1),
        emissiveIntensity: 0.22,
      }),
    ),
  );
  const oceanTopMesh = new THREE.Mesh(oceanTopGeo, oceanTopMat);
  oceanTopMesh.position.set(oceanStartX + oceanWidth * 0.5, WATER_Y, 0);
  oceanTopMesh.receiveShadow = true;
  oceanTopMesh.renderOrder = 2;
  oceanTopMesh.userData.layerId = 'hidrosfer';
  hidrosferGroup.add(oceanTopMesh);
  pickables.push(oceanTopMesh);

  // Translucent deep ocean cutaway walls (aquarium cross-section)
  const oceanWallMat = regMat(
    'hidrosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0369a1,
        roughness: 0.22,
        metalness: 0.1,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 0.18,
      }),
    ),
  );
  const oceanWallsMesh = new THREE.Mesh(
    trackGeo(buildOceanWallGeometry(oceanSegX, oceanSegZ)),
    oceanWallMat,
  );
  oceanWallsMesh.renderOrder = 2;
  oceanWallsMesh.userData.layerId = 'hidrosfer';
  hidrosferGroup.add(oceanWallsMesh);
  pickables.push(oceanWallsMesh);

  // Winding mountain-to-sea river
  const riverPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const rx = THREE.MathUtils.lerp(-1.35, COAST_X + 0.16, t);
    const rz = riverCenterZ(rx);
    const ry = Math.max(WATER_Y + 0.015, surfaceHeightAt(rx, rz) + 0.025);
    riverPts.push(new THREE.Vector3(rx, ry, rz));
  }
  const riverCurve = new THREE.CatmullRomCurve3(riverPts);
  const riverGeo = trackGeo(new THREE.TubeGeometry(riverCurve, 28, 0.095, 7, false));
  riverGeo.scale(1, 0.28, 1); // flatten smoothly into riverbed
  const riverMat = regMat(
    'hidrosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.12,
        metalness: 0.14,
        emissive: new THREE.Color(0x0ea5e9),
        emissiveIntensity: 0.28,
      }),
    ),
  );
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.position.y = 0.02;
  riverMesh.userData.layerId = 'hidrosfer';
  hidrosferGroup.add(riverMesh);
  pickables.push(riverMesh);

  // Water Cycle: Rising evaporation vapor droplets (over ocean) & falling rain streaks (over mountain)
  const vaporCount = 16;
  const vaporGeo = trackGeo(new THREE.SphereGeometry(0.032, 6, 6));
  const vaporMat = regMat(
    'hidrosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        roughness: 0.3,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.45,
      }),
    ),
  );
  const vaporMesh = new THREE.InstancedMesh(vaporGeo, vaporMat, vaporCount);
  vaporMesh.frustumCulled = false;
  vaporMesh.renderOrder = 3;
  vaporMesh.userData.layerId = 'hidrosfer';
  hidrosferGroup.add(vaporMesh);

  const vaporSeeds = Array.from({ length: vaporCount }, (_, i) => ({
    x: 0.85 + ((i * 0.43) % 1.45),
    z: -1.15 + ((i * 0.67) % 2.3),
    phase: (i / vaporCount) * Math.PI * 2,
    speed: 0.24 + (i % 4) * 0.05,
  }));

  const rainCount = 20;
  const rainGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 5));
  const rainMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainMesh.frustumCulled = false;
  rainMesh.renderOrder = 3;
  hidrosferGroup.add(rainMesh);

  const rainSeeds = Array.from({ length: rainCount }, (_, i) => ({
    x: -1.65 + ((i * 0.29) % 1.1),
    z: -0.75 + ((i * 0.41) % 1.3),
    offset: i / rainCount,
  }));

  // =========================================================================
  // 3. BIOSFER (Instanced Forest, Eco-House + Windmill, Soaring Birds, Reef Fish)
  // =========================================================================
  const biosferGroup = new THREE.Group();
  root.add(biosferGroup);

  const treeTransforms: THREE.Matrix4[] = [];
  const treeCandidates = lightweight ? 58 : 82;
  for (let i = 0; i < treeCandidates; i++) {
    // Deterministic Halton-like spread across green foothills & valley
    const u = ((i * 0.6180339) % 1);
    const v = ((i * 0.381966 + 0.17) % 1);
    const tx = THREE.MathUtils.lerp(-1.55, COAST_X - 0.18, u);
    const tz = THREE.MathUtils.lerp(-HALF_D + 0.22, HALF_D - 0.22, v);

    // Keep clear of river channel & eco-house terrace
    if (Math.abs(tz - riverCenterZ(tx)) < 0.28) continue;
    if ((tx + 0.18) ** 2 + (tz - 0.68) ** 2 < 0.24) continue;

    const ty = surfaceHeightAt(tx, tz);
    if (ty < 0.14 || ty > 0.72) continue;

    const sc = 0.84 + ((i * 19) % 30) / 100;
    _dummy.position.set(tx, ty - 0.01, tz);
    _dummy.rotation.set(0, i * 1.1, 0);
    _dummy.scale.setScalar(sc);
    _dummy.updateMatrix();
    treeTransforms.push(_dummy.matrix.clone());
  }

  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.032, 0.12, 5));
  trunkGeo.translate(0, 0.06, 0);
  const lowCanopyGeo = trackGeo(new THREE.ConeGeometry(0.105, 0.2, 6));
  lowCanopyGeo.translate(0, 0.18, 0);
  const topCanopyGeo = trackGeo(new THREE.ConeGeometry(0.075, 0.16, 6));
  topCanopyGeo.translate(0, 0.29, 0);

  const trunkMat = regMat(
    'biosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x713f12,
        roughness: 0.92,
      }),
    ),
  );
  const foliageMat = regMat(
    'biosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        roughness: 0.76,
        metalness: 0.02,
        emissive: new THREE.Color(0x065f46),
        emissiveIntensity: 0.08,
      }),
    ),
  );

  if (treeTransforms.length > 0) {
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeTransforms.length);
    const lowCanopy = new THREE.InstancedMesh(lowCanopyGeo, foliageMat, treeTransforms.length);
    const topCanopy = new THREE.InstancedMesh(topCanopyGeo, foliageMat, treeTransforms.length);
    lowCanopy.castShadow = true;
    lowCanopy.receiveShadow = true;
    lowCanopy.userData.layerId = 'biosfer';
    topCanopy.userData.layerId = 'biosfer';

    for (let i = 0; i < treeTransforms.length; i++) {
      trunks.setMatrixAt(i, treeTransforms[i]);
      lowCanopy.setMatrixAt(i, treeTransforms[i]);
      topCanopy.setMatrixAt(i, treeTransforms[i]);
      _color.setHSL(0.32 + (i % 5) * 0.02, 0.58, 0.34 + (i % 4) * 0.04);
      lowCanopy.setColorAt(i, _color);
      _color.offsetHSL(0.01, 0.04, 0.05);
      topCanopy.setColorAt(i, _color);
    }
    trunks.instanceMatrix.needsUpdate = true;
    lowCanopy.instanceMatrix.needsUpdate = true;
    topCanopy.instanceMatrix.needsUpdate = true;
    if (lowCanopy.instanceColor) lowCanopy.instanceColor.needsUpdate = true;
    if (topCanopy.instanceColor) topCanopy.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    lowCanopy.computeBoundingSphere();
    topCanopy.computeBoundingSphere();
    biosferGroup.add(trunks, lowCanopy, topCanopy);
    pickables.push(lowCanopy, topCanopy);
  }

  // Composite 6-Part Miniature Eco-House & Windmill (representing human life in Biosfer)
  const houseGroup = new THREE.Group();
  const houseX = -0.18;
  const houseZ = 0.68;
  houseGroup.position.set(houseX, surfaceHeightAt(houseX, houseZ) - 0.01, houseZ);
  houseGroup.rotation.y = 0.35;

  const wallMat = regMat(
    'biosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.82,
        emissive: new THREE.Color(0x422006),
        emissiveIntensity: 0.06,
      }),
    ),
  );
  const roofMat = regMat(
    'biosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.68,
        emissive: new THREE.Color(0x9a3412),
        emissiveIntensity: 0.08,
      }),
    ),
  );
  const windowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.25,
      emissive: new THREE.Color(0xfbbf24),
      emissiveIntensity: 0.7,
    }),
  );

  const houseBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.17, 0.22)), wallMat);
  houseBase.position.y = 0.085;
  houseBase.castShadow = true;
  houseBase.userData.layerId = 'biosfer';

  const houseRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.23, 0.13, 4)), roofMat);
  houseRoof.position.y = 0.23;
  houseRoof.rotation.y = Math.PI / 4;
  houseRoof.castShadow = true;
  houseRoof.userData.layerId = 'biosfer';

  const houseDoor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.055, 0.095, 0.018)),
    trunkMat,
  );
  houseDoor.position.set(-0.04, 0.048, 0.112);

  const houseWin = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.058, 0.052, 0.018)),
    windowMat,
  );
  houseWin.position.set(0.06, 0.095, 0.112);

  const chimney = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.09, 0.04)), roofMat);
  chimney.position.set(0.07, 0.24, -0.04);

  houseGroup.add(houseBase, houseRoof, houseDoor, houseWin, chimney);
  biosferGroup.add(houseGroup);
  pickables.push(houseBase, houseRoof);

  // Small spinning eco-windmill beside house
  const millMastMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.45,
    }),
  );
  const millGroup = new THREE.Group();
  const millX = 0.06;
  const millZ = 0.92;
  millGroup.position.set(millX, surfaceHeightAt(millX, millZ) - 0.01, millZ);
  const millMast = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.014, 0.022, 0.38, 6)),
    millMastMat,
  );
  millMast.position.y = 0.19;
  const millHub = new THREE.Group();
  millHub.position.set(0, 0.37, 0.02);
  const bladeGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.14, 0.008));
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(bladeGeo, millMastMat);
    const a = (b / 3) * Math.PI * 2;
    blade.position.set(Math.sin(a) * 0.065, Math.cos(a) * 0.065, 0);
    blade.rotation.z = -a;
    millHub.add(blade);
  }
  millGroup.add(millMast, millHub);
  biosferGroup.add(millGroup);

  // 3 Composite Soaring Birds (body + flapping left/right wings)
  const birdMat = regMat(
    'biosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.55,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.15,
      }),
    ),
  );
  const birds: Array<{
    group: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    phase: number;
    radius: number;
    height: number;
  }> = [];
  const birdBodyGeo = trackGeo(new THREE.ConeGeometry(0.02, 0.09, 5));
  birdBodyGeo.rotateX(Math.PI / 2);
  const birdWingGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.008, 0.032));

  for (let i = 0; i < 3; i++) {
    const bg = new THREE.Group();
    const body = new THREE.Mesh(birdBodyGeo, birdMat);
    const lw = new THREE.Mesh(birdWingGeo, birdMat);
    lw.position.set(-0.045, 0, 0);
    const rw = new THREE.Mesh(birdWingGeo, birdMat);
    rw.position.set(0.045, 0, 0);
    bg.add(body, lw, rw);
    biosferGroup.add(bg);
    birds.push({
      group: bg,
      leftWing: lw,
      rightWing: rw,
      phase: i * 2.1,
      radius: 0.72 + i * 0.22,
      height: 0.92 + i * 0.14,
    });
  }

  // Underwater Coastal Reef Fish inside transparent ocean volume
  const fishCount = 9;
  const fishGeo = trackGeo(new THREE.ConeGeometry(0.026, 0.085, 5));
  fishGeo.rotateZ(-Math.PI / 2);
  const fishMat = regMat(
    'biosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.35,
        metalness: 0.15,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 0.3,
      }),
    ),
  );
  const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, fishCount);
  fishMesh.frustumCulled = false;
  fishMesh.userData.layerId = 'biosfer';
  for (let i = 0; i < fishCount; i++) {
    _color.setHex(i % 2 === 0 ? 0xfbbf24 : 0xfb7185);
    fishMesh.setColorAt(i, _color);
  }
  if (fishMesh.instanceColor) fishMesh.instanceColor.needsUpdate = true;
  biosferGroup.add(fishMesh);

  // =========================================================================
  // 4. ATMOSFER (4 Stratified Canopy Bands + Clouds + Plane + Meteor + Satellite)
  // =========================================================================
  const atmosferGroup = new THREE.Group();
  root.add(atmosferGroup);

  const atmosBandConfigs: Array<{
    id: AtmosSubLayerId;
    name: string;
    baseY: number;
    color: number;
    opacity: number;
    rimOpacity: number;
    liftFactor: number;
  }> = [
    {
      id: 'troposfer',
      name: 'Troposfer',
      baseY: 1.24,
      color: 0x7dd3fc,
      opacity: 0.16,
      rimOpacity: 0.56,
      liftFactor: 0.24,
    },
    {
      id: 'stratosfer',
      name: 'Stratosfer & Ozon',
      baseY: 1.66,
      color: 0x22d3ee,
      opacity: 0.18,
      rimOpacity: 0.68,
      liftFactor: 0.62,
    },
    {
      id: 'mesosfer',
      name: 'Mesosfer',
      baseY: 2.08,
      color: 0x818cf8,
      opacity: 0.15,
      rimOpacity: 0.58,
      liftFactor: 1.02,
    },
    {
      id: 'termosfer',
      name: 'Termosfer & Eksosfer',
      baseY: 2.48,
      color: 0x34d399,
      opacity: 0.13,
      rimOpacity: 0.52,
      liftFactor: 1.42,
    },
  ];

  // Gently arched canopy geometry so atmosphere hugs the landscape cleanly
  const createArchedBandGeo = (w: number, d: number, archHeight: number) => {
    const geo = new THREE.PlaneGeometry(w, d, 16, 8);
    geo.rotateX(-Math.PI / 2);
    const attr = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const gx = attr.getX(i) / (w * 0.5);
      const gz = attr.getZ(i) / (d * 0.5);
      const arch = (1 - gx * gx * 0.65 - gz * gz * 0.35) * archHeight;
      attr.setY(i, arch);
    }
    geo.computeVertexNormals();
    return trackGeo(geo);
  };

  const sharedBandGeo = createArchedBandGeo(WIDTH * 1.02, DEPTH * 1.02, 0.22);

  const atmosBands: Array<{
    id: AtmosSubLayerId;
    group: THREE.Group;
    baseY: number;
    liftFactor: number;
    bandMat: THREE.MeshStandardMaterial;
    baseOpacity: number;
    rimMat: THREE.MeshBasicMaterial;
    baseRimOpacity: number;
  }> = [];

  atmosBandConfigs.forEach((cfg, idx) => {
    const bandGroup = new THREE.Group();
    bandGroup.position.y = cfg.baseY;

    const bandMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.3,
        metalness: 0.05,
        transparent: true,
        opacity: cfg.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: new THREE.Color(cfg.color),
        emissiveIntensity: 0.36,
      }),
    );
    const bandMesh = new THREE.Mesh(sharedBandGeo, bandMat);
    bandMesh.renderOrder = 5 + idx;
    bandMesh.userData.layerId = 'atmosfer';
    bandMesh.userData.atmosSubId = cfg.id;

    // Crisp luminous front boundary arc so each atmospheric stratum reads clearly
    const arcPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 18; s++) {
      const t = s / 18;
      const ax = -HALF_W * 1.02 + t * WIDTH * 1.02;
      const gx = ax / (HALF_W * 1.02);
      const ay = (1 - gx * gx * 0.65 - 0.35) * 0.22;
      arcPts.push(new THREE.Vector3(ax, ay, HALF_D * 1.02));
    }
    const arcCurve = new THREE.CatmullRomCurve3(arcPts);
    const rimMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.rimOpacity,
        depthWrite: false,
      }),
    );
    const rimMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(arcCurve, 22, 0.02, 5, false)),
      rimMat,
    );
    rimMesh.renderOrder = 6 + idx;
    rimMesh.userData.layerId = 'atmosfer';
    rimMesh.userData.atmosSubId = cfg.id;

    bandGroup.add(bandMesh, rimMesh);
    atmosferGroup.add(bandGroup);
    pickables.push(bandMesh, rimMesh);

    atmosBands.push({
      id: cfg.id,
      group: bandGroup,
      baseY: cfg.baseY,
      liftFactor: cfg.liftFactor,
      bandMat,
      baseOpacity: cfg.opacity,
      rimMat,
      baseRimOpacity: cfg.rimOpacity,
    });
  });

  // Composite Fluffy 3D Clouds in Troposfer (band 0)
  const cloudWhiteMat = regMat(
    'atmosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.9,
        metalness: 0.0,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.08,
      }),
    ),
  );
  const cloudRainMat = regMat(
    'atmosfer',
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.92,
        metalness: 0.0,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.1,
      }),
    ),
  );
  const puffGeo = trackGeo(new THREE.SphereGeometry(0.18, 10, 8));

  const buildCloud = (isRainCloud: boolean): THREE.Group => {
    const cg = new THREE.Group();
    const mat = isRainCloud ? cloudRainMat : cloudWhiteMat;
    const puffs: Array<[number, number, number, number]> = [
      [-0.22, -0.02, 0.0, 0.78],
      [-0.06, 0.06, 0.04, 1.02],
      [0.14, 0.04, -0.03, 0.94],
      [0.28, -0.03, 0.02, 0.72],
      [0.02, -0.04, -0.1, 0.8],
    ];
    puffs.forEach(([px, py, pz, sc]) => {
      const m = new THREE.Mesh(puffGeo, mat);
      m.position.set(px, py, pz);
      m.scale.set(sc * 1.15, sc * 0.78, sc);
      m.userData.layerId = 'atmosfer';
      m.userData.atmosSubId = 'troposfer';
      cg.add(m);
      pickables.push(m);
    });
    return cg;
  };

  const cloudSpecs: Array<{ x: number; y: number; z: number; rain: boolean; speed: number }> = [
    { x: -1.15, y: 0.02, z: -0.15, rain: true, speed: 0.04 },
    { x: 0.35, y: 0.08, z: -0.65, rain: false, speed: 0.07 },
    { x: 1.35, y: 0.04, z: 0.45, rain: false, speed: 0.055 },
    { x: -0.2, y: 0.1, z: 0.85, rain: false, speed: 0.065 },
  ];
  const cloudNodes = cloudSpecs.map((spec) => {
    const c = buildCloud(spec.rain);
    c.position.set(spec.x, spec.y, spec.z);
    atmosBands[0].group.add(c);
    return { node: c, baseX: spec.x, baseZ: spec.z, speed: spec.speed };
  });

  // Composite 5-Part Miniature Airplane cruising in Stratosfer (band 1)
  const planeGroup = new THREE.Group();
  const planeBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.28,
      metalness: 0.35,
    }),
  );
  const planeAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.3,
      metalness: 0.4,
    }),
  );
  const fuselage = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.032, 0.19, 6, 10)),
    planeBodyMat,
  );
  fuselage.rotation.z = Math.PI / 2;
  fuselage.userData.layerId = 'atmosfer';
  fuselage.userData.atmosSubId = 'stratosfer';
  const mainWing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.065, 0.01, 0.28)),
    planeAccentMat,
  );
  mainWing.userData.layerId = 'atmosfer';
  mainWing.userData.atmosSubId = 'stratosfer';
  const tailWing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.035, 0.008, 0.11)),
    planeAccentMat,
  );
  tailWing.position.set(-0.1, 0.012, 0);
  const tailFin = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.042, 0.058, 0.01)),
    planeAccentMat,
  );
  tailFin.position.set(-0.1, 0.04, 0);
  planeGroup.add(fuselage, mainWing, tailWing, tailFin);
  planeGroup.position.set(0, 0.14, 0);
  atmosBands[1].group.add(planeGroup);
  pickables.push(fuselage, mainWing);

  // Glowing Shooting Meteoroid in Mesosfer (band 2)
  const meteorGroup = new THREE.Group();
  const meteorRock = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.046, 0)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        roughness: 0.3,
        emissive: new THREE.Color(0xf97316),
        emissiveIntensity: 1.5,
      }),
    ),
  );
  meteorRock.userData.layerId = 'atmosfer';
  meteorRock.userData.atmosSubId = 'mesosfer';
  const meteorTail = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.038, 0.34, 6)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
      }),
    ),
  );
  meteorTail.rotation.z = -Math.PI / 2;
  meteorTail.position.set(0.16, 0, 0);
  meteorTail.userData.layerId = 'atmosfer';
  meteorTail.userData.atmosSubId = 'mesosfer';
  meteorGroup.add(meteorRock, meteorTail);
  meteorGroup.rotation.z = 0.42;
  atmosBands[2].group.add(meteorGroup);
  pickables.push(meteorRock);

  // Shimmering 3D Aurora Ribbon & Miniature Satellite in Termosfer & Eksosfer (band 3)
  const auroraGeo = trackGeo(new THREE.PlaneGeometry(2.7, 0.28, 22, 1));
  const aPos = auroraGeo.attributes.position as THREE.BufferAttribute;
  const aColors = new Float32Array(aPos.count * 3);
  const cAuroraGreen = new THREE.Color(0x34d399);
  const cAuroraCyan = new THREE.Color(0x38bdf8);
  const cAuroraViolet = new THREE.Color(0xa78bfa);
  for (let i = 0; i < aPos.count; i++) {
    const ax = aPos.getX(i);
    const ay = aPos.getY(i);
    const t = (ax + 1.35) / 2.7;
    const waveZ = Math.sin(t * Math.PI * 2.2) * 0.34;
    const archY = Math.sin(t * Math.PI) * 0.08;
    aPos.setZ(i, waveZ);
    aPos.setY(i, ay + archY);
    if (t < 0.5) {
      _color.copy(cAuroraGreen).lerp(cAuroraCyan, t * 2);
    } else {
      _color.copy(cAuroraCyan).lerp(cAuroraViolet, (t - 0.5) * 2);
    }
    // Softly fade top edge slightly higher brilliance
    if (ay < 0) _color.multiplyScalar(0.82);
    aColors[i * 3] = _color.r;
    aColors[i * 3 + 1] = _color.g;
    aColors[i * 3 + 2] = _color.b;
  }
  auroraGeo.setAttribute('color', new THREE.BufferAttribute(aColors, 3));
  auroraGeo.computeVertexNormals();

  const auroraMat = trackMat(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const auroraRibbon = new THREE.Mesh(auroraGeo, auroraMat);
  auroraRibbon.position.set(-0.25, 0.26, -0.35);
  auroraRibbon.renderOrder = 10;
  auroraRibbon.userData.layerId = 'atmosfer';
  auroraRibbon.userData.atmosSubId = 'termosfer';
  atmosBands[3].group.add(auroraRibbon);
  pickables.push(auroraRibbon);

  // Composite Miniature Satellite gliding in Termosfer (band 3)
  const satGroup = new THREE.Group();
  const satBusMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.22,
    }),
  );
  const satSolarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      metalness: 0.55,
      roughness: 0.2,
      emissive: new THREE.Color(0x1e3a8a),
      emissiveIntensity: 0.35,
    }),
  );
  const satBus = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 6)),
    satBusMat,
  );
  satBus.userData.layerId = 'atmosfer';
  satBus.userData.atmosSubId = 'termosfer';
  const satWingGeo = trackGeo(new THREE.BoxGeometry(0.2, 0.008, 0.07));
  const satLeft = new THREE.Mesh(satWingGeo, satSolarMat);
  satLeft.position.set(-0.15, 0, 0);
  satLeft.userData.layerId = 'atmosfer';
  satLeft.userData.atmosSubId = 'termosfer';
  const satRight = new THREE.Mesh(satWingGeo, satSolarMat);
  satRight.position.set(0.15, 0, 0);
  satRight.userData.layerId = 'atmosfer';
  satRight.userData.atmosSubId = 'termosfer';
  satGroup.add(satBus, satLeft, satRight);
  satGroup.position.set(0.5, 0.2, -0.2);
  atmosBands[3].group.add(satGroup);
  pickables.push(satBus, satLeft, satRight);

  // =========================================================================
  // 5. 3D PROJECTED LABEL ANCHORS (4 Main Surface Components + 4 Atmosfer Strata)
  // =========================================================================
  const labelAnchors: SurfaceLabelAnchor[] = [];
  const addAnchor = (
    id: LayerId,
    label: string,
    parent: THREE.Object3D,
    pos: [number, number, number],
  ) => {
    const node = new THREE.Object3D();
    node.position.set(pos[0], pos[1], pos[2]);
    parent.add(node);
    labelAnchors.push({ id, label, node });
  };
  addAnchor('litosfer', 'Litosfer', litosferGroup, [-1.72, 1.15, -0.45]);
  addAnchor('hidrosfer', 'Hidrosfer', hidrosferGroup, [1.55, 0.18, 0.55]);
  addAnchor('biosfer', 'Biosfer', biosferGroup, [-0.15, 0.58, 0.65]);
  // Anchor general Atmosfer badge on the left canopy edge so right edge stays crisp for the 4 altitude layers
  addAnchor('atmosfer', 'Atmosfer', atmosBands[1].group, [-2.05, 0.16, 0.95]);

  const atmosLabelAnchors: AtmosLabelAnchor[] = [];
  atmosBands.forEach((band) => {
    const node = new THREE.Object3D();
    node.position.set(2.12, 0.08, 1.22);
    band.group.add(node);
    atmosLabelAnchors.push({ id: band.id, node });
  });

  // =========================================================================
  // 6. PER-FRAME LIGHTWEIGHT ANIMATION UPDATE
  // =========================================================================
  const update = (
    elapsed: number,
    separation: number,
    isSoftwareGl: boolean,
    activeLayerId: LayerId | null,
    tourRunning: boolean,
    activeAtmosSubId: AtmosSubLayerId | null,
  ) => {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);

    // Smoothly lift atmospheric strata when user drags "Pisah Lapisan" or focuses an altitude band
    for (let i = 0; i < atmosBands.length; i++) {
      const b = atmosBands[i];
      b.group.position.y = b.baseY + separation * b.liftFactor;

      if (activeAtmosSubId) {
        if (b.id === activeAtmosSubId) {
          b.bandMat.opacity = Math.min(0.56, b.baseOpacity + 0.24 + pulse * 0.12);
          b.bandMat.emissiveIntensity = 0.88 + pulse * 0.36;
          b.rimMat.opacity = 1.0;
        } else {
          b.bandMat.opacity = b.baseOpacity * 0.35;
          b.bandMat.emissiveIntensity = 0.16;
          b.rimMat.opacity = b.baseRimOpacity * 0.38;
        }
      } else if (activeLayerId === 'atmosfer') {
        b.bandMat.opacity = Math.min(0.46, b.baseOpacity + 0.14 + pulse * 0.1);
        b.bandMat.emissiveIntensity = 0.62 + pulse * 0.24;
        b.rimMat.opacity = Math.min(0.98, b.baseRimOpacity + 0.3 + pulse * 0.15);
      } else if (tourRunning && activeLayerId) {
        b.bandMat.opacity = b.baseOpacity * 0.5;
        b.bandMat.emissiveIntensity = 0.22;
        b.rimMat.opacity = b.baseRimOpacity * 0.5;
      } else {
        b.bandMat.opacity = b.baseOpacity;
        b.bandMat.emissiveIntensity = 0.36;
        b.rimMat.opacity = b.baseRimOpacity;
      }
    }

    // Gentle Aurora shimmer in Termosfer
    const auroraBase =
      activeAtmosSubId === 'termosfer'
        ? 0.74
        : activeLayerId === 'atmosfer'
          ? 0.56
          : activeAtmosSubId
            ? 0.16
            : 0.36;
    auroraMat.opacity = auroraBase + Math.sin(elapsed * 2.4) * 0.08;
    if (!isSoftwareGl) {
      auroraRibbon.position.y = 0.26 + Math.sin(elapsed * 1.4) * 0.03;
    }

    if (isSoftwareGl) return;

    // Gentle ocean surface ripples (skip expensive per-vertex work in Eco/lightweight on alternate frames? Cheap at 15x15 = 256 verts!)
    const oPos = oceanTopGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < oPos.count; i++) {
      const ox = oPos.getX(i);
      const oz = oPos.getZ(i);
      const wave =
        Math.sin(ox * 3.4 + elapsed * 2.1) * 0.016 +
        Math.cos(oz * 2.8 - elapsed * 1.7) * 0.012;
      oPos.setY(i, oceanBaseY[i] + wave);
    }
    oPos.needsUpdate = true;

    // Rising ocean evaporation vapor (Hidrosfer -> Atmosfer water cycle)
    const maxVaporRise = 1.08 + separation * 0.2;
    for (let i = 0; i < vaporCount; i++) {
      const s = vaporSeeds[i];
      const cycle = ((elapsed * s.speed + s.phase) % 1 + 1) % 1;
      const vx = s.x + Math.sin(elapsed * 1.4 + s.phase) * 0.08;
      const vy = WATER_Y + 0.08 + cycle * maxVaporRise;
      const vz = s.z + Math.cos(elapsed * 1.1 + s.phase) * 0.06;
      const fadeScale = Math.sin(cycle * Math.PI);
      _dummy.position.set(vx, vy, vz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(0.45 + fadeScale * 0.85);
      _dummy.updateMatrix();
      vaporMesh.setMatrixAt(i, _dummy.matrix);
    }
    vaporMesh.instanceMatrix.needsUpdate = true;

    // Gentle rain streaks under mountain rain cloud
    const cloudY = atmosBands[0].group.position.y - 0.08;
    for (let i = 0; i < rainCount; i++) {
      const rs = rainSeeds[i];
      const drop = (elapsed * 0.72 + rs.offset) % 1;
      const rx = rs.x;
      const rz = rs.z;
      const groundY = surfaceHeightAt(rx, rz);
      const ry = THREE.MathUtils.lerp(cloudY, groundY + 0.06, drop);
      _dummy.position.set(rx, ry, rz);
      _dummy.rotation.set(0, 0, 0.1);
      _dummy.scale.setScalar(1.0);
      _dummy.updateMatrix();
      rainMesh.setMatrixAt(i, _dummy.matrix);
    }
    rainMesh.instanceMatrix.needsUpdate = true;

    // Windmill spinning
    millHub.rotation.z = -elapsed * 2.6;

    // Soaring birds
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      const a = elapsed * 0.55 + b.phase;
      const bx = -0.15 + Math.cos(a) * b.radius;
      const bz = Math.sin(a) * (b.radius * 0.72);
      const by = b.height + Math.sin(elapsed * 1.6 + b.phase) * 0.06;
      b.group.position.set(bx, by, bz);
      // Face tangent direction
      b.group.rotation.y = -a + Math.PI;
      const flap = Math.sin(elapsed * 9.5 + b.phase) * 0.48;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }

    // Swimming coastal reef fish inside clear ocean volume
    for (let i = 0; i < fishCount; i++) {
      const a = elapsed * 0.6 + i * 0.72;
      const fx = 1.48 + Math.cos(a) * (0.45 + (i % 3) * 0.14);
      const fz = Math.sin(a * 1.2) * (0.58 + (i % 2) * 0.24);
      const fy = -0.14 - (i % 3) * 0.065;
      _v3.set(
        -Math.sin(a) * 0.5,
        0,
        Math.cos(a * 1.2) * 0.7,
      );
      _dummy.position.set(fx, fy, fz);
      _dummy.rotation.set(0, Math.atan2(-_v3.z, _v3.x), 0);
      _dummy.scale.setScalar(0.85 + (i % 3) * 0.16);
      _dummy.updateMatrix();
      fishMesh.setMatrixAt(i, _dummy.matrix);
    }
    fishMesh.instanceMatrix.needsUpdate = true;

    // Drifting Troposfer clouds
    for (let i = 0; i < cloudNodes.length; i++) {
      const cn = cloudNodes[i];
      cn.node.position.x = cn.baseX + Math.sin(elapsed * cn.speed * 4 + i * 1.5) * 0.28;
    }

    // Cruising Stratosfer airplane
    const pAngle = elapsed * 0.45;
    planeGroup.position.set(
      Math.cos(pAngle) * 1.35,
      0.16,
      Math.sin(pAngle) * 0.75,
    );
    planeGroup.rotation.y = -pAngle - Math.PI / 2;
    planeGroup.rotation.x = 0.12;

    // Periodic Mesosfer meteor streak burning up safely
    const mCycle = (elapsed * 0.28) % 1;
    const mVisible = mCycle < 0.48;
    meteorGroup.visible = mVisible;
    if (mVisible) {
      const mt = mCycle / 0.48;
      meteorGroup.position.set(
        THREE.MathUtils.lerp(1.7, -0.4, mt),
        THREE.MathUtils.lerp(0.32, 0.04, mt),
        THREE.MathUtils.lerp(-0.5, 0.35, mt),
      );
      const fade = Math.sin(mt * Math.PI);
      meteorGroup.scale.setScalar(0.5 + fade * 0.75);
    }

    // Gliding Termosfer satellite
    satGroup.position.x = Math.sin(elapsed * 0.32) * 1.4;
    satGroup.position.z = Math.cos(elapsed * 0.32) * 0.65;
    satGroup.rotation.y = elapsed * 0.4;
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return {
    root,
    pickables,
    labelAnchors,
    atmosLabelAnchors,
    highlightMaterials,
    update,
    dispose,
  };
}

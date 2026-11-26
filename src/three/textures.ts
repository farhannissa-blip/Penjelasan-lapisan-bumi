import * as THREE from 'three';

/**
 * Ultra-fast deterministic integer hash (xxHash32 avalanche mix).
 * ~10x faster than Math.sin() in JS engines while producing clean, organic noise.
 */
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10;
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm3D(x: number, y: number, z: number, octaves = 3): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    const n1 = valueNoise2D(x * freq + 17.3, y * freq + 9.1);
    const n2 = valueNoise2D(y * freq + 31.7, z * freq + 5.4);
    const n3 = valueNoise2D(z * freq + 43.2, x * freq + 13.8);
    value += (n1 + n2 + n3) * (amp / 3);
    freq *= 2.08;
    amp *= 0.5;
  }
  return value;
}

interface ContinentBlob {
  lat: number;
  lon: number;
  invRxSq: number;
  invRySq: number;
  weight: number;
}

const RAW_CONTINENTS: Array<[number, number, number, number, number]> = [
  // North America
  [46, -102, 32, 21, 0.94],
  [24, -102, 13, 14, 0.68],
  [69, -42, 14, 11, 0.8], // Greenland
  // South America
  [-10, -60, 18, 21, 0.92],
  [-35, -66, 9, 16, 0.78],
  // Europe
  [50, 16, 22, 13, 0.84],
  [62, 18, 12, 10, 0.7],
  // Africa
  [15, 16, 25, 18, 0.98],
  [-14, 25, 14, 20, 0.9],
  // Asia
  [54, 84, 46, 21, 0.98],
  [32, 96, 28, 18, 0.94],
  [21, 78, 12, 14, 0.78], // India
  [16, 103, 9, 10, 0.68], // SE Asia
  // Indonesia Archipelago
  [-1, 101, 6, 5, 0.7],
  [-7, 110, 6.5, 2.6, 0.7],
  [0.5, 115, 6, 6, 0.76],
  [-2, 121, 4, 4.5, 0.66],
  [-5, 138, 9, 4.5, 0.76],
  // Australia
  [-25, 134, 19, 13, 0.9],
];

const CONTINENT_BLOBS: ContinentBlob[] = RAW_CONTINENTS.map(([lat, lon, rx, ry, weight]) => ({
  lat,
  lon,
  invRxSq: 1 / (rx * rx),
  invRySq: 1 / (ry * ry),
  weight,
}));

function sampleElevationFast(
  latDeg: number,
  lonDeg: number,
  sx: number,
  sy: number,
  sz: number,
): number {
  let continentField = -0.34;

  for (let i = 0; i < CONTINENT_BLOBS.length; i++) {
    const b = CONTINENT_BLOBS[i];
    const dLat = latDeg - b.lat;
    const latTerm = dLat * dLat * b.invRySq;
    if (latTerm >= 2.2) continue;

    let dLon = lonDeg - b.lon;
    if (dLon > 180) dLon -= 360;
    else if (dLon < -180) dLon += 360;

    const distSq = dLon * dLon * b.invRxSq + latTerm;
    if (distSq < 2.2) {
      const influence = Math.exp(-distSq * 1.45) * b.weight - 0.34;
      if (influence > continentField) {
        continentField = influence;
      }
    }
  }

  if (latDeg < -66) {
    const southBoost = Math.min(1, (-66 - latDeg) / 14) * 0.74 - 0.12;
    if (southBoost > continentField) continentField = southBoost;
  }

  const detail = (fbm3D(sx * 3.2, sy * 3.2, sz * 3.2, 3) - 0.5) * 0.42;
  const fine = (fbm3D(sx * 9.0, sy * 9.0, sz * 9.0, 2) - 0.5) * 0.14;
  return continentField + detail + fine;
}

export function sampleEarthElevation(latDeg: number, lonDeg: number): number {
  const latRad = latDeg * 0.017453292519943295;
  const lonRad = lonDeg * 0.017453292519943295;
  const cosLat = Math.cos(latRad);
  return sampleElevationFast(
    latDeg,
    lonDeg,
    cosLat * Math.cos(lonRad),
    Math.sin(latRad),
    cosLat * Math.sin(lonRad),
  );
}

export interface EarthSurfaceTextures {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Generates crisp Blue Marble photorealistic Earth surface textures
 * optimized for instant startup (<40ms) and low VRAM on mobile phones & PIDs.
 */
export function createEarthSurfaceTextures(
  maxAnisotropy: number,
  isLightweight: boolean,
): EarthSurfaceTextures {
  const width = isLightweight ? 512 : 768;
  const height = isLightweight ? 256 : 384;
  const aniso = Math.min(maxAnisotropy, isLightweight ? 2 : 4);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorCtx = colorCanvas.getContext('2d')!;
  const colorImg = colorCtx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(width, height);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(width, height);

  const cData = colorImg.data;
  const bData = bumpImg.data;
  const rData = roughImg.data;

  // Precompute longitude trig tables once (eliminates width*height trig calls)
  const lonDegs = new Float32Array(width);
  const cosLons = new Float32Array(width);
  const sinLons = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const lonDeg = (x / (width - 1)) * 360 - 180;
    const lonRad = lonDeg * 0.017453292519943295;
    lonDegs[x] = lonDeg;
    cosLons[x] = Math.cos(lonRad);
    sinLons[x] = Math.sin(lonRad);
  }

  for (let y = 0; y < height; y++) {
    const latDeg = 90 - (y / (height - 1)) * 180;
    const absLat = Math.abs(latDeg);
    const latRad = latDeg * 0.017453292519943295;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const desertBand = Math.exp(-Math.pow((absLat - 23) / 11.5, 2));
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const sx = cosLat * cosLons[x];
      const sy = sinLat;
      const sz = cosLat * sinLons[x];

      const elev = sampleElevationFast(latDeg, lonDegs[x], sx, sy, sz);
      const idx = (rowOffset + x) * 4;

      const moisture = fbm3D(sx * 4.6 + 3.2, sy * 4.6, sz * 4.6 + 1.7, 2);
      const micro = valueNoise2D(sx * 14.0 + sz * 7.0, sy * 14.0 + sx * 5.0);

      let r = 0;
      let g = 0;
      let b = 0;
      let bumpVal = 36;
      let roughVal = 42;

      const iceLine = 73 + (moisture - 0.5) * 9;
      if (absLat > iceLine) {
        r = 232;
        g = 241;
        b = 250;
        bumpVal = 135;
        roughVal = 92;
      } else if (elev <= 0) {
        const depth = Math.min(1, Math.max(0, -elev * 2.5));
        if (depth < 0.14) {
          const t = depth / 0.14;
          r = 36 - t * 18;
          g = 162 - t * 64;
          b = 194 - t * 28;
        } else {
          const t = (depth - 0.14) / 0.86;
          r = 14 - t * 8;
          g = 88 - t * 52;
          b = 160 - t * 76;
        }
        const mShift = micro - 0.5;
        r += mShift * 6;
        g += mShift * 10;
        b += mShift * 14;
        bumpVal = 26;
        roughVal = 38;
      } else {
        const h = Math.min(1, elev * 2.15);
        bumpVal = Math.min(255, (100 + h * 155) | 0);
        roughVal = 222;
        const mShift = micro - 0.5;

        if (h > 0.66) {
          const snow = Math.min(1, (h - 0.66) / 0.24);
          r = 122 + snow * 116;
          g = 104 + snow * 134;
          b = 88 + snow * 150;
          roughVal = (190 - snow * 45) | 0;
        } else if (h > 0.45) {
          r = 124 + mShift * 24;
          g = 98 + mShift * 20;
          b = 72 + mShift * 16;
        } else {
          const aridity = desertBand * 0.76 + (1 - moisture) * 0.5;
          if (aridity > 0.73) {
            r = 204 + mShift * 24;
            g = 168 + mShift * 20;
            b = 114 + mShift * 16;
          } else if (aridity > 0.55) {
            r = 118 + mShift * 20;
            g = 136 + mShift * 20;
            b = 68 + mShift * 14;
          } else {
            const lush = Math.min(1, moisture * 1.18);
            r = 28 + (1 - lush) * 34 + mShift * 14;
            g = 96 + lush * 28 + mShift * 18;
            b = 42 + (1 - lush) * 14 + mShift * 10;
          }
        }
      }

      cData[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
      cData[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      cData[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      cData[idx + 3] = 255;

      bData[idx] = bumpVal;
      bData[idx + 1] = bumpVal;
      bData[idx + 2] = bumpVal;
      bData[idx + 3] = 255;

      rData[idx] = roughVal;
      rData[idx + 1] = roughVal;
      rData[idx + 2] = roughVal;
      rData[idx + 3] = 255;
    }
  }

  colorCtx.putImageData(colorImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = aniso;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = aniso;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = aniso;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  return { colorMap, bumpMap, roughnessMap };
}

/**
 * Swirling realistic Blue Marble cloud deck with trade-wind eddies.
 */
export function createCloudTexture(
  maxAnisotropy: number,
  isLightweight: boolean,
): THREE.CanvasTexture {
  const width = isLightweight ? 384 : 512;
  const height = isLightweight ? 192 : 256;
  const aniso = Math.min(maxAnisotropy, isLightweight ? 2 : 4);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const lonRads = new Float32Array(width);
  const cosLon2 = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const lonRad = ((x / (width - 1)) * 360 - 180) * 0.017453292519943295;
    lonRads[x] = lonRad;
    cosLon2[x] = Math.cos(lonRad * 2.0) * 0.14;
  }

  for (let y = 0; y < height; y++) {
    const latRad = (90 - (y / (height - 1)) * 180) * 0.017453292519943295;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const sinLat6 = Math.sin(latRad * 6.0) * 0.34;
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const swirlLon = lonRads[x] + sinLat6 + cosLon2[x];
      const sx = cosLat * Math.cos(swirlLon);
      const sy = sinLat;
      const sz = cosLat * Math.sin(swirlLon);

      const macro = fbm3D(sx * 3.8 + 11.4, sy * 5.2, sz * 3.8 + 7.8, 3);
      const wispy = fbm3D(sx * 9.5 + 2.1, sy * 11.0, sz * 9.5 + 4.3, 2);
      const combined = macro * 0.72 + wispy * 0.28;
      const alpha = Math.max(0, Math.min(1, (combined - 0.5) * 3.35));

      const idx = (rowOffset + x) * 4;
      data[idx] = 250;
      data[idx + 1] = 253;
      data[idx + 2] = 255;
      data[idx + 3] = (alpha * 235) | 0;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Generates craggy rocky crust, glowing magma mantle, molten outer core,
 * and incandescent inner core shell textures.
 */
export function createGeologicalShellTexture(
  kind: 'crust-rock' | 'mantle' | 'outer-core' | 'inner-core',
  maxAnisotropy: number,
  isLightweight: boolean,
): { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = isLightweight ? 128 : 192;
  const aniso = Math.min(maxAnisotropy, isLightweight ? 2 : 4);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(size, size);

  const cosA = new Float32Array(size);
  const sinA = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const angle = (x / size) * Math.PI * 2;
    cosA[x] = Math.cos(angle);
    sinA[x] = Math.sin(angle);
  }

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowOffset = y * size;
    for (let x = 0; x < size; x++) {
      const ca = cosA[x];
      const sa = sinA[x];

      const n1 = fbm3D(ca * 2.8, v * 5.6, sa * 2.8, 3);
      const n2 = fbm3D(ca * 7.2 + 4.1, v * 12.0, sa * 7.2 + 2.3, 2);
      const ridge = 1 - Math.abs(n1 * 2 - 1);
      const veins = ridge * ridge;

      let r = 180;
      let g = 80;
      let b = 30;
      let bv = (veins * 255) | 0;

      if (kind === 'crust-rock') {
        const cBase = 1 - Math.abs(n2 * 2 - 1);
        const crack = cBase * cBase * cBase;
        const rock = 0.55 + n1 * 0.55 - crack * 0.35;
        r = 104 * rock;
        g = 76 * rock;
        b = 58 * rock;
        bv = Math.max(0, Math.min(255, ((n1 * 0.65 + (1 - crack) * 0.35) * 255) | 0));
      } else if (kind === 'mantle') {
        const glow = Math.min(1, veins * 0.78 + n2 * 0.35);
        r = 175 + glow * 80;
        g = 42 + glow * 138;
        b = 6 + glow * 34;
      } else if (kind === 'outer-core') {
        const plasma = Math.min(1, veins * 0.65 + n2 * 0.52);
        r = 244 + plasma * 11;
        g = 128 + plasma * 116;
        b = 12 + plasma * 110;
      } else {
        const hot = Math.min(1, 0.55 + veins * 0.3 + n2 * 0.28);
        r = 255;
        g = 232 + hot * 23;
        b = 152 + hot * 96;
      }

      const idx = (rowOffset + x) * 4;
      cImg.data[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
      cImg.data[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      cImg.data[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      cImg.data[idx + 3] = 255;

      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = aniso;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = aniso;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { colorMap, bumpMap };
}

/**
 * Generates radial cross-section textures for Crust, Mantle (with magma convection loops),
 * and Outer Core at compact VRAM-friendly resolution.
 */
export function createCrossSectionRingTexture(
  layer: 'kerak' | 'mantel' | 'inti-luar',
  maxAnisotropy: number,
  isLightweight: boolean,
): THREE.CanvasTexture {
  const size = isLightweight ? 256 : 384;
  const aniso = Math.min(maxAnisotropy, isLightweight ? 2 : 4);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;
  const invCx = 1 / cx;
  const grainScale = 0.09 * (512 / size);

  for (let y = 0; y < size; y++) {
    const dy = (y - cy) * invCx;
    const rowOffset = y * size;
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) * invCx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const cosAng = Math.cos(angle);
      const sinAng = Math.sin(angle);

      const swirl = valueNoise2D(
        dist * 9.0 + cosAng * 3.0 + 5.2,
        sinAng * 3.0 + dist * 4.0 + 7.1,
      );
      const grain = valueNoise2D(x * grainScale, y * grainScale);
      const idx = (rowOffset + x) * 4;

      let r = 120;
      let g = 80;
      let b = 40;

      if (layer === 'kerak') {
        const cBase = 1 - Math.abs(grain * 2 - 1);
        const crack = cBase * cBase * cBase;
        const shade = 0.6 + swirl * 0.48 - crack * 0.32;
        r = 112 * shade;
        g = 80 * shade;
        b = 60 * shade;
      } else if (layer === 'mantel') {
        const radialNorm = Math.max(0, Math.min(1, (dist - 0.58) / 0.4));
        const baseHeat = Math.max(0, Math.min(1, 1.05 - radialNorm * 0.62 + (swirl - 0.5) * 0.38));

        const cellCount = 10;
        const cellAngle = ((angle + Math.PI) / (Math.PI * 2)) * cellCount;
        const localA = (cellAngle - Math.floor(cellAngle) - 0.5) * 2.0;
        const localR = (radialNorm - 0.5) * 2.0;
        const ellipseDist = Math.sqrt(localA * localA * 1.15 + localR * localR * 1.25);
        const bandDiff = (ellipseDist - 0.64 + (grain - 0.5) * 0.14) / 0.11;
        const loopBand = Math.exp(-bandDiff * bandDiff);

        r = 186 + baseHeat * 69 - loopBand * 72;
        g = 48 + baseHeat * 124 - loopBand * 74;
        b = 8 + baseHeat * 28 - loopBand * 12;
      } else {
        const innerHot = Math.max(0, Math.min(1, 1.15 - dist * 0.52 + (swirl - 0.5) * 0.45));
        const filament = Math.pow(1 - Math.abs(grain * 2 - 1), 1.8);
        r = 248 + innerHot * 7;
        g = 138 + innerHot * 102 + filament * 24;
        b = 18 + innerHot * 116 + filament * 40;
      }

      img.data[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
      img.data[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      img.data[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  return tex;
}

/**
 * Generates a soft additive radial luminescence sprite texture for the incandescent Inner Core.
 */
export function createCoreGlowTexture(): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;

  const grad = ctx.createRadialGradient(cx, cx, size * 0.08, cx, cx, cx);
  grad.addColorStop(0.0, 'rgba(255, 252, 224, 0.92)');
  grad.addColorStop(0.32, 'rgba(255, 220, 102, 0.52)');
  grad.addColorStop(0.65, 'rgba(255, 130, 24, 0.18)');
  grad.addColorStop(1.0, 'rgba(255, 80, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


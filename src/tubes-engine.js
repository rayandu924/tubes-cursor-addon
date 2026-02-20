/**
 * TubesCursor Engine
 * Everything in one file: renderer, tubes, bloom, mouse tracking.
 */

import {
  WebGLRenderer, PerspectiveCamera, Clock, Raycaster, Plane,
  Vector3, Vector2, PointLight, MeshStandardMaterial, Mesh, Color, Group,
  TubeGeometry, CatmullRomCurve3, WebGLRenderTarget, HalfFloatType,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ─── Precomputed sin/cos for 8 radial segments ───

const RADIAL = 8;
const sinT = [], cosT = [];
for (let j = 0; j <= RADIAL; j++) {
  const a = (j / RADIAL) * Math.PI * 2;
  sinT[j] = Math.sin(a);
  cosT[j] = -Math.cos(a);
}

// ─── Parallel transport frames (the real perf optimization) ───

const _axis = new Vector3();

function computeFrames(points, tangents, normals, binormals) {
  const len = points.length;

  tangents[0].subVectors(points[1], points[0]).normalize();
  for (let i = 1; i < len - 1; i++)
    tangents[i].subVectors(points[i + 1], points[i - 1]).normalize();
  tangents[len - 1].subVectors(points[len - 1], points[len - 2]).normalize();

  const t0 = tangents[0];
  const ax = Math.abs(t0.x), ay = Math.abs(t0.y), az = Math.abs(t0.z);
  if (ax <= ay && ax <= az) _axis.set(1, 0, 0);
  else if (ay <= az) _axis.set(0, 1, 0);
  else _axis.set(0, 0, 1);
  normals[0].crossVectors(t0, _axis).normalize();
  binormals[0].crossVectors(t0, normals[0]);

  for (let i = 1; i < len; i++) {
    normals[i].copy(normals[i - 1]);
    _axis.crossVectors(tangents[i - 1], tangents[i]);
    const sinA = _axis.length();
    if (sinA > 1e-6) {
      const inv = 1 / sinA;
      const kx = _axis.x * inv, ky = _axis.y * inv, kz = _axis.z * inv;
      const cosA = tangents[i - 1].dot(tangents[i]);
      const omc = 1 - cosA;
      const n = normals[i], nx = n.x, ny = n.y, nz = n.z;
      const cx = ky * nz - kz * ny, cy = kz * nx - kx * nz, cz = kx * ny - ky * nx;
      const d = kx * nx + ky * ny + kz * nz;
      n.x = nx * cosA + cx * sinA + kx * d * omc;
      n.y = ny * cosA + cy * sinA + ky * d * omc;
      n.z = nz * cosA + cz * sinA + kz * d * omc;
    }
    binormals[i].crossVectors(tangents[i], normals[i]);
  }
}

function updateVertices(geo) {
  const { tubularSegments, radius } = geo.parameters;
  const pos = geo.getAttribute('position').array;
  const nrm = geo.getAttribute('normal').array;
  const points = geo.curve.points;
  const N = geo._normals, B = geo._binormals;
  const stride = (RADIAL + 1) * 3;

  for (let i = 0; i <= tubularSegments; i++) {
    const r = Math.sin((i / tubularSegments) * Math.PI) * radius;
    const p = points[i], Ni = N[i], Bi = B[i];
    let idx = i * stride;
    for (let j = 0; j <= RADIAL; j++) {
      const nx = cosT[j] * Ni.x + sinT[j] * Bi.x;
      const ny = cosT[j] * Ni.y + sinT[j] * Bi.y;
      const nz = cosT[j] * Ni.z + sinT[j] * Bi.z;
      const len = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      pos[idx] = p.x + r * nx * len;
      pos[idx + 1] = p.y + r * ny * len;
      pos[idx + 2] = p.z + r * nz * len;
      nrm[idx] = nx * len;
      nrm[idx + 1] = ny * len;
      nrm[idx + 2] = nz * len;
      idx += 3;
    }
  }
  geo.getAttribute('position').needsUpdate = true;
  geo.getAttribute('normal').needsUpdate = true;
}

// ─── Tube geometry (extends TubeGeometry for initial buffer setup) ───

class TubeGeo extends TubeGeometry {
  constructor(segments, radius) {
    const pts = Array.from({ length: segments + 1 }, (_, i) =>
      new Vector3(0, 0, (-i / segments) * 2)
    );
    const curve = new CatmullRomCurve3(pts);
    super(curve, segments, radius, RADIAL, false);
    this.curve = curve;
    const n = segments + 1;
    this._tangents = Array.from({ length: n }, () => new Vector3());
    this._normals = Array.from({ length: n }, () => new Vector3());
    this._binormals = Array.from({ length: n }, () => new Vector3());
  }

  update() {
    computeFrames(this.curve.points, this._tangents, this._normals, this._binormals);
    updateVertices(this);
  }
}

// ─── Main factory ───

export function TubesCursor(canvas, opts = {}) {
  let {
    bloom: bloomCfg = null,
    tubeCount = 16, minRadius = 0.005, maxRadius = 0.03,
    minSegments = 32, maxSegments = 64,
    metalness = 1, roughness = 0.25,
    colors = ['#f967fb', '#ff6b6b', '#53bc28'],
    lightIntensity = 200,
    lightColors = ['#83f36e', '#fe8a2e', '#ff008a', '#60aed5'],
    lerp: lerpVal = 0.85, noise: noiseVal = 0.05,
  } = opts;

  // Sleep mode (hardcoded, not user-configurable)
  const sleepRadiusX = 300, sleepRadiusY = 150, sleepSpeedX = 1, sleepSpeedY = 2;

  // Renderer
  const renderer = new WebGLRenderer({
    canvas, alpha: true, antialias: false, premultipliedAlpha: false,
  });
  renderer.setClearColor(0x000000, 0);

  const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);
  const clock = new Clock();
  const scene = new Group();

  // Size state
  let w = 0, h = 0, wW = 0;

  // Cached canvas rect for mouse conversion
  let rectLeft = 0, rectTop = 0, rectW = 1, rectH = 1;

  function resize() {
    const parent = canvas.parentElement || document.body;
    const pw = parent.clientWidth, ph = parent.clientHeight;
    if (pw <= 0 || ph <= 0 || (pw === w && ph === h)) return;
    w = pw; h = ph;
    const fov = camera.fov * Math.PI / 180;
    wW = 2 * Math.tan(fov / 2) * 5 * (w / h);
    camera.aspect = Math.min(w / h, 1.5);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1), 1.5));
    renderer.setSize(w, h);
    if (bloom) bloom.resize(w, h);
    const r = canvas.getBoundingClientRect();
    rectLeft = r.left; rectTop = r.top; rectW = r.width || w; rectH = r.height || h;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement || document.body);

  // Context loss
  let contextLost = false;
  const onCtxLost = (e) => { e.preventDefault(); contextLost = true; };
  const onCtxRestored = () => { contextLost = false; };
  canvas.addEventListener('webglcontextlost', onCtxLost);
  canvas.addEventListener('webglcontextrestored', onCtxRestored);

  // Lights
  const lights = lightColors.map((col, i) => {
    const light = new PointLight(col, lightIntensity);
    light.position.set(i < 2 ? -5 : 5, i % 2 === 0 ? -5 : 5, 5);
    scene.add(light);
    return light;
  });

  // Tubes
  const tubes = [];
  const target = new Vector3();
  const parsedColors = colors.map(c => new Color(c));

  function createTube() {
    const segs = Math.floor(minSegments + Math.random() * (maxSegments - minSegments));
    const rad = minRadius + Math.random() * (maxRadius - minRadius);
    const geo = new TubeGeo(segs, rad);
    const mat = new MeshStandardMaterial({ metalness, roughness });
    const mesh = new Mesh(geo, mat);
    mesh._td = 100 * Math.random(); // time offset for noise
    mesh._pts = geo.curve.points;
    geo.update();
    return mesh;
  }

  function applyColors() {
    // Reuse existing Color objects to avoid GC pressure
    while (parsedColors.length < colors.length) parsedColors.push(new Color());
    parsedColors.length = colors.length;
    colors.forEach((c, i) => parsedColors[i].set(c));
    const div = Math.max(1, tubes.length - 1);
    for (let i = 0; i < tubes.length; i++) {
      const t = i / div;
      const pos = t * (parsedColors.length - 1);
      const idx = Math.min(Math.floor(pos), parsedColors.length - 2);
      const f = pos - idx;
      const a = parsedColors[idx], b = parsedColors[idx + 1];
      tubes[i].material.color.setRGB(a.r + f * (b.r - a.r), a.g + f * (b.g - a.g), a.b + f * (b.b - a.b));
    }
  }

  for (let i = 0; i < tubeCount; i++) {
    tubes[i] = createTube();
    scene.add(tubes[i]);
  }
  applyColors();

  // Bloom
  let bloom = null;

  function makeBloom(cfg) {
    const sz = renderer.getSize(new Vector2());
    const pr = renderer.getPixelRatio();
    const bw = sz.x * pr, bh = sz.y * pr;
    const rt = new WebGLRenderTarget(bw, bh, { type: HalfFloatType });
    const comp = new EffectComposer(renderer, rt);
    const rp = new RenderPass(scene, camera); rp.clearAlpha = 0;
    comp.addPass(rp);
    const bp = new UnrealBloomPass(
      new Vector2(bw / 2, bh / 2), cfg.strength ?? 0.7, cfg.radius ?? 1.5, cfg.threshold ?? 0
    );
    comp.addPass(bp);
    comp.addPass(new OutputPass());
    return {
      render() { comp.render(); },
      resize(width, height) {
        if (width <= 0 || height <= 0) return;
        const p = renderer.getPixelRatio();
        rt.setSize(Math.floor(width * p), Math.floor(height * p));
        comp.setSize(Math.floor(width * p), Math.floor(height * p));
      },
      setParams(p) {
        if (p.threshold !== undefined) bp.threshold = p.threshold;
        if (p.strength !== undefined) bp.strength = p.strength;
        if (p.radius !== undefined) bp.radius = p.radius;
      },
      dispose() { rt.dispose(); comp.dispose(); },
    };
  }

  if (bloomCfg) bloom = makeBloom(bloomCfg);

  // Mouse
  let mouseOver = false;
  const ndc = new Vector2();
  const intersection = new Vector3();
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);

  function onMouseMove(e) {
    mouseOver = true;
    ndc.set(
      ((e.clientX - rectLeft) / rectW) * 2 - 1,
      -((e.clientY - rectTop) / rectH) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    camera.getWorldDirection(plane.normal);
    raycaster.ray.intersectPlane(plane, intersection);
  }
  const onLeave = () => { mouseOver = false; };

  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  // Animation
  let animId = null, disposed = false;

  function animate() {
    if (disposed) return;
    animId = requestAnimationFrame(animate);
    if (contextLost) return;

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    if (mouseOver) {
      target.copy(intersection);
    } else {
      const px = wW / w;
      target.x = sleepRadiusX * px * Math.cos(elapsed * sleepSpeedX);
      target.y = sleepRadiusY * px * Math.sin(elapsed * sleepSpeedY);
      target.z = 0;
    }

    const factor = 1 - Math.pow(1 - lerpVal, delta * 60);
    const inv = 1 - factor;
    const hasNoise = noiseVal > 0;
    const elapsed2 = elapsed * 2;
    const tgtX = target.x, tgtY = target.y, tgtZ = target.z;

    for (let t = 0; t < tubes.length; t++) {
      const mesh = tubes[t];
      const points = mesh._pts;

      let tx = tgtX, ty = tgtY, tz = tgtZ;
      if (hasNoise) {
        const nt = elapsed2 + mesh._td;
        const td = mesh._td;
        tx += (Math.sin(nt * 0.7 + tgtX * 0.01) + Math.sin(nt * 1.3 + td)) * noiseVal;
        ty += (Math.cos(nt * 0.8 + tgtY * 0.01) + Math.sin(nt * 1.1 + td)) * noiseVal;
        tz += (Math.sin(nt * 0.6 + tgtZ * 0.01) + Math.cos(nt * 0.9 + td)) * noiseVal;
      }

      const p0 = points[0];
      p0.x = p0.x * inv + tx * factor;
      p0.y = p0.y * inv + ty * factor;
      p0.z = p0.z * inv + tz * factor;

      for (let i = 1; i < points.length; i++) {
        const c = points[i], p = points[i - 1];
        c.x = c.x * inv + p.x * factor;
        c.y = c.y * inv + p.y * factor;
        c.z = c.z * inv + p.z * factor;
      }

      mesh.geometry.update();
    }

    if (bloom) bloom.render();
    else renderer.render(scene, camera);
  }

  // Init
  resize();
  animate();

  // Public API
  return {
    setTubeColors(c) { colors = c; applyColors(); },
    setLightColors(c) { c.forEach((col, i) => lights[i].color.set(col)); },
    setLightIntensity(v) { lights.forEach(l => { l.intensity = v; }); },
    setMaterial(p) {
      if (p.metalness !== undefined) metalness = p.metalness;
      if (p.roughness !== undefined) roughness = p.roughness;
      tubes.forEach(t => {
        if (p.metalness !== undefined) t.material.metalness = p.metalness;
        if (p.roughness !== undefined) t.material.roughness = p.roughness;
      });
    },
    setLerp(v) { lerpVal = v; },
    setNoise(v) { noiseVal = v; },
    setTubeCount(n) {
      if (n === tubes.length) return;
      while (tubes.length < n) { const t = createTube(); tubes.push(t); scene.add(t); }
      while (tubes.length > n) {
        const t = tubes.pop();
        t.geometry.dispose(); t.material.dispose(); scene.remove(t);
      }
      applyColors();
    },
    setTubeGeometry(o) {
      if (o.maxSegments !== undefined) maxSegments = o.maxSegments;
      if (o.maxRadius !== undefined) maxRadius = o.maxRadius;
      for (const mesh of tubes) {
        const old = mesh.geometry;
        const segs = Math.floor(minSegments + Math.random() * (maxSegments - minSegments));
        const rad = minRadius + Math.random() * (maxRadius - minRadius);
        mesh.geometry = new TubeGeo(segs, rad);
        mesh._pts = mesh.geometry.curve.points;
        old.dispose();
        mesh.geometry.update();
      }
    },
    setBloomEnabled(v) {
      if (v && !bloom) bloom = makeBloom(bloomCfg || {});
      else if (!v && bloom) { bloom.dispose(); bloom = null; }
    },
    setBloomParams(p) {
      if (!bloomCfg) bloomCfg = {};
      Object.assign(bloomCfg, p);
      if (bloom) bloom.setParams(p);
    },
    dispose() {
      disposed = true;
      if (animId) cancelAnimationFrame(animId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onLeave);
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onCtxLost);
      canvas.removeEventListener('webglcontextrestored', onCtxRestored);
      if (bloom) { bloom.dispose(); bloom = null; }
      tubes.forEach(t => { t.geometry.dispose(); t.material.dispose(); });
      renderer.dispose();
    },
  };
}

/**
 * DynamicTubeGeometry
 * A tube geometry that can be updated in real-time
 */

import {
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from 'three';

export class DynamicTubeGeometry extends TubeGeometry {
  constructor(tubularSegments = 64, radius = 1, radialSegments = 8) {
    // Create initial points along Z axis
    const points = new Array(tubularSegments + 1).fill(0).map(() => new Vector3());

    // Initialize points positions
    points.forEach((point, index) => {
      point.z = (-index / tubularSegments) * 2;
    });

    // Create curve from points
    const curve = new CatmullRomCurve3(points);

    // Call parent constructor
    super(curve, tubularSegments, radius, radialSegments, false);

    // Store reference to curve
    this.curve = curve;
  }

  /**
   * Update geometry based on current curve points
   */
  update() {
    updateTubeGeometry(this);
  }
}

// Reusable vectors to avoid allocations per frame
const _normal = new Vector3();
const _vertex = new Vector3();

// Pre-computed sin/cos tables (cached per radialSegments count)
const _sinCosCache = new Map();

function getSinCosTable(radialSegments) {
  if (_sinCosCache.has(radialSegments)) {
    return _sinCosCache.get(radialSegments);
  }
  const table = { sin: [], cos: [] };
  for (let j = 0; j <= radialSegments; j++) {
    const angle = (j / radialSegments) * Math.PI * 2;
    table.sin[j] = Math.sin(angle);
    table.cos[j] = -Math.cos(angle);
  }
  _sinCosCache.set(radialSegments, table);
  return table;
}

// Pre-computed sin table for tapered radius
const _radiusSinCache = new Map();

function getRadiusSinTable(tubularSegments) {
  if (_radiusSinCache.has(tubularSegments)) {
    return _radiusSinCache.get(tubularSegments);
  }
  const table = [];
  for (let i = 0; i <= tubularSegments; i++) {
    table[i] = Math.sin((i / tubularSegments) * Math.PI);
  }
  _radiusSinCache.set(tubularSegments, table);
  return table;
}

/**
 * Update tube geometry vertices based on curve
 * @param {DynamicTubeGeometry} geometry
 */
function updateTubeGeometry(geometry) {
  const { curve } = geometry;
  const { tubularSegments, radius, radialSegments } = geometry.parameters;

  // Compute Frenet frames for the curve
  const frames = curve.computeFrenetFrames(curve.points.length, false);

  // Get attribute arrays
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const positions = positionAttr.array;
  const normals = normalAttr.array;

  // Get cached tables
  const sinCos = getSinCosTable(radialSegments);
  const radiusSin = getRadiusSinTable(tubularSegments);

  // Use module-level reusable vectors
  const normal = _normal;
  const points = curve.points;
  const frameNormals = frames.normals;
  const frameBinormals = frames.binormals;

  const stride = (radialSegments + 1) * 3;

  // Update each segment
  for (let i = 0; i <= tubularSegments; i++) {
    // Tapered radius
    const currentRadius = radiusSin[i] * radius;

    // Get point on curve
    const point = points[i];
    const px = point.x;
    const py = point.y;
    const pz = point.z;

    // Get frame vectors
    const N = frameNormals[i];
    const B = frameBinormals[i];
    const Nx = N.x, Ny = N.y, Nz = N.z;
    const Bx = B.x, By = B.y, Bz = B.z;

    // Starting index in attribute array
    let idx = i * stride;

    // Generate vertices around the circumference
    for (let j = 0; j <= radialSegments; j++) {
      const sinAngle = sinCos.sin[j];
      const cosAngle = sinCos.cos[j];

      // Calculate normal
      const nx = cosAngle * Nx + sinAngle * Bx;
      const ny = cosAngle * Ny + sinAngle * By;
      const nz = cosAngle * Nz + sinAngle * Bz;

      // Normalize
      const len = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const nnx = nx * len;
      const nny = ny * len;
      const nnz = nz * len;

      // Set position directly in array
      positions[idx] = px + currentRadius * nnx;
      positions[idx + 1] = py + currentRadius * nny;
      positions[idx + 2] = pz + currentRadius * nnz;

      // Set normal directly in array
      normals[idx] = nnx;
      normals[idx + 1] = nny;
      normals[idx + 2] = nnz;

      idx += 3;
    }
  }

  // Flag for update
  positionAttr.needsUpdate = true;
  normalAttr.needsUpdate = true;
}

export default DynamicTubeGeometry;

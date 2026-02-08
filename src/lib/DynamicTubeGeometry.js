/**
 * DynamicTubeGeometry
 * A tube geometry optimized for real-time updates
 *
 * Key optimization: Direct parallel transport frame computation
 * instead of Three.js's computeFrenetFrames which requires
 * expensive arc-length parameterization every frame.
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

    // Pre-allocate frame arrays (avoids GC every frame)
    const segCount = tubularSegments + 1;
    this._tangents = new Array(segCount);
    this._normals = new Array(segCount);
    this._binormals = new Array(segCount);
    for (let i = 0; i < segCount; i++) {
      this._tangents[i] = new Vector3();
      this._normals[i] = new Vector3();
      this._binormals[i] = new Vector3();
    }
  }

  /**
   * Update geometry based on current curve points
   */
  update() {
    computeParallelTransportFrames(
      this.curve.points,
      this._tangents,
      this._normals,
      this._binormals
    );
    updateTubeVertices(this);
  }
}

// Reusable vector for rotation axis computation
const _axis = new Vector3();

/**
 * Compute tangent/normal/binormal frames using parallel transport.
 *
 * Much faster than Three.js computeFrenetFrames because:
 * - No arc-length parameterization (no binary search, no curve evaluation)
 * - No array allocation per frame (pre-allocated)
 * - No trig calls in the transport loop (Rodrigues' formula with direct cos/sin)
 */
function computeParallelTransportFrames(points, tangents, normals, binormals) {
  const len = points.length;

  // Tangents via finite differences
  tangents[0].subVectors(points[1], points[0]).normalize();
  for (let i = 1; i < len - 1; i++) {
    tangents[i].subVectors(points[i + 1], points[i - 1]).normalize();
  }
  tangents[len - 1].subVectors(points[len - 1], points[len - 2]).normalize();

  // Initial normal: cross product of tangent with least-aligned axis
  const t0 = tangents[0];
  const ax = Math.abs(t0.x), ay = Math.abs(t0.y), az = Math.abs(t0.z);
  if (ax <= ay && ax <= az) {
    _axis.set(1, 0, 0);
  } else if (ay <= az) {
    _axis.set(0, 1, 0);
  } else {
    _axis.set(0, 0, 1);
  }
  normals[0].crossVectors(t0, _axis).normalize();
  binormals[0].crossVectors(t0, normals[0]);

  // Parallel transport using Rodrigues' rotation formula
  // For unit tangents: cos(angle) = dot(t_prev, t_curr), sin(angle) = |cross(t_prev, t_curr)|
  // This avoids all trig function calls in the loop
  for (let i = 1; i < len; i++) {
    // Start with previous normal
    normals[i].copy(normals[i - 1]);

    // Rotation axis = cross(t_prev, t_curr)
    _axis.crossVectors(tangents[i - 1], tangents[i]);
    const sinA = _axis.length();

    if (sinA > 1e-6) {
      // Normalize axis
      const invSin = 1 / sinA;
      const kx = _axis.x * invSin;
      const ky = _axis.y * invSin;
      const kz = _axis.z * invSin;

      // cos(angle) = dot product of unit tangents
      const cosA = tangents[i - 1].dot(tangents[i]);
      const oneMinusCos = 1 - cosA;

      // Rodrigues' formula: v' = v*cos + (k x v)*sin + k*(k . v)*(1-cos)
      const n = normals[i];
      const nx = n.x, ny = n.y, nz = n.z;

      // k x n
      const cx = ky * nz - kz * ny;
      const cy = kz * nx - kx * nz;
      const cz = kx * ny - ky * nx;

      // k . n
      const d = kx * nx + ky * ny + kz * nz;

      n.x = nx * cosA + cx * sinA + kx * d * oneMinusCos;
      n.y = ny * cosA + cy * sinA + ky * d * oneMinusCos;
      n.z = nz * cosA + cz * sinA + kz * d * oneMinusCos;
    }

    // Binormal = tangent x normal
    binormals[i].crossVectors(tangents[i], normals[i]);
  }
}

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
 * Update tube vertices using pre-computed parallel transport frames
 */
function updateTubeVertices(geometry) {
  const { tubularSegments, radius, radialSegments } = geometry.parameters;

  // Get attribute arrays
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const positions = positionAttr.array;
  const normals = normalAttr.array;

  // Get cached tables
  const sinCos = getSinCosTable(radialSegments);
  const radiusSin = getRadiusSinTable(tubularSegments);

  const points = geometry.curve.points;
  const frameNormals = geometry._normals;
  const frameBinormals = geometry._binormals;

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

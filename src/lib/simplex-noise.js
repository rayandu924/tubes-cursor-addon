/**
 * Simplex Noise 4D
 * Used for organic tube movement animation
 *
 * OPTIMIZED: Pre-allocated arrays to avoid GC pressure
 */

// Simplex noise constants
const F3 = 1 / 3;       // Skewing factor for 3D
const G3 = 1 / 6;       // Unskewing factor for 3D
const SCALE = 39.5;     // Output scale factor

// Gradient rotation constants (derived from simplex noise algorithm)
const THETA_SCALE = 3.883222077;    // 2*PI * golden ratio for even distribution
const SZ_SCALE = -0.006920415;      // Z-component scaling
const SZ_OFFSET = 0.996539792;      // Z-component offset (near 1.0)
const PSI_SCALE = 0.108705628;      // Rotation angle scaling

// Pre-allocated working arrays (reused every call)
const _skewed = new Float32Array(3);
const _i = new Float32Array(3);
const _f = new Float32Array(3);
const _gt = new Float32Array(3);
const _lt = new Float32Array(3);
const _i1 = new Float32Array(3);
const _i2 = new Float32Array(3);
const _minI1I2 = new Float32Array(3);
const _maxI1I2 = new Float32Array(3);
const _p1 = new Float32Array(3);
const _p2 = new Float32Array(3);
const _p3 = new Float32Array(3);
const _x0 = new Float32Array(3);
const _x1 = new Float32Array(3);
const _x2 = new Float32Array(3);
const _x3 = new Float32Array(3);
const _d0 = new Float32Array(3);
const _d1 = new Float32Array(3);
const _d2 = new Float32Array(3);
const _d3 = new Float32Array(3);
const _hash = new Float32Array(4);
const _g0 = new Float32Array(3);
const _g1 = new Float32Array(3);
const _g2 = new Float32Array(3);
const _g3 = new Float32Array(3);
const _permTemp = new Float32Array(4);
const _permTemp2 = new Float32Array(4);

// Reusable arrays for noise calculation (exported)
const noiseInput = new Float32Array(3);
const noiseOutput = new Float32Array(3);

/**
 * Dot product of two vec3
 */
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Dot product of two vec4
 */
function dot4(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/**
 * Permutation function (unrolled for performance)
 */
function permute4(out, x) {
  let t = ((x[0] % 289) + 289) % 289;
  out[0] = (((34 * t + 10) * t) % 289 + 289) % 289;
  t = ((x[1] % 289) + 289) % 289;
  out[1] = (((34 * t + 10) * t) % 289 + 289) % 289;
  t = ((x[2] % 289) + 289) % 289;
  out[2] = (((34 * t + 10) * t) % 289 + 289) % 289;
  t = ((x[3] % 289) + 289) % 289;
  out[3] = (((34 * t + 10) * t) % 289 + 289) % 289;
  return out;
}

/**
 * 4D Simplex Noise with curl derivative
 * @param {Float32Array} position - Input position [x, y, z]
 * @param {number} time - Time offset for animation
 * @param {Float32Array} result - Output result vector
 * @returns {number} Noise value
 */
function simplex4D(position, time, result) {
  // Skew input
  const sum = (position[0] + position[1] + position[2]) * F3;
  _skewed[0] = position[0] + sum;
  _skewed[1] = position[1] + sum;
  _skewed[2] = position[2] + sum;

  // Integer part
  _i[0] = Math.floor(_skewed[0]);
  _i[1] = Math.floor(_skewed[1]);
  _i[2] = Math.floor(_skewed[2]);

  // Fractional part
  _f[0] = _skewed[0] - _i[0];
  _f[1] = _skewed[1] - _i[1];
  _f[2] = _skewed[2] - _i[2];

  // Simplex corner offsets
  _gt[0] = _f[0] >= _f[1] ? 1 : 0;
  _gt[1] = _f[1] >= _f[2] ? 1 : 0;
  _gt[2] = _f[0] >= _f[2] ? 1 : 0;
  _lt[0] = 1 - _gt[0];
  _lt[1] = 1 - _gt[1];
  _lt[2] = 1 - _gt[2];
  _i1[0] = _lt[2];
  _i1[1] = _gt[0];
  _i1[2] = _gt[1];
  _i2[0] = _lt[0];
  _i2[1] = _lt[1];
  _i2[2] = _gt[2];

  // Min/max
  _minI1I2[0] = Math.min(_i1[0], _i2[0]);
  _minI1I2[1] = Math.min(_i1[1], _i2[1]);
  _minI1I2[2] = Math.min(_i1[2], _i2[2]);
  _maxI1I2[0] = Math.max(_i1[0], _i2[0]);
  _maxI1I2[1] = Math.max(_i1[1], _i2[1]);
  _maxI1I2[2] = Math.max(_i1[2], _i2[2]);

  // Simplex vertices
  _p1[0] = _i[0] + _minI1I2[0];
  _p1[1] = _i[1] + _minI1I2[1];
  _p1[2] = _i[2] + _minI1I2[2];
  _p2[0] = _i[0] + _maxI1I2[0];
  _p2[1] = _i[1] + _maxI1I2[1];
  _p2[2] = _i[2] + _maxI1I2[2];
  _p3[0] = _i[0] + 1;
  _p3[1] = _i[1] + 1;
  _p3[2] = _i[2] + 1;

  // Unskew vertices
  const unskew0 = (_i[0] + _i[1] + _i[2]) * G3;
  const unskew1 = (_p1[0] + _p1[1] + _p1[2]) * G3;
  const unskew2 = (_p2[0] + _p2[1] + _p2[2]) * G3;
  const unskew3 = (_p3[0] + _p3[1] + _p3[2]) * G3;

  _x0[0] = _i[0] - unskew0;
  _x0[1] = _i[1] - unskew0;
  _x0[2] = _i[2] - unskew0;
  _x1[0] = _p1[0] - unskew1;
  _x1[1] = _p1[1] - unskew1;
  _x1[2] = _p1[2] - unskew1;
  _x2[0] = _p2[0] - unskew2;
  _x2[1] = _p2[1] - unskew2;
  _x2[2] = _p2[2] - unskew2;
  _x3[0] = _p3[0] - unskew3;
  _x3[1] = _p3[1] - unskew3;
  _x3[2] = _p3[2] - unskew3;

  // Distance vectors
  _d0[0] = position[0] - _x0[0];
  _d0[1] = position[1] - _x0[1];
  _d0[2] = position[2] - _x0[2];
  _d1[0] = position[0] - _x1[0];
  _d1[1] = position[1] - _x1[1];
  _d1[2] = position[2] - _x1[2];
  _d2[0] = position[0] - _x2[0];
  _d2[1] = position[1] - _x2[1];
  _d2[2] = position[2] - _x2[2];
  _d3[0] = position[0] - _x3[0];
  _d3[1] = position[1] - _x3[1];
  _d3[2] = position[2] - _x3[2];

  // Hash
  _permTemp[0] = _i[2];
  _permTemp[1] = _p1[2];
  _permTemp[2] = _p2[2];
  _permTemp[3] = _p3[2];
  permute4(_hash, _permTemp);

  _permTemp[0] = _hash[0] + _i[1];
  _permTemp[1] = _hash[1] + _p1[1];
  _permTemp[2] = _hash[2] + _p2[1];
  _permTemp[3] = _hash[3] + _p3[1];
  permute4(_permTemp2, _permTemp);

  _permTemp[0] = _permTemp2[0] + _i[0];
  _permTemp[1] = _permTemp2[1] + _p1[0];
  _permTemp[2] = _permTemp2[2] + _p2[0];
  _permTemp[3] = _permTemp2[3] + _p3[0];
  permute4(_hash, _permTemp);

  // Gradient calculation (unrolled for performance)
  const h0 = _hash[0], h1 = _hash[1], h2 = _hash[2], h3 = _hash[3];

  const theta0 = THETA_SCALE * h0;
  const theta1 = THETA_SCALE * h1;
  const theta2 = THETA_SCALE * h2;
  const theta3 = THETA_SCALE * h3;

  const sz0 = SZ_SCALE * h0 + SZ_OFFSET;
  const sz1 = SZ_SCALE * h1 + SZ_OFFSET;
  const sz2 = SZ_SCALE * h2 + SZ_OFFSET;
  const sz3 = SZ_SCALE * h3 + SZ_OFFSET;

  const psi0 = PSI_SCALE * h0 + time;
  const psi1 = PSI_SCALE * h1 + time;
  const psi2 = PSI_SCALE * h2 + time;
  const psi3 = PSI_SCALE * h3 + time;

  const cosT0 = Math.cos(theta0), sinT0 = Math.sin(theta0);
  const cosT1 = Math.cos(theta1), sinT1 = Math.sin(theta1);
  const cosT2 = Math.cos(theta2), sinT2 = Math.sin(theta2);
  const cosT3 = Math.cos(theta3), sinT3 = Math.sin(theta3);

  const cosP0 = Math.cos(psi0), sinP0 = Math.sin(psi0);
  const cosP1 = Math.cos(psi1), sinP1 = Math.sin(psi1);
  const cosP2 = Math.cos(psi2), sinP2 = Math.sin(psi2);
  const cosP3 = Math.cos(psi3), sinP3 = Math.sin(psi3);

  const sqrt0 = Math.sqrt(1 - sz0 * sz0);
  const sqrt1 = Math.sqrt(1 - sz1 * sz1);
  const sqrt2 = Math.sqrt(1 - sz2 * sz2);
  const sqrt3 = Math.sqrt(1 - sz3 * sz3);

  _g0[0] = cosP0 * (-sz0 * cosT0) + sinP0 * sinT0;
  _g0[1] = cosP0 * (-sz0 * sinT0) + sinP0 * (-cosT0);
  _g0[2] = cosP0 * sqrt0;

  _g1[0] = cosP1 * (-sz1 * cosT1) + sinP1 * sinT1;
  _g1[1] = cosP1 * (-sz1 * sinT1) + sinP1 * (-cosT1);
  _g1[2] = cosP1 * sqrt1;

  _g2[0] = cosP2 * (-sz2 * cosT2) + sinP2 * sinT2;
  _g2[1] = cosP2 * (-sz2 * sinT2) + sinP2 * (-cosT2);
  _g2[2] = cosP2 * sqrt2;

  _g3[0] = cosP3 * (-sz3 * cosT3) + sinP3 * sinT3;
  _g3[1] = cosP3 * (-sz3 * sinT3) + sinP3 * (-cosT3);
  _g3[2] = cosP3 * sqrt3;

  // Contribution weights (inline dot products)
  const w0 = Math.max(0, 0.5 - (_d0[0]*_d0[0] + _d0[1]*_d0[1] + _d0[2]*_d0[2]));
  const w1 = Math.max(0, 0.5 - (_d1[0]*_d1[0] + _d1[1]*_d1[1] + _d1[2]*_d1[2]));
  const w2 = Math.max(0, 0.5 - (_d2[0]*_d2[0] + _d2[1]*_d2[1] + _d2[2]*_d2[2]));
  const w3 = Math.max(0, 0.5 - (_d3[0]*_d3[0] + _d3[1]*_d3[1] + _d3[2]*_d3[2]));

  const w0_2 = w0 * w0, w0_3 = w0_2 * w0;
  const w1_2 = w1 * w1, w1_3 = w1_2 * w1;
  const w2_2 = w2 * w2, w2_3 = w2_2 * w2;
  const w3_2 = w3 * w3, w3_3 = w3_2 * w3;

  // Gradient dot products (inline)
  const gdot0 = _g0[0]*_d0[0] + _g0[1]*_d0[1] + _g0[2]*_d0[2];
  const gdot1 = _g1[0]*_d1[0] + _g1[1]*_d1[1] + _g1[2]*_d1[2];
  const gdot2 = _g2[0]*_d2[0] + _g2[1]*_d2[1] + _g2[2]*_d2[2];
  const gdot3 = _g3[0]*_d3[0] + _g3[1]*_d3[1] + _g3[2]*_d3[2];

  const n = w0_3 * gdot0 + w1_3 * gdot1 + w2_3 * gdot2 + w3_3 * gdot3;

  // Derivative weights
  const dw0 = -6 * w0_2 * gdot0;
  const dw1 = -6 * w1_2 * gdot1;
  const dw2 = -6 * w2_2 * gdot2;
  const dw3 = -6 * w3_2 * gdot3;

  // Final derivative calculation
  result[0] = SCALE * (
    w0_3 * _g0[0] + dw0 * _d0[0] +
    w1_3 * _g1[0] + dw1 * _d1[0] +
    w2_3 * _g2[0] + dw2 * _d2[0] +
    w3_3 * _g3[0] + dw3 * _d3[0]
  );
  result[1] = SCALE * (
    w0_3 * _g0[1] + dw0 * _d0[1] +
    w1_3 * _g1[1] + dw1 * _d1[1] +
    w2_3 * _g2[1] + dw2 * _d2[1] +
    w3_3 * _g3[1] + dw3 * _d3[1]
  );
  result[2] = SCALE * (
    w0_3 * _g0[2] + dw0 * _d0[2] +
    w1_3 * _g1[2] + dw1 * _d1[2] +
    w2_3 * _g2[2] + dw2 * _d2[2] +
    w3_3 * _g3[2] + dw3 * _d3[2]
  );

  return SCALE * n;
}

export { simplex4D, noiseInput, noiseOutput };

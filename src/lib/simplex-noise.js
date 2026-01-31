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
const _theta = new Float32Array(4);
const _sz = new Float32Array(4);
const _psi = new Float32Array(4);
const _gx = new Float32Array(4);
const _gy = new Float32Array(4);
const _gz = new Float32Array(4);
const _w = new Float32Array(4);
const _w2 = new Float32Array(4);
const _w3 = new Float32Array(4);
const _gdot = new Float32Array(4);
const _dw = new Float32Array(4);
const _g0 = new Float32Array(3);
const _g1 = new Float32Array(3);
const _g2 = new Float32Array(3);
const _g3 = new Float32Array(3);
const _dn0 = new Float32Array(3);
const _dn1 = new Float32Array(3);
const _dn2 = new Float32Array(3);
const _dn3 = new Float32Array(3);
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
 * Permutation function
 */
function permute4(out, x) {
  for (let i = 0; i < 4; i++) {
    const t = ((x[i] % 289) + 289) % 289;
    out[i] = (((34 * t + 10) * t) % 289 + 289) % 289;
  }
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

  // Gradient calculation using hash to generate pseudo-random directions
  for (let j = 0; j < 4; j++) {
    _theta[j] = THETA_SCALE * _hash[j];
    _sz[j] = SZ_SCALE * _hash[j] + SZ_OFFSET;
    _psi[j] = PSI_SCALE * _hash[j] + time;
  }

  for (let j = 0; j < 4; j++) {
    const cosTheta = Math.cos(_theta[j]);
    const sinTheta = Math.sin(_theta[j]);
    const cosPsi = Math.cos(_psi[j]);
    const sinPsi = Math.sin(_psi[j]);
    const sqrtVal = Math.sqrt(1 - _sz[j] * _sz[j]);

    _gx[j] = cosPsi * (_sz[j] * (-cosTheta)) + sinPsi * sinTheta;
    _gy[j] = cosPsi * (-_sz[j] * sinTheta) + sinPsi * (-cosTheta);
    _gz[j] = cosPsi * sqrtVal;
  }

  _g0[0] = _gx[0]; _g0[1] = _gy[0]; _g0[2] = _gz[0];
  _g1[0] = _gx[1]; _g1[1] = _gy[1]; _g1[2] = _gz[1];
  _g2[0] = _gx[2]; _g2[1] = _gy[2]; _g2[2] = _gz[2];
  _g3[0] = _gx[3]; _g3[1] = _gy[3]; _g3[2] = _gz[3];

  // Contribution weights
  _w[0] = Math.max(0, 0.5 - dot3(_d0, _d0));
  _w[1] = Math.max(0, 0.5 - dot3(_d1, _d1));
  _w[2] = Math.max(0, 0.5 - dot3(_d2, _d2));
  _w[3] = Math.max(0, 0.5 - dot3(_d3, _d3));

  for (let j = 0; j < 4; j++) {
    _w2[j] = _w[j] * _w[j];
    _w3[j] = _w2[j] * _w[j];
  }

  _gdot[0] = dot3(_g0, _d0);
  _gdot[1] = dot3(_g1, _d1);
  _gdot[2] = dot3(_g2, _d2);
  _gdot[3] = dot3(_g3, _d3);

  const n = dot4(_w3, _gdot);

  // Derivative
  for (let j = 0; j < 4; j++) {
    _dw[j] = -6 * _w2[j] * _gdot[j];
  }

  _dn0[0] = _w3[0] * _g0[0] + _dw[0] * _d0[0];
  _dn0[1] = _w3[0] * _g0[1] + _dw[0] * _d0[1];
  _dn0[2] = _w3[0] * _g0[2] + _dw[0] * _d0[2];
  _dn1[0] = _w3[1] * _g1[0] + _dw[1] * _d1[0];
  _dn1[1] = _w3[1] * _g1[1] + _dw[1] * _d1[1];
  _dn1[2] = _w3[1] * _g1[2] + _dw[1] * _d1[2];
  _dn2[0] = _w3[2] * _g2[0] + _dw[2] * _d2[0];
  _dn2[1] = _w3[2] * _g2[1] + _dw[2] * _d2[1];
  _dn2[2] = _w3[2] * _g2[2] + _dw[2] * _d2[2];
  _dn3[0] = _w3[3] * _g3[0] + _dw[3] * _d3[0];
  _dn3[1] = _w3[3] * _g3[1] + _dw[3] * _d3[1];
  _dn3[2] = _w3[3] * _g3[2] + _dw[3] * _d3[2];

  result[0] = SCALE * (_dn0[0] + _dn1[0] + _dn2[0] + _dn3[0]);
  result[1] = SCALE * (_dn0[1] + _dn1[1] + _dn2[1] + _dn3[1]);
  result[2] = SCALE * (_dn0[2] + _dn1[2] + _dn2[2] + _dn3[2]);

  return SCALE * n;
}

export { simplex4D, noiseInput, noiseOutput };

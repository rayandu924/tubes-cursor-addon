/**
 * Tube
 * Individual tube mesh that follows mouse with organic movement
 */

import { Mesh, Vector3 } from 'three';
import { DynamicTubeGeometry } from './DynamicTubeGeometry.js';
import { simplex4D, noiseInput, noiseOutput } from './simplex-noise.js';

export class Tube extends Mesh {
  // Random time offset for unique movement per tube
  timeDelta = 100 * Math.random();

  /**
   * @param {Object} options
   * @param {number} options.tubularSegments - Number of segments along tube
   * @param {number} options.radius - Maximum radius of tube
   * @param {number} options.radialSegments - Number of segments around circumference
   * @param {Material} material - Three.js material
   */
  constructor(options, material) {
    const tubularSegments = options.tubularSegments || 64;
    const radius = options.radius || 0.5;
    const radialSegments = options.radialSegments || 8;

    // Create dynamic geometry
    const geometry = new DynamicTubeGeometry(tubularSegments, radius, radialSegments);

    super(geometry, material);

    // Store references for easy access
    this.curve = this.geometry.curve;
    this.points = this.curve.points;

    // Target position for interpolation
    this.targetPosition = new Vector3();

    // Initial geometry update
    this.geometry.update();
  }

  /**
   * Smoothly move tube head towards target position with noise
   * @param {Vector3} target - Target position to move towards
   * @param {number} lerpFactor - Interpolation factor (0-1), higher = faster
   * @param {number} noiseAmount - Amount of noise displacement
   * @param {number} elapsed - Time elapsed for animation
   */
  lerpTo(target, lerpFactor, noiseAmount, elapsed) {
    const td = this.timeDelta;
    const tx = target.x;
    const ty = target.y;
    const tz = target.z;

    // Calculate noise input
    noiseInput[0] = 0.01 * tx + 0.040 * elapsed + td;
    noiseInput[1] = 0.01 * ty + 0.048 * elapsed + td;
    noiseInput[2] = 0.01 * tz + 0.060 * elapsed + td;

    // Get noise displacement
    simplex4D(noiseInput, elapsed * 2, noiseOutput);

    // Target with noise (inline, no copy)
    const targetX = tx + noiseOutput[0] * noiseAmount;
    const targetY = ty + noiseOutput[1] * noiseAmount;
    const targetZ = tz + noiseOutput[2] * noiseAmount;

    // Lerp first point (head) - inline for speed
    const points = this.points;
    const p0 = points[0];
    const invLerp = 1 - lerpFactor;
    p0.x = p0.x * invLerp + targetX * lerpFactor;
    p0.y = p0.y * invLerp + targetY * lerpFactor;
    p0.z = p0.z * invLerp + targetZ * lerpFactor;

    // Chain lerp - each point follows previous
    const len = points.length;
    for (let i = 1; i < len; i++) {
      const curr = points[i];
      const prev = points[i - 1];
      curr.x = curr.x * invLerp + prev.x * lerpFactor;
      curr.y = curr.y * invLerp + prev.y * lerpFactor;
      curr.z = curr.z * invLerp + prev.z * lerpFactor;
    }

    // Update geometry
    this.geometry.update();
  }
}

export default Tube;

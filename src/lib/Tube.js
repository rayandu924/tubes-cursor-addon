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
  lerpTo(target, lerpFactor = 0.1, noiseAmount = 0.05, elapsed) {
    // Calculate noise input based on position and time
    // Different multipliers per axis create varied, non-uniform movement
    // Position scale (0.01): controls spatial frequency of noise
    // Time scales (0.04-0.06): controls animation speed per axis
    noiseInput[0] = 0.01 * target.x + 0.040 * elapsed + this.timeDelta;
    noiseInput[1] = 0.01 * target.y + 0.048 * elapsed + this.timeDelta;
    noiseInput[2] = 0.01 * target.z + 0.060 * elapsed + this.timeDelta;

    // Get noise displacement
    simplex4D(noiseInput, 2 * elapsed, noiseOutput);

    // Copy target and add noise
    this.targetPosition.copy(target);
    this.targetPosition.x += noiseOutput[0] * noiseAmount;
    this.targetPosition.y += noiseOutput[1] * noiseAmount;
    this.targetPosition.z += noiseOutput[2] * noiseAmount;

    // Lerp first point (head) towards target
    this.points[0].lerp(this.targetPosition, lerpFactor);

    // Each subsequent point follows the one before it (creates trailing effect)
    for (let i = 1; i < this.points.length; i++) {
      this.points[i].lerp(this.points[i - 1], lerpFactor);
    }

    // Update geometry to reflect new positions
    this.geometry.update();
  }
}

export default Tube;

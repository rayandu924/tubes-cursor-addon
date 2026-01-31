/**
 * TubesManager
 * Manages a group of tubes and their lighting
 */

import {
  Group,
  PointLight,
  MeshStandardMaterial,
  MathUtils,
  Vector3,
} from 'three';

import { Tube } from './Tube.js';
import { createColorGradient } from './color-gradient.js';

/**
 * Default configuration options
 * Note: Colors are set to null and randomized at runtime to avoid
 * non-deterministic behavior at module load time
 */
export const DEFAULT_OPTIONS = {
  // Number of tubes
  count: 16,

  // Tube colors (null = random at init)
  colors: null,

  // Radius range
  minRadius: 0.005,
  maxRadius: 0.05,

  // Segment range (longer tubes have more segments)
  minTubularSegments: 32,
  maxTubularSegments: 128,

  // Material properties
  material: {
    metalness: 1,
    roughness: 0.25,
  },

  // Lighting
  lights: {
    intensity: 200,
    colors: null, // null = random at init
  },

  // Animation parameters
  lerp: 0.5,      // Movement smoothness (higher = snappier)
  noise: 0.05,    // Noise amplitude for organic movement
};

/**
 * Generate random colors
 */
function randomColor() {
  return Math.floor(0xffffff * Math.random());
}

export class TubesManager extends Group {
  // Target position that all tubes follow
  target = new Vector3();

  // Array of point lights
  lights = [];

  // Array of tube meshes
  tubes = [];

  /**
   * @param {Object} options - Configuration options (merged with DEFAULT_OPTIONS)
   */
  constructor(options = {}) {
    super();

    // Deep merge options with defaults
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      material: { ...DEFAULT_OPTIONS.material, ...options.material },
      lights: { ...DEFAULT_OPTIONS.lights, ...options.lights },
    };

    // Initialize random colors if not provided
    if (!this.options.colors) {
      this.options.colors = [randomColor(), randomColor(), randomColor()];
    }
    if (!this.options.lights.colors) {
      this.options.lights.colors = [randomColor(), randomColor(), randomColor(), randomColor()];
    }

    // Initialize lights and tubes
    this.init();
  }

  init() {
    this.initLights();
    this.initTubes();
  }

  /**
   * Create 4 point lights in corners
   */
  initLights() {
    for (let i = 0; i < 4; i++) {
      const light = new PointLight(
        this.options.lights.colors[i],
        this.options.lights.intensity
      );

      // Position lights in corners
      light.position.set(
        i < 2 ? -5 : 5,      // X: left for 0,1 | right for 2,3
        i % 2 === 0 ? -5 : 5, // Y: bottom for even | top for odd
        5                     // Z: in front
      );

      this.lights.push(light);
      this.add(light);
    }
  }

  /**
   * Create all tubes with random sizes
   */
  initTubes() {
    for (let i = 0; i < this.options.count; i++) {
      // Random radius within range
      const radius = MathUtils.randFloat(
        this.options.minRadius,
        this.options.maxRadius
      );

      // Random segment count within range
      const tubularSegments = MathUtils.randInt(
        this.options.minTubularSegments,
        this.options.maxTubularSegments
      );

      // Create material
      const material = new MeshStandardMaterial(this.options.material);

      // Create tube
      this.tubes[i] = new Tube({ radius, tubularSegments }, material);

      // Add to group
      this.add(this.tubes[i]);
    }

    // Apply colors
    this.setColors(this.options.colors);
  }

  /**
   * Set tube colors with gradient interpolation
   * @param {Array<string|number>} colors
   */
  setColors(colors) {
    const gradient = createColorGradient(colors);
    const divisor = Math.max(1, this.tubes.length - 1); // Avoid division by zero

    this.tubes.forEach((tube, index) => {
      // Get color at position based on tube index
      const t = index / divisor;
      tube.material.color.set(gradient.getColorAt(t));
    });
  }

  /**
   * Set colors for all 4 lights
   * @param {Array<string|number>} colors - Array of 4 colors
   */
  setLightsColors(colors) {
    for (let i = 0; i < 4; i++) {
      this.lights[i].color.set(colors[i]);
    }
  }

  /**
   * Set intensity for all lights
   * @param {number} intensity
   */
  setLightsIntensity(intensity) {
    this.lights.forEach((light) => {
      light.intensity = intensity;
    });
  }

  /**
   * Update all tubes animation
   * @param {Object} state - Animation state with elapsed time
   */
  update(state) {
    for (let i = 0; i < this.options.count; i++) {
      this.tubes[i].lerpTo(
        this.target,
        this.options.lerp,
        this.options.noise,
        state.elapsed
      );
    }
  }

  /**
   * Dispose all resources
   */
  dispose() {
    // Dispose tubes
    this.tubes.forEach((tube) => {
      tube.geometry.dispose();
      tube.material.dispose();
      this.remove(tube);
    });
    this.tubes = [];

    // Remove lights
    this.lights.forEach((light) => {
      this.remove(light);
    });
    this.lights = [];
  }
}

export default TubesManager;

/**
 * TubesCursor
 * Interactive 3D tubes that follow cursor movement
 *
 * CLEAN VERSION - Human readable code
 */

import { Raycaster, Plane, Vector3 } from 'three';

import { ThreeApp } from './lib/ThreeApp.js';
import { TubesManager } from './lib/TubesManager.js';
import { createPointerHandler } from './lib/pointer-handler.js';
import { createBloom } from './lib/bloom.js';

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Default options for TubesCursor
 */
const DEFAULT_OPTIONS = {
  // Bloom effect (set to null to disable)
  bloom: null,

  // Tubes configuration (passed to TubesManager)
  tubes: {},

  // Passthrough mode - allows clicks to pass through to elements below
  // Useful for cursor addons in iframes that overlay the whole page
  passthrough: true,

  // Sleep mode animation (when cursor is outside)
  sleepRadiusX: 300,   // Horizontal radius of ellipse
  sleepRadiusY: 150,   // Vertical radius of ellipse
  sleepTimeScale1: 1,  // Speed of X oscillation
  sleepTimeScale2: 2,  // Speed of Y oscillation
};

/**
 * Create a TubesCursor instance
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {Object} options - Configuration options
 * @returns {Object} TubesCursor instance
 */
export function TubesCursor(canvas, options = {}) {
  // Deep merge options to preserve nested defaults
  const config = deepMerge(DEFAULT_OPTIONS, options);

  // Create Three.js app
  const app = new ThreeApp({
    canvas,
    size: 'parent',
    rendererOptions: {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    },
  });

  // Setup camera
  app.camera.position.set(0, 0, 5);
  app.camera.lookAt(0, 0, 0);
  app.cameraMaxAspect = 1.5;
  app.minPixelRatio = 1;
  app.maxPixelRatio = 1.5; // Lower = faster resize, bloom hides aliasing
  app.resize();

  // Create tubes manager
  const tubesManager = new TubesManager(config.tubes);

  // Set scene
  app.scene = tubesManager;

  // Setup bloom if enabled
  let bloom = null;
  if (config.bloom) {
    bloom = createBloom(app.renderer, tubesManager, app.camera, config.bloom);

    // Override render method to use bloom
    app.render = function (scene, camera) {
      bloom.render();
    };

    // Store original resize to chain
    const originalResize = app.resize.bind(app);
    app.resize = function () {
      originalResize();
      bloom.resize(app.size.width, app.size.height);
    };

    // Trigger resize to init bloom buffers
    app.resize();
  }

  // Raycaster for mouse intersection
  const raycaster = new Raycaster();

  // Plane at z=0 for intersection
  const intersectionPlane = new Plane(new Vector3(0, 0, 1), 0);

  // Intersection point
  const intersectionPoint = new Vector3();

  // Pointer handler - receives mouse position via postMessage from parent
  const pointer = createPointerHandler({
    domElement: canvas,
    onMove() {
      // Cast ray from camera through mouse position
      raycaster.setFromCamera(pointer.nPosition, app.camera);

      // Update plane normal to face camera
      app.camera.getWorldDirection(intersectionPlane.normal);

      // Find intersection point
      raycaster.ray.intersectPlane(intersectionPlane, intersectionPoint);
    },
  });

  // Animation loop
  app.onBeforeRender = function (state) {
    if (pointer.hover) {
      // Follow cursor
      tubesManager.target.copy(intersectionPoint);
    } else {
      // Sleep mode - animate in ellipse pattern
      const pixelToWorld = app.size.wWidth / app.size.width;
      const radiusX = config.sleepRadiusX * pixelToWorld;
      const radiusY = config.sleepRadiusY * pixelToWorld;

      tubesManager.target.x = radiusX * Math.cos(state.elapsed * config.sleepTimeScale1);
      tubesManager.target.y = radiusY * Math.sin(state.elapsed * config.sleepTimeScale2);
    }

    // Update tubes animation
    tubesManager.update(state);
  };

  // Return public API
  return {
    // Three.js app reference
    three: app,

    // Configuration
    options: config,

    // TubesManager reference
    tubes: tubesManager,

    // Bloom controller (if enabled)
    bloom: bloom,

    // Cleanup
    dispose() {
      pointer.dispose();
      if (bloom) bloom.dispose();
      app.dispose();
    },
  };
}

/**
 * Standard initialization function for the generic cursor system
 *
 * @param {HTMLCanvasElement} canvas - Canvas to render to
 * @param {Object} options - Configuration options from settings
 * @returns {Object} Cursor instance with dispose() and setConfig() methods
 */
export function initializeCursor(canvas, options = {}) {
  // Build cursor configuration from addon settings
  const cursorConfig = {
    passthrough: options.passthrough !== false,
    bloom: options.bloomEnabled ? {
      threshold: options.bloomThreshold || 0,
      strength: options.bloomStrength || 0.3,
      radius: options.bloomRadius || 0.2,
    } : null,
    tubes: {
      count: options.tubeCount || 16,
      minRadius: options.minRadius || 0.005,
      maxRadius: options.maxRadius || 0.05,
      minTubularSegments: options.minTubularSegments || 32,
      maxTubularSegments: options.maxTubularSegments || 128,
      radialSegments: options.radialSegments || 8,
      material: {
        metalness: options.metalness || 1,
        roughness: options.roughness || 0.25,
      },
      lights: {
        intensity: options.lightIntensity || 40,
        colors: [
          options.lightColor1 || '#83f36e',
          options.lightColor2 || '#fe8a2e',
          options.lightColor3 || '#ff008a',
          options.lightColor4 || '#60aed5',
        ],
      },
      colors: [
        options.tubeColor1 || '#f967fb',
        options.tubeColor2 || '#ff6b6b',
        options.tubeColor3 || '#53bc28',
      ],
      lerp: options.smoothness || 0.35,
      noise: options.noise || 0.05,
    },
    sleepRadiusX: options.sleepRadiusX || 300,
    sleepRadiusY: options.sleepRadiusY || 150,
    sleepTimeScale1: options.sleepSpeedX || 1,
    sleepTimeScale2: options.sleepSpeedY || 2,
  };

  // Initialize TubesCursor instance
  const instance = TubesCursor(canvas, cursorConfig);

  // Return standardized cursor interface
  return {
    /**
     * Cleanup and dispose resources
     */
    dispose() {
      if (instance?.dispose) {
        instance.dispose();
      }
    },

    /**
     * Update cursor configuration (hot-reload support)
     */
    setConfig(newOptions) {
      // For future enhancement: allow real-time config updates
      // without recreating the entire instance
      if (typeof console !== 'undefined') {
        console.log('[TubesCursor] Config update requested', newOptions);
      }
    },
  };
}

// Export for global access
window.initializeCursor = initializeCursor;

export default TubesCursor;

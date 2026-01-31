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
  bloom: {
    threshold: 0,
    strength: 1.5,
    radius: 0.5,
  },

  // Tubes configuration (passed to TubesManager)
  tubes: {},

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
  app.minPixelRatio = 2;
  app.maxPixelRatio = 2;
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

  // Pointer handler
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

export default TubesCursor;

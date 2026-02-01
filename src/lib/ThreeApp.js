/**
 * ThreeApp
 * Simple Three.js application wrapper with automatic resize
 */

import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Clock,
} from 'three';

export class ThreeApp {
  constructor(options = {}) {
    const {
      canvas,
      size = 'parent',
      rendererOptions = {},
    } = options;

    this.canvas = canvas;
    this.sizeMode = size;

    // Create renderer
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      ...rendererOptions,
    });

    // Set clear color with transparent alpha
    this.renderer.setClearColor(0x000000, 0);

    // Create camera
    this.camera = new PerspectiveCamera(75, 1, 0.1, 1000);

    // Scene reference (set externally, no default to avoid waste)
    this._scene = null;

    // Size info
    this.size = {
      width: 0,
      height: 0,
      wWidth: 0,
      wHeight: 0,
    };

    // Camera constraints
    this.cameraMaxAspect = 1.5;
    this.minPixelRatio = 2;
    this.maxPixelRatio = 2;

    // Clock for animation
    this.clock = new Clock();

    // Animation state
    this.animationState = {
      elapsed: 0,
      delta: 0,
    };

    // Callbacks
    this.onBeforeRender = null;

    // Animation frame ID for cleanup
    this._animationFrameId = null;
    this._isDisposed = false;

    // Debounced resize handler for performance
    this._resizeTimeout = null;
    this._boundResize = () => {
      if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
      this._resizeTimeout = setTimeout(() => this.resize(), 100);
    };

    // Setup
    this.setupResize();
    this.resize();
    this.animate();
  }

  get scene() {
    return this._scene;
  }

  set scene(value) {
    this._scene = value;
  }

  setupResize() {
    window.addEventListener('resize', this._boundResize);
  }

  resize() {
    let width, height;

    if (this.sizeMode === 'parent') {
      const parent = this.canvas.parentElement || document.body;
      width = parent.clientWidth;
      height = parent.clientHeight;
    } else {
      width = window.innerWidth;
      height = window.innerHeight;
    }

    // Update size info
    this.size.width = width;
    this.size.height = height;

    // Calculate world units visible at z=0
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = Math.abs(this.camera.position.z);
    this.size.wHeight = 2 * Math.tan(fov / 2) * distance;
    this.size.wWidth = this.size.wHeight * (width / height);

    // Update camera
    let aspect = width / height;
    if (this.cameraMaxAspect && aspect > this.cameraMaxAspect) {
      aspect = this.cameraMaxAspect;
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Update renderer
    const pixelRatio = Math.min(
      Math.max(window.devicePixelRatio, this.minPixelRatio),
      this.maxPixelRatio
    );
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
  }

  animate() {
    if (this._isDisposed) return;

    this._animationFrameId = requestAnimationFrame(() => this.animate());

    // Update animation state
    this.animationState.delta = this.clock.getDelta();
    this.animationState.elapsed = this.clock.getElapsedTime();

    // Call before render hook
    if (this.onBeforeRender) {
      this.onBeforeRender(this.animationState);
    }

    // Render
    this.render(this._scene, this.camera);
  }

  render(scene, camera) {
    if (scene) {
      this.renderer.render(scene, camera);
    }
  }

  dispose() {
    this._isDisposed = true;

    // Cancel animation frame
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    // Clear resize timeout
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
      this._resizeTimeout = null;
    }

    // Remove resize listener
    window.removeEventListener('resize', this._boundResize);

    // Dispose scene if it has dispose method
    if (this._scene && typeof this._scene.dispose === 'function') {
      this._scene.dispose();
    }

    // Dispose renderer
    this.renderer.dispose();
  }
}

export default ThreeApp;

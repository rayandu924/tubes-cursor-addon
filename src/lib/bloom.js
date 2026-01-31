/**
 * Bloom Post-Processing
 * Adds glow effect using Three.js EffectComposer
 */

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Vector2, WebGLRenderTarget, HalfFloatType } from 'three';

/**
 * Create bloom post-processing setup
 * @param {WebGLRenderer} renderer
 * @param {Scene} scene
 * @param {Camera} camera
 * @param {Object} options - Bloom options
 * @returns {Object} Bloom controller with render and resize methods
 */
export function createBloom(renderer, scene, camera, options = {}) {
  const {
    threshold = 0,
    strength = 1.5,
    radius = 0.5,
  } = options;

  // Get renderer size
  const size = renderer.getSize(new Vector2());

  // Create render target with alpha support for transparency
  const renderTarget = new WebGLRenderTarget(size.x, size.y, {
    type: HalfFloatType,
    samples: 4, // MSAA for smoother edges
  });

  // Create composer with alpha-enabled render target
  const composer = new EffectComposer(renderer, renderTarget);

  // Render pass - renders the scene
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0; // Transparent background
  composer.addPass(renderPass);

  // Bloom pass - adds glow
  const bloomPass = new UnrealBloomPass(
    new Vector2(size.x, size.y),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);

  // Output pass - handles color space conversion
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    bloomPass,

    /**
     * Render with bloom
     */
    render() {
      composer.render();
    },

    /**
     * Resize bloom buffers
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
      renderTarget.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
    },

    /**
     * Update bloom parameters
     * @param {Object} params
     */
    setParams(params) {
      if (params.threshold !== undefined) bloomPass.threshold = params.threshold;
      if (params.strength !== undefined) bloomPass.strength = params.strength;
      if (params.radius !== undefined) bloomPass.radius = params.radius;
    },

    /**
     * Dispose resources
     */
    dispose() {
      renderTarget.dispose();
      composer.dispose();
    },
  };
}

export default createBloom;

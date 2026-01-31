/**
 * Bloom Post-Processing
 * Adds glow effect using Three.js EffectComposer
 * Uses depth buffer to keep tubes opaque while glow is transparent
 */

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Vector2, WebGLRenderTarget, HalfFloatType } from 'three';

/**
 * Create bloom post-processing setup
 */
export function createBloom(renderer, scene, camera, options = {}) {
  const {
    threshold = 0,
    strength = 5,
    radius = 1.5,
  } = options;

  const size = renderer.getSize(new Vector2());

  // Create render target
  const renderTarget = new WebGLRenderTarget(size.x, size.y, {
    type: HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, renderTarget);

  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new Vector2(size.x, size.y),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);

  // Output pass for color space conversion
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    bloomPass,

    render() {
      composer.render();
    },

    resize(width, height) {
      renderTarget.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
    },

    setParams(params) {
      if (params.threshold !== undefined) bloomPass.threshold = params.threshold;
      if (params.strength !== undefined) bloomPass.strength = params.strength;
      if (params.radius !== undefined) bloomPass.radius = params.radius;
    },

    dispose() {
      renderTarget.dispose();
      composer.dispose();
    },
  };
}

export default createBloom;

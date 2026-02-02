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
  const pixelRatio = renderer.getPixelRatio();
  const w = size.x * pixelRatio;
  const h = size.y * pixelRatio;

  // Create render target (no MSAA for performance, bloom hides aliasing)
  const renderTarget = new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
  });

  const composer = new EffectComposer(renderer, renderTarget);

  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);

  // Use half resolution for bloom (much faster, barely noticeable difference)
  const bloomPass = new UnrealBloomPass(
    new Vector2(Math.floor(w / 2), Math.floor(h / 2)),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);

  // Output pass for color space conversion
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // Track current size to avoid unnecessary resizes
  let currentW = w;
  let currentH = h;
  let resizeScheduled = false;

  return {
    composer,
    bloomPass,

    render() {
      composer.render();
    },

    resize(width, height) {
      // Skip invalid dimensions
      if (width <= 0 || height <= 0) return;

      const pr = renderer.getPixelRatio();
      const w = Math.floor(width * pr);
      const h = Math.floor(height * pr);

      // Skip if size hasn't changed (prevents redundant GPU allocations)
      if (w === currentW && h === currentH) return;

      currentW = w;
      currentH = h;

      // Resize render target and composer immediately
      renderTarget.setSize(w, h);
      composer.setSize(w, h);

      // Defer bloom resize to next frame to spread the load
      if (!resizeScheduled) {
        resizeScheduled = true;
        requestAnimationFrame(() => {
          // Bloom at half resolution for performance
          bloomPass.resolution.set(Math.floor(w / 2), Math.floor(h / 2));
          resizeScheduled = false;
        });
      }
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

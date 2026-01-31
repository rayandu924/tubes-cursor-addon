/**
 * Bloom Post-Processing
 * Adds glow effect using Three.js EffectComposer
 */

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Vector2, WebGLRenderTarget, HalfFloatType } from 'three';

// Custom shader to restore alpha transparency
const AlphaShader = {
  uniforms: {
    'tDiffuse': { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // Use max RGB channel for alpha
      float maxC = max(max(color.r, color.g), color.b);
      // Direct alpha - no dark edges
      gl_FragColor = vec4(color.rgb, maxC);
    }
  `
};

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

  // Create render target with alpha support
  const renderTarget = new WebGLRenderTarget(size.x, size.y, {
    type: HalfFloatType,
    samples: 4,
  });

  // Create composer
  const composer = new EffectComposer(renderer, renderTarget);

  // Render pass
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);

  // Bloom pass
  const bloomPass = new UnrealBloomPass(
    new Vector2(size.x, size.y),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);

  // Alpha restoration pass
  const alphaPass = new ShaderPass(AlphaShader);
  alphaPass.renderToScreen = true;
  composer.addPass(alphaPass);

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

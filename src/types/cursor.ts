/**
 * Type definitions for the Tubes Cursor addon
 * Implements the standard cursor addon interface
 */

/**
 * Standard interface for cursor addon instances
 * All cursor addons must return an object matching this interface
 */
export interface CursorInstance {
  /**
   * Clean up and dispose of all resources
   */
  dispose(): void;

  /**
   * Update cursor configuration at runtime (hot-reload support)
   * Optional method for cursors that support live config updates
   */
  setConfig?(options: Record<string, any>): void;

  /**
   * Optional update method for animation frames
   */
  update?(state: { elapsed: number; deltaTime: number }): void;
}

/**
 * Standard initialization function signature for cursor addons
 */
export type CursorInitFunction = (
  canvas: HTMLCanvasElement,
  options?: Record<string, any>
) => CursorInstance;

/**
 * Tubes Cursor specific configuration
 */
export interface TubesCursorOptions {
  passthrough?: boolean;
  bloom?: {
    threshold?: number;
    strength?: number;
    radius?: number;
  } | null;
  tubes?: {
    count?: number;
    minRadius?: number;
    maxRadius?: number;
    minTubularSegments?: number;
    maxTubularSegments?: number;
    radialSegments?: number;
    material?: {
      metalness?: number;
      roughness?: number;
    };
    lights?: {
      intensity?: number;
      colors?: string[];
    };
    colors?: string[];
    lerp?: number;
    noise?: number;
  };
  sleepRadiusX?: number;
  sleepRadiusY?: number;
  sleepTimeScale1?: number;
  sleepTimeScale2?: number;
}

/**
 * Tubes Cursor instance interface
 */
export interface TubesCursorInstance extends CursorInstance {
  three?: any; // Three.js app reference
  options?: TubesCursorOptions;
  tubes?: any; // TubesManager reference
  bloom?: any; // Bloom pass reference
}

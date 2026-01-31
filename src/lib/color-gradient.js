/**
 * ColorGradient
 * Interpolates between multiple colors for smooth gradients
 */

import { Color } from 'three';

/**
 * Create a color gradient interpolator
 * @param {Array<string|number>} colors - Array of color values
 * @returns {Object} Gradient object with getColorAt method
 */
export function createColorGradient(colors) {
  let colorArray = colors;
  let parsedColors = [];

  // Reusable color to avoid allocations
  const _tempColor = new Color();

  // Parse initial colors
  parseColors(colors);

  return {
    setColors: parseColors,
    getColorAt: getColorAt,
  };

  function parseColors(newColors) {
    colorArray = newColors;
    parsedColors = [];

    colorArray.forEach((colorValue) => {
      const color = new Color(colorValue);
      parsedColors.push(color);
    });
  }

  /**
   * Get interpolated color at position t (0-1)
   * @param {number} t - Position in gradient (0-1)
   * @param {Color} target - Optional target Color object
   * @returns {Color}
   */
  function getColorAt(t, target) {
    // Use provided target or reusable temp
    const out = target || _tempColor;

    // Clamp t to 0-1
    const position = Math.max(0, Math.min(1, t)) * (colorArray.length - 1);
    const index = Math.floor(position);
    const color1 = parsedColors[index];

    // If at the end, copy last color
    if (index >= colorArray.length - 1) {
      out.copy(color1);
      return out;
    }

    // Interpolate between two colors
    const fraction = position - index;
    const color2 = parsedColors[index + 1];

    out.r = color1.r + fraction * (color2.r - color1.r);
    out.g = color1.g + fraction * (color2.g - color1.g);
    out.b = color1.b + fraction * (color2.b - color1.b);

    return out;
  }
}

export default createColorGradient;

/**
 * PointerHandler
 * Unified mouse/touch input handling for DOM elements
 * OPTIMIZED: Cached bounding rect, reduced function calls
 */

import { Vector2 } from 'three';

// Global state
const handlers = new Map();
let mouseX = 0;
let mouseY = 0;
let isInitialized = false;

/**
 * Create a pointer handler for a DOM element
 */
export function createPointerHandler(options) {
  const element = options.domElement;

  // Cache rect - update on resize
  let rect = element.getBoundingClientRect();
  let rectLeft = rect.left;
  let rectTop = rect.top;
  let rectWidth = rect.width;
  let rectHeight = rect.height;
  let rectRight = rectLeft + rectWidth;
  let rectBottom = rectTop + rectHeight;

  const handler = {
    position: new Vector2(),
    nPosition: new Vector2(),
    hover: false,
    onEnter: options.onEnter || null,
    onMove: options.onMove || null,
    onClick: options.onClick || null,
    onLeave: options.onLeave || null,

    // Update cached rect (call on resize)
    updateRect() {
      rect = element.getBoundingClientRect();
      rectLeft = rect.left;
      rectTop = rect.top;
      rectWidth = rect.width;
      rectHeight = rect.height;
      rectRight = rectLeft + rectWidth;
      rectBottom = rectTop + rectHeight;
    },

    // Fast inline check and update
    _update() {
      const inside = mouseX >= rectLeft && mouseX <= rectRight &&
                     mouseY >= rectTop && mouseY <= rectBottom;

      if (inside) {
        // Update positions inline
        const px = mouseX - rectLeft;
        const py = mouseY - rectTop;
        handler.position.x = px;
        handler.position.y = py;
        handler.nPosition.x = (px / rectWidth) * 2 - 1;
        handler.nPosition.y = -(py / rectHeight) * 2 + 1;

        if (!handler.hover) {
          handler.hover = true;
          if (handler.onEnter) handler.onEnter(handler);
        }
        if (handler.onMove) handler.onMove(handler);
      } else if (handler.hover) {
        handler.hover = false;
        if (handler.onLeave) handler.onLeave(handler);
      }

      return inside;
    }
  };

  handlers.set(element, handler);

  if (!isInitialized) {
    document.body.addEventListener('pointermove', onPointerMove, { passive: true });
    document.body.addEventListener('pointerleave', onPointerLeave);
    document.body.addEventListener('click', onClick);
    window.addEventListener('resize', onWindowResize);
    isInitialized = true;
  }

  handler.dispose = () => {
    handlers.delete(element);
    if (handlers.size === 0 && isInitialized) {
      document.body.removeEventListener('pointermove', onPointerMove);
      document.body.removeEventListener('pointerleave', onPointerLeave);
      document.body.removeEventListener('click', onClick);
      window.removeEventListener('resize', onWindowResize);
      isInitialized = false;
    }
  };

  return handler;
}

function onPointerMove(event) {
  mouseX = event.clientX;
  mouseY = event.clientY;
  for (const handler of handlers.values()) {
    handler._update();
  }
}

function onClick(event) {
  mouseX = event.clientX;
  mouseY = event.clientY;
  for (const handler of handlers.values()) {
    if (handler._update() && handler.onClick) {
      handler.onClick(handler);
    }
  }
}

function onPointerLeave() {
  for (const handler of handlers.values()) {
    if (handler.hover) {
      handler.hover = false;
      if (handler.onLeave) handler.onLeave(handler);
    }
  }
}

function onWindowResize() {
  for (const handler of handlers.values()) {
    handler.updateRect();
  }
}

export default createPointerHandler;

/**
 * PointerHandler
 * Unified mouse/touch input handling for DOM elements
 * OPTIMIZED: Cached bounding rect, reduced function calls
 *
 * Supports passthrough mode for cursor addons in iframes:
 * - Sets pointer-events: none on element (clicks pass through)
 * - Listens to parent window for mouse events
 */

import { Vector2 } from 'three';

// Global state
const handlers = new Map();
let mouseX = 0;
let mouseY = 0;
let isInitialized = false;
let eventTarget = null;
let passthroughMode = false;

/**
 * Get the event target (parent window or current document)
 */
function getEventTarget(passthrough) {
  if (!passthrough) {
    return { doc: document, win: window };
  }

  // Try to access parent window (for iframe passthrough)
  try {
    if (window.parent && window.parent !== window) {
      // Check if we can access parent (same-origin policy)
      const parentDoc = window.parent.document;
      return { doc: parentDoc, win: window.parent };
    }
  } catch (e) {
    console.warn('[PointerHandler] Cannot access parent window (cross-origin). Falling back to current window.');
  }

  return { doc: document, win: window };
}

/**
 * Create a pointer handler for a DOM element
 * @param {Object} options
 * @param {HTMLElement} options.domElement - The element to track
 * @param {boolean} options.passthrough - Enable passthrough mode (pointer-events: none)
 * @param {Function} options.onEnter - Called when pointer enters
 * @param {Function} options.onMove - Called when pointer moves
 * @param {Function} options.onClick - Called on click
 * @param {Function} options.onLeave - Called when pointer leaves
 */
export function createPointerHandler(options) {
  const element = options.domElement;
  const passthrough = options.passthrough || false;

  // Set pointer-events: none for passthrough mode
  // This allows clicks to pass through to elements below
  // Note: Only set on the canvas element, NOT on body/html (that would block all clicks)
  if (passthrough) {
    element.style.pointerEvents = 'none';
  }

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
    passthroughMode = passthrough;
    eventTarget = getEventTarget(passthrough);

    eventTarget.doc.addEventListener('pointermove', onPointerMove, { passive: true });
    eventTarget.doc.addEventListener('pointerleave', onPointerLeave);
    // Don't listen to clicks in passthrough mode (they go to parent)
    if (!passthrough) {
      eventTarget.doc.addEventListener('click', onClick);
    }
    eventTarget.win.addEventListener('resize', onWindowResize);
    isInitialized = true;
  }

  handler.dispose = () => {
    handlers.delete(element);
    if (handlers.size === 0 && isInitialized && eventTarget) {
      eventTarget.doc.removeEventListener('pointermove', onPointerMove);
      eventTarget.doc.removeEventListener('pointerleave', onPointerLeave);
      if (!passthroughMode) {
        eventTarget.doc.removeEventListener('click', onClick);
      }
      eventTarget.win.removeEventListener('resize', onWindowResize);
      isInitialized = false;
      eventTarget = null;
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

// Debounced resize for pointer handler
let resizeTimeout = null;
function onWindowResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    for (const handler of handlers.values()) {
      handler.updateRect();
    }
  }, 100);
}

export default createPointerHandler;

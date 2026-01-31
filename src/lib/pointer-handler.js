/**
 * PointerHandler
 * Unified mouse/touch input handling for DOM elements
 */

import { Vector2 } from 'three';

// Global state for all pointer handlers
const handlers = new Map();
const mousePosition = new Vector2();
let isInitialized = false;

/**
 * Create a pointer handler for a DOM element
 * @param {Object} options
 * @param {HTMLElement} options.domElement - DOM element to track
 * @param {Function} options.onEnter - Called when pointer enters
 * @param {Function} options.onMove - Called when pointer moves
 * @param {Function} options.onClick - Called on click
 * @param {Function} options.onLeave - Called when pointer leaves
 * @returns {Object} Handler object with position, nPosition, hover, dispose
 */
export function createPointerHandler(options) {
  const handler = {
    // Position in pixels relative to element
    position: new Vector2(),

    // Normalized position (-1 to 1)
    nPosition: new Vector2(),

    // Whether pointer is over element
    hover: false,

    // Callbacks
    onEnter: options.onEnter || (() => {}),
    onMove: options.onMove || (() => {}),
    onClick: options.onClick || (() => {}),
    onLeave: options.onLeave || (() => {}),
  };

  // Register handler
  registerHandler(options.domElement, handler);

  // Add dispose method
  handler.dispose = () => {
    unregisterHandler(options.domElement);
  };

  return handler;
}

/**
 * Register a handler for a DOM element
 */
function registerHandler(element, handler) {
  if (handlers.has(element)) return;

  handlers.set(element, handler);

  // Initialize global listeners if needed
  if (!isInitialized) {
    document.body.addEventListener('pointermove', onPointerMove);
    document.body.addEventListener('pointerleave', onPointerLeave);
    document.body.addEventListener('click', onClick);
    isInitialized = true;
  }
}

/**
 * Unregister a handler
 */
function unregisterHandler(element) {
  handlers.delete(element);

  // Remove global listeners if no more handlers
  if (handlers.size === 0 && isInitialized) {
    document.body.removeEventListener('pointermove', onPointerMove);
    document.body.removeEventListener('pointerleave', onPointerLeave);
    document.body.removeEventListener('click', onClick);
    isInitialized = false;
  }
}

/**
 * Handle pointer move event
 */
function onPointerMove(event) {
  mousePosition.x = event.clientX;
  mousePosition.y = event.clientY;

  for (const [element, handler] of handlers) {
    const rect = element.getBoundingClientRect();

    if (isInsideRect(rect)) {
      // Update positions
      updatePositions(handler, rect);

      // Handle enter
      if (!handler.hover) {
        handler.hover = true;
        handler.onEnter(handler);
      }

      // Always call move
      handler.onMove(handler);
    } else if (handler.hover) {
      // Handle leave
      handler.hover = false;
      handler.onLeave(handler);
    }
  }
}

/**
 * Handle click event
 */
function onClick(event) {
  mousePosition.x = event.clientX;
  mousePosition.y = event.clientY;

  for (const [element, handler] of handlers) {
    const rect = element.getBoundingClientRect();
    updatePositions(handler, rect);

    if (isInsideRect(rect)) {
      handler.onClick(handler);
    }
  }
}

/**
 * Handle pointer leave (leaves document)
 */
function onPointerLeave() {
  for (const handler of handlers.values()) {
    if (handler.hover) {
      handler.hover = false;
      handler.onLeave(handler);
    }
  }
}

/**
 * Update handler positions from rect
 */
function updatePositions(handler, rect) {
  const { position, nPosition } = handler;

  // Pixel position relative to element
  position.x = mousePosition.x - rect.left;
  position.y = mousePosition.y - rect.top;

  // Normalized position (-1 to 1, y inverted for WebGL)
  nPosition.x = (position.x / rect.width) * 2 - 1;
  nPosition.y = -(position.y / rect.height) * 2 + 1;
}

/**
 * Check if mouse is inside rect
 */
function isInsideRect(rect) {
  const { x, y } = mousePosition;
  const { left, top, width, height } = rect;

  return x >= left && x <= left + width && y >= top && y <= top + height;
}

export default createPointerHandler;

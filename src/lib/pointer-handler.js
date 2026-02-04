/**
 * PointerHandler
 * Receives mouse position from parent window via postMessage
 *
 * SECURITY: The cursor addon runs in an iframe with pointer-events: none.
 * It cannot track mouse events directly. Instead, the parent window
 * tracks mouse position and sends updates via postMessage.
 *
 * Message types:
 * - CURSOR_POSITION: { x, y } - Mouse position update
 * - CURSOR_INIT: { settings, viewport, position } - Initial configuration
 * - VIEWPORT_RESIZE: { width, height } - Viewport size change
 */

import { Vector2 } from 'three';

// Global state
const handlers = new Map();
let mouseX = 0;
let mouseY = 0;
let isInitialized = false;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;

/**
 * Create a pointer handler for a DOM element
 * @param {Object} options
 * @param {HTMLElement} options.domElement - The element to track
 * @param {Function} options.onMove - Called when pointer moves
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
    hover: true, // Always hovering in cursor mode (we always render)
    onMove: options.onMove || null,

    // Update cached rect (call on resize)
    updateRect() {
      rect = element.getBoundingClientRect();
      rectLeft = rect.left;
      rectTop = rect.top;
      rectWidth = rect.width || viewportWidth;
      rectHeight = rect.height || viewportHeight;
      rectRight = rectLeft + rectWidth;
      rectBottom = rectTop + rectHeight;
    },

    // Update from received position
    _update() {
      // Update positions
      const px = mouseX - rectLeft;
      const py = mouseY - rectTop;
      handler.position.x = px;
      handler.position.y = py;
      handler.nPosition.x = (px / rectWidth) * 2 - 1;
      handler.nPosition.y = -(py / rectHeight) * 2 + 1;

      if (handler.onMove) handler.onMove(handler);
    }
  };

  handlers.set(element, handler);

  if (!isInitialized) {
    // Listen for postMessage from parent
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', onWindowResize);
    isInitialized = true;
  }

  handler.dispose = () => {
    handlers.delete(element);
    if (handlers.size === 0 && isInitialized) {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onWindowResize);
      isInitialized = false;
    }
  };

  return handler;
}

/**
 * Handle messages from parent window
 */
function onMessage(event) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'CURSOR_POSITION':
      mouseX = data.x;
      mouseY = data.y;
      for (const handler of handlers.values()) {
        handler._update();
      }
      break;

    case 'CURSOR_INIT':
      if (data.position) {
        mouseX = data.position.x;
        mouseY = data.position.y;
      }
      if (data.viewport) {
        viewportWidth = data.viewport.width;
        viewportHeight = data.viewport.height;
      }
      for (const handler of handlers.values()) {
        handler.updateRect();
        handler._update();
      }
      break;

    case 'VIEWPORT_RESIZE':
      viewportWidth = data.width;
      viewportHeight = data.height;
      for (const handler of handlers.values()) {
        handler.updateRect();
      }
      break;
  }
}

/**
 * Handle local resize (backup)
 */
function onWindowResize() {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  for (const handler of handlers.values()) {
    handler.updateRect();
  }
}

export default createPointerHandler;

/**
 * PointerHandler
 * Unified mouse/touch input handling for DOM elements
 * OPTIMIZED: Cached bounding rect, reduced function calls
 *
 * Supports passthrough mode for cursor addons in iframes:
 * - Sets pointer-events: none on element (clicks pass through)
 * - Listens to MyWallpaper SDK cursor:move events for position
 */

import { Vector2 } from 'three';

// Global state
const handlers = new Map();
let mouseX = 0;
let mouseY = 0;
let isInitialized = false;
let passthroughMode = false;

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
  // This allows clicks to pass through to elements below (in parent window)
  if (passthrough) {
    element.style.pointerEvents = 'none';
    // Also set on body and html to ensure full passthrough
    document.body.style.pointerEvents = 'none';
    document.documentElement.style.pointerEvents = 'none';
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

    if (passthrough) {
      // PASSTHROUGH MODE: Listen for cursor:move events from MyWallpaper SDK
      // The parent window sends cursor position via postMessage since we can't
      // receive mouse events with pointer-events: none
      initSdkCursorTracking();
    } else {
      // NORMAL MODE: Listen to native mouse events
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerleave', onPointerLeave);
      document.addEventListener('click', onClick);
    }

    window.addEventListener('resize', onWindowResize);
    isInitialized = true;
  }

  handler.dispose = () => {
    handlers.delete(element);
    if (handlers.size === 0 && isInitialized) {
      if (passthroughMode) {
        cleanupSdkCursorTracking();
      } else {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerleave', onPointerLeave);
        document.removeEventListener('click', onClick);
      }
      window.removeEventListener('resize', onWindowResize);
      isInitialized = false;
    }
  };

  return handler;
}

/**
 * Initialize SDK cursor tracking via MyWallpaper API
 * Uses the cursor:move system event for addons with pointer-events: none
 */
function initSdkCursorTracking() {
  // Check if MyWallpaper SDK is available
  if (typeof window.MyWallpaper !== 'undefined' && window.MyWallpaper.onEvent) {
    console.log('[PointerHandler] Using MyWallpaper SDK cursor:move event');
    window.MyWallpaper.onEvent('cursor:move', onSdkCursorMove);
  } else {
    // SDK not ready yet, wait for it
    console.log('[PointerHandler] Waiting for MyWallpaper SDK...');
    const checkInterval = setInterval(() => {
      if (typeof window.MyWallpaper !== 'undefined' && window.MyWallpaper.onEvent) {
        console.log('[PointerHandler] MyWallpaper SDK ready, subscribing to cursor:move');
        window.MyWallpaper.onEvent('cursor:move', onSdkCursorMove);
        clearInterval(checkInterval);
      }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (typeof window.MyWallpaper === 'undefined') {
        console.warn('[PointerHandler] MyWallpaper SDK not available, cursor tracking disabled');
      }
    }, 5000);
  }
}

/**
 * Cleanup SDK cursor tracking
 */
function cleanupSdkCursorTracking() {
  if (typeof window.MyWallpaper !== 'undefined' && window.MyWallpaper.offEvent) {
    window.MyWallpaper.offEvent('cursor:move', onSdkCursorMove);
  }
}

/**
 * Handle cursor position from SDK
 */
function onSdkCursorMove(data) {
  mouseX = data.x;
  mouseY = data.y;
  for (const handler of handlers.values()) {
    handler._update();
  }
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

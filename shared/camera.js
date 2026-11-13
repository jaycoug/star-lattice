// Camera: converts between world coordinates (lattice spacing = 1) and screen pixels, ported from
// Java Camera. Holds the world point shown at the screen center and the zoom scale (pixels per
// world unit). Points are [x, y].

const MAX_SCALE = 600;   // roughly one star fills the screen
const FIT_MARGIN = 1;    // world units of padding around the board
const FIT_OUT = 0.5;     // how far past the fitted view one can zoom out

export function createCamera() {
  let [cx, cy] = [0, 0];
  let scale = 60;
  let minScale = 10;
  let [width, height] = [1, 1];

  const cam = {
    scale: () => scale,

    setViewport(w, h) {
      [width, height] = [w, h];
    },

    worldToScreen([x, y]) {
      return [(x - cx) * scale + width / 2, (y - cy) * scale + height / 2];
    },

    screenToWorld([x, y]) {
      return [(x - width / 2) / scale + cx, (y - height / 2) / scale + cy];
    },

    /** Move the view by a drag of (dx, dy) pixels. */
    panByPixels(dx, dy) {
      cx -= dx / scale;
      cy -= dy / scale;
    },

    /** Zoom by a factor, keeping the world point under the cursor fixed on the screen. */
    zoomAt(factor, screen) {
      const before = cam.screenToWorld(screen);
      scale = Math.max(minScale, Math.min(MAX_SCALE, scale * factor));
      const after = cam.screenToWorld(screen);
      cx += before[0] - after[0];
      cy += before[1] - after[1];
    },

    /** Center on the origin and zoom so a board of the given radius fits; zooming out stops at half that. */
    fitBoard(radius) {
      const w = 2 * radius + 2 * FIT_MARGIN;
      const h = Math.sqrt(3) * radius + 2 * FIT_MARGIN;
      scale = Math.min(width / w, height / h);
      minScale = scale * FIT_OUT;
      [cx, cy] = [0, 0];
    },
  };
  return cam;
}

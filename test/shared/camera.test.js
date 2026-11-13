// Ported from Java CameraTest.

import { test, assertClose, assertSamePoint } from '../runner.js';
import { createCamera } from '../../shared/camera.js';

function newCamera() {
  const cam = createCamera();
  cam.setViewport(800, 600);
  return cam;
}

test('screenToWorld undoes worldToScreen', () => {
  const cam = newCamera();
  cam.panByPixels(37, -12);
  cam.zoomAt(1.7, [100, 200]);
  const world = [2.5, -1.25];
  assertSamePoint(cam.screenToWorld(cam.worldToScreen(world)), world);
});

test('zoom keeps the point under the cursor fixed', () => {
  const cam = newCamera();
  const before = cam.screenToWorld([250, 400]);
  cam.zoomAt(2, [250, 400]);
  assertSamePoint(cam.screenToWorld([250, 400]), before);
});

test('fitBoard centers the origin; zooming out stops at half the fitted scale', () => {
  const cam = newCamera();
  cam.fitBoard(5);
  assertSamePoint(cam.worldToScreen([0, 0]), [400, 300]);
  const fitted = cam.scale();
  cam.zoomAt(0.8, [400, 300]);
  assertClose(cam.scale(), fitted * 0.8);
  cam.zoomAt(0.1, [400, 300]);
  assertClose(cam.scale(), fitted * 0.5);
});

function canvasToEpaperPlanes(canvas, options = {}) {
  const {
    width = 250,
    height = 122,
    colorMode = 'bwr',
    blackThreshold = 80,
    redDetect = true,
    invertBlack = false,
    invertRed = false
  } = options;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const rowBytes = Math.ceil(width / 8);
  const planeSize = rowBytes * height;
  const blackPlane = new Uint8Array(planeSize);
  const redPlane = new Uint8Array(planeSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const bitIndex = y * rowBytes * 8 + x;
      const byteIdx = Math.floor(bitIndex / 8);
      const bitPos = 7 - (bitIndex % 8);

      const isRed = redDetect && r > 150 && g < 80 && b < 80;
      const isBlack = (r + g + b) / 3 < blackThreshold;

      if (isRed) {
        if (!invertRed) {
          redPlane[byteIdx] |= (1 << bitPos);
        }
      } else if (isBlack) {
        if (!invertBlack) {
          blackPlane[byteIdx] |= (1 << bitPos);
        }
      }
    }
  }

  return { blackPlane, redPlane };
}

window.canvasToEpaperPlanes = canvasToEpaperPlanes;

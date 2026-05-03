import { describe, expect, it } from 'vitest';
import {
  applyGaussianBlur,
  buildOutlineRgbaBuffer,
  buildColouringPageOutline,
  buildXDogResponseMap,
  calculateLuminance,
  extractGrayscaleBuffer,
  fitContainDimensions,
  thinOutlineBuffer,
  DEFAULT_OUTLINE_RGB,
  DEFAULT_XDOG_EPSILON,
} from './colouringPagePipeline';

function makeImageDataLike(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number, number]
) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = fill(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }

  return { width, height, data };
}

describe('colouringPagePipeline', () => {
  it('calculates luminance with the standard formula', () => {
    expect(calculateLuminance(255, 0, 0)).toBeCloseTo(76.245, 3);
    expect(calculateLuminance(0, 255, 0)).toBeCloseTo(149.685, 3);
    expect(calculateLuminance(0, 0, 255)).toBeCloseTo(29.07, 3);
  });

  it('fits source dimensions inside a max working size without distortion', () => {
    expect(fitContainDimensions(4000, 2000, 1200)).toEqual({ width: 1200, height: 600 });
    expect(fitContainDimensions(1200, 2400, 1200)).toEqual({ width: 600, height: 1200 });
  });

  it('produces a flat grayscale buffer from rgba input', () => {
    const imageData = makeImageDataLike(2, 2, () => [255, 255, 255, 255]);
    const grayscale = extractGrayscaleBuffer(imageData);

    expect(Array.from(grayscale)).toEqual([255, 255, 255, 255]);
  });

  it('applies a gaussian blur to grayscale pixels', () => {
    const imageData = makeImageDataLike(3, 3, (x, y) =>
      x === 1 && y === 1 ? [255, 255, 255, 255] : [0, 0, 0, 255]
    );
    const grayscale = extractGrayscaleBuffer(imageData);
    const blurred = applyGaussianBlur(grayscale, 3, 3, 1);

    expect(blurred[4]).toBeGreaterThan(blurred[0]);
    expect(blurred[4]).toBeLessThan(255);
    expect(blurred[0]).toBeGreaterThan(0);
  });

  it('produces no xdog outline on a flat image', () => {
    const imageData = makeImageDataLike(5, 5, () => [255, 255, 255, 255]);
    const grayscale = extractGrayscaleBuffer(imageData);
    const lineStrengths = buildXDogResponseMap(grayscale, 5, 5);
    const outline = buildOutlineRgbaBuffer(lineStrengths, 5, 5);

    expect(Math.max(...Array.from(lineStrengths))).toBe(0);
    expect(outline.every((value) => value === 0)).toBe(true);
  });

  it('turns a hard black and white edge into a clean xdog outline', () => {
    const imageData = makeImageDataLike(7, 7, (x) =>
      x < 3 ? [0, 0, 0, 255] : [255, 255, 255, 255]
    );
    const grayscale = extractGrayscaleBuffer(imageData);
    const lineStrengths = buildXDogResponseMap(grayscale, 7, 7);
    const outline = buildOutlineRgbaBuffer(lineStrengths, 7, 7);

    expect(Array.from(lineStrengths).some((value) => value > 0)).toBe(true);
    expect(Array.from(outline).some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });

  it('keeps a low-contrast interior feature visible in the final outline', () => {
    const imageData = makeImageDataLike(9, 9, (x, y) => {
      if (x >= 3 && x <= 5 && y >= 2 && y <= 6) {
        return [185, 185, 185, 255];
      }

      return [235, 235, 235, 255];
    });

    const result = buildColouringPageOutline(imageData, DEFAULT_XDOG_EPSILON);
    const interiorFeatureAlpha = result.outlinePixels[(4 * 9 + 3) * 4 + 3] ?? 0;

    expect(interiorFeatureAlpha).toBeGreaterThan(0);
  });

  it('maps xdog strength to warm outline pixels with proportional opacity', () => {
    const outline = buildOutlineRgbaBuffer(Float32Array.from([0, 0.25, 0.5, 1]), 2, 2, 0);

    expect(outline.slice(0, 4)).toEqual(Uint8ClampedArray.from([0, 0, 0, 0]));
    expect(outline.slice(4, 8)).toEqual(
      Uint8ClampedArray.from([
        DEFAULT_OUTLINE_RGB.red,
        DEFAULT_OUTLINE_RGB.green,
        DEFAULT_OUTLINE_RGB.blue,
        73,
      ])
    );
    expect(outline.slice(8, 12)).toEqual(
      Uint8ClampedArray.from([
        DEFAULT_OUTLINE_RGB.red,
        DEFAULT_OUTLINE_RGB.green,
        DEFAULT_OUTLINE_RGB.blue,
        147,
      ])
    );
    expect(outline.slice(12, 16)).toEqual(
      Uint8ClampedArray.from([
        DEFAULT_OUTLINE_RGB.red,
        DEFAULT_OUTLINE_RGB.green,
        DEFAULT_OUTLINE_RGB.blue,
        255,
      ])
    );
  });

  it('thins dense outline pixels by reducing the alpha of interior pixels', () => {
    const denseOutline = buildOutlineRgbaBuffer(
      Float32Array.from(Array.from({ length: 9 }, () => 1)),
      3,
      3,
      0
    );
    const thinned = thinOutlineBuffer(denseOutline, 3, 3);

    const topLeftAlpha = thinned[3] ?? 0;
    const centerAlpha = thinned[4 * 4 + 3] ?? 0;

    expect(centerAlpha).toBeLessThan(topLeftAlpha);
    expect(centerAlpha).toBe(115);
    expect(topLeftAlpha).toBe(255);
  });

  it('builds a complete xdog outline result', () => {
    const imageData = makeImageDataLike(7, 7, (x) =>
      x < 3 ? [15, 15, 15, 255] : [245, 245, 245, 255]
    );
    const result = buildColouringPageOutline(imageData, DEFAULT_XDOG_EPSILON);

    expect(result.width).toBe(7);
    expect(result.height).toBe(7);
    expect(Math.max(...Array.from(result.edgeStrengths))).toBeGreaterThan(0);
    expect(
      Array.from(result.outlinePixels).some((value, index) => index % 4 === 3 && value > 0)
    ).toBe(true);
  });
});

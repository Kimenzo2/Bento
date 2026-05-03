export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ColouringPageOutlineResult {
  width: number;
  height: number;
  grayscale: Float32Array;
  edgeStrengths: Float32Array;
  outlinePixels: Uint8ClampedArray;
}

export interface FitContainDimensions {
  width: number;
  height: number;
}

interface XDogResponseOptions {
  smallSigma: number;
  k: number;
  epsilon: number;
  phi: number;
  preBlurSigma: number;
}

export const DEFAULT_XDOG_SMALL_SIGMA = 0.5;
export const DEFAULT_XDOG_K = 4.5;
export const DEFAULT_XDOG_EPSILON = -0.18;
export const DEFAULT_XDOG_PHI = 24;
export const DEFAULT_XDOG_PRE_BLUR_SIGMA = 0.12;
export const DEFAULT_OUTLINE_RGB = {
  red: 20,
  green: 18,
  blue: 16,
};

const DEFAULT_COARSE_XDOG_OPTIONS: XDogResponseOptions = {
  smallSigma: DEFAULT_XDOG_SMALL_SIGMA,
  k: DEFAULT_XDOG_K,
  epsilon: DEFAULT_XDOG_EPSILON,
  phi: DEFAULT_XDOG_PHI,
  preBlurSigma: DEFAULT_XDOG_PRE_BLUR_SIGMA,
};

const DETAIL_XDOG_OPTIONS: XDogResponseOptions = {
  smallSigma: 0.28,
  k: 2.1,
  epsilon: -0.05,
  phi: 16,
  preBlurSigma: 0.04,
};

const DETAIL_RESPONSE_WEIGHT = 0.8;

export function calculateLuminance(red: number, green: number, blue: number): number {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

export function fitContainDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number
): FitContainDimensions {
  if (sourceWidth <= 0 || sourceHeight <= 0 || maxDimension <= 0) {
    return { width: 1, height: 1 };
  }

  const longestSide = Math.max(sourceWidth, sourceHeight);

  if (longestSide <= maxDimension) {
    return {
      width: Math.max(1, Math.round(sourceWidth)),
      height: Math.max(1, Math.round(sourceHeight)),
    };
  }

  const scale = maxDimension / longestSide;

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function extractGrayscaleBuffer(imageData: ImageDataLike): Float32Array {
  const grayscale = new Float32Array(imageData.width * imageData.height);
  const { data } = imageData;

  for (
    let pixelIndex = 0, dataIndex = 0;
    pixelIndex < grayscale.length;
    pixelIndex += 1, dataIndex += 4
  ) {
    grayscale[pixelIndex] = calculateLuminance(
      data[dataIndex],
      data[dataIndex + 1],
      data[dataIndex + 2]
    );
  }

  return grayscale;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function combineResponseMaps(
  coarseStrengths: ArrayLike<number>,
  detailStrengths: ArrayLike<number>,
  detailWeight: number
): Float32Array {
  const combinedStrengths = new Float32Array(coarseStrengths.length);

  for (let index = 0; index < combinedStrengths.length; index += 1) {
    const coarseStrength = clampUnit(Number(coarseStrengths[index] ?? 0));
    const detailStrength = clampUnit(Number(detailStrengths[index] ?? 0)) * detailWeight;
    combinedStrengths[index] = Math.max(coarseStrength, detailStrength);
  }

  return combinedStrengths;
}

function buildGaussianKernel(sigma: number): { radius: number; weights: Float32Array } {
  if (!Number.isFinite(sigma) || sigma <= 0) {
    return { radius: 0, weights: Float32Array.from([1]) };
  }

  const radius = Math.max(1, Math.ceil(sigma * 3));
  const weights = new Float32Array(radius * 2 + 1);
  const sigmaSquaredTimesTwo = 2 * sigma * sigma;
  let totalWeight = 0;

  for (let offset = -radius; offset <= radius; offset += 1) {
    const weight = Math.exp(-(offset * offset) / sigmaSquaredTimesTwo);
    weights[offset + radius] = weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    for (let index = 0; index < weights.length; index += 1) {
      weights[index] /= totalWeight;
    }
  }

  return { radius, weights };
}

export function applyGaussianBlur(
  grayscale: ArrayLike<number>,
  width: number,
  height: number,
  sigma: number
): Float32Array {
  const pixelCount = width * height;

  if (pixelCount <= 0) {
    return new Float32Array(0);
  }

  if (!Number.isFinite(sigma) || sigma <= 0) {
    return Float32Array.from(grayscale as ArrayLike<number>);
  }

  const { radius, weights } = buildGaussianKernel(sigma);
  if (radius === 0) {
    return Float32Array.from(grayscale as ArrayLike<number>);
  }

  const horizontalPass = new Float32Array(pixelCount);
  const blurred = new Float32Array(pixelCount);

  const clampX = (x: number) => Math.max(0, Math.min(width - 1, x));
  const clampY = (y: number) => Math.max(0, Math.min(height - 1, y));
  const sample = (x: number, y: number) => Number(grayscale[clampY(y) * width + clampX(x)] ?? 0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let weightedSum = 0;

      for (let offset = -radius; offset <= radius; offset += 1) {
        weightedSum += sample(x + offset, y) * weights[offset + radius];
      }

      horizontalPass[y * width + x] = weightedSum;
    }
  }

  const sampleHorizontal = (x: number, y: number) =>
    horizontalPass[clampY(y) * width + clampX(x)] ?? 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let weightedSum = 0;

      for (let offset = -radius; offset <= radius; offset += 1) {
        weightedSum += sampleHorizontal(x, y + offset) * weights[offset + radius];
      }

      blurred[y * width + x] = weightedSum;
    }
  }

  return blurred;
}

export function buildXDogResponseMap(
  grayscale: ArrayLike<number>,
  width: number,
  height: number,
  options: Partial<{
    smallSigma: number;
    k: number;
    epsilon: number;
    phi: number;
    preBlurSigma: number;
  }> = {}
): Float32Array {
  if (width <= 0 || height <= 0) {
    return new Float32Array(0);
  }

  const smallSigma = options.smallSigma ?? DEFAULT_XDOG_SMALL_SIGMA;
  const k = options.k ?? DEFAULT_XDOG_K;
  const epsilon = options.epsilon ?? DEFAULT_XDOG_EPSILON;
  const phi = options.phi ?? DEFAULT_XDOG_PHI;
  const preBlurSigma = options.preBlurSigma ?? DEFAULT_XDOG_PRE_BLUR_SIGMA;

  const preBlurred = applyGaussianBlur(grayscale, width, height, preBlurSigma);
  const smallBlur = applyGaussianBlur(preBlurred, width, height, smallSigma);
  const largeBlur = applyGaussianBlur(preBlurred, width, height, smallSigma * k);

  const pixelCount = width * height;
  const differences = new Float32Array(pixelCount);
  let maxMagnitude = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const magnitude = Math.abs((smallBlur[index] ?? 0) - (largeBlur[index] ?? 0));
    differences[index] = magnitude;

    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
    }
  }

  const normaliser = maxMagnitude > 0 ? maxMagnitude : 1;
  const lineStrengths = new Float32Array(pixelCount);

  for (let index = 0; index < pixelCount; index += 1) {
    const normalizedMagnitude = clampUnit(differences[index] / normaliser);
    const xDogInput = -normalizedMagnitude;
    const softThreshold = 0.5 * (1 - Math.tanh(phi * (xDogInput - epsilon)));
    lineStrengths[index] = softThreshold * normalizedMagnitude;
  }

  return lineStrengths;
}

export function buildOutlineRgbaBuffer(
  lineStrengths: ArrayLike<number>,
  width: number,
  height: number,
  _legacyThreshold = 0
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (
    let pixelIndex = 0, rgbaIndex = 0;
    pixelIndex < width * height;
    pixelIndex += 1, rgbaIndex += 4
  ) {
    const lineStrength = clampUnit(Number(lineStrengths[pixelIndex] ?? 0));

    if (lineStrength <= 0) {
      continue;
    }

    const alpha = Math.round(Math.min(1, lineStrength * 1.15) * 255);

    if (alpha <= 0) {
      continue;
    }

    pixels[rgbaIndex] = DEFAULT_OUTLINE_RGB.red;
    pixels[rgbaIndex + 1] = DEFAULT_OUTLINE_RGB.green;
    pixels[rgbaIndex + 2] = DEFAULT_OUTLINE_RGB.blue;
    pixels[rgbaIndex + 3] = alpha;
  }

  return pixels;
}

export function thinOutlineBuffer(
  outlinePixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const thinnedPixels = Uint8ClampedArray.from(outlinePixels);

  if (width <= 0 || height <= 0) {
    return thinnedPixels;
  }

  const isDark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return false;
    }

    return Number(outlinePixels[(y * width + x) * 4 + 3] ?? 0) > 0;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rgbaIndex = (y * width + x) * 4;
      const alpha = Number(outlinePixels[rgbaIndex + 3] ?? 0);

      if (alpha <= 0) {
        continue;
      }

      let darkNeighbors = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }

          if (isDark(x + offsetX, y + offsetY)) {
            darkNeighbors += 1;
          }
        }
      }

      if (darkNeighbors > 4 && alpha > 110) {
        thinnedPixels[rgbaIndex + 3] = Math.round(alpha * 0.45);
      }
    }
  }

  return thinnedPixels;
}

export function buildColouringPageOutline(
  imageData: ImageDataLike,
  _legacyThreshold = 0
): ColouringPageOutlineResult {
  const grayscale = extractGrayscaleBuffer(imageData);
  const coarseEdgeStrengths = buildXDogResponseMap(
    grayscale,
    imageData.width,
    imageData.height,
    DEFAULT_COARSE_XDOG_OPTIONS
  );
  const detailEdgeStrengths = buildXDogResponseMap(
    grayscale,
    imageData.width,
    imageData.height,
    DETAIL_XDOG_OPTIONS
  );
  const edgeStrengths = combineResponseMaps(
    coarseEdgeStrengths,
    detailEdgeStrengths,
    DETAIL_RESPONSE_WEIGHT
  );
  const outlinePixels = thinOutlineBuffer(
    buildOutlineRgbaBuffer(edgeStrengths, imageData.width, imageData.height),
    imageData.width,
    imageData.height
  );

  return {
    width: imageData.width,
    height: imageData.height,
    grayscale,
    edgeStrengths,
    outlinePixels,
  };
}

export function createOutlineImageData(
  outlinePixels: Uint8ClampedArray,
  width: number,
  height: number
): ImageData {
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width)) : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? Math.max(1, Math.round(height)) : 1;
  const normalizedPixels = new Uint8ClampedArray(safeWidth * safeHeight * 4);
  normalizedPixels.set(outlinePixels.subarray(0, normalizedPixels.length));

  return new ImageData(normalizedPixels, safeWidth, safeHeight);
}

/// <reference path="./vendor.d.ts" />

import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import sharp from 'sharp';
import { trace } from 'ts-potrace';
import { clamp } from './shared';

export interface BitmapAnalysis {
  width: number;
  height: number;
  perceptualHash: string;
  entropy: number;
  blackPixelRatio: number;
  edgeDensity: number;
}

export interface TracedPageArtifact {
  svg: string;
  previewPng: Buffer;
  thumbnailPng: Buffer;
  analysis: BitmapAnalysis;
  width: number;
  height: number;
}

export interface PdfPageInput {
  svg: string;
  title?: string;
  pageWidth: number;
  pageHeight: number;
  landscape?: boolean;
}

export interface PdfBuildOptions {
  pageSize: 'letter' | 'a4' | 'custom';
  orientation: 'portrait' | 'landscape';
  marginPoints?: number;
  title?: string;
}

export function normalisePaperSize(
  pageSize: PdfBuildOptions['pageSize'],
  orientation: 'portrait' | 'landscape'
): {
  size: 'LETTER' | 'A4' | [number, number];
  layout: 'portrait' | 'landscape';
} {
  if (pageSize === 'a4') {
    return { size: 'A4', layout: orientation };
  }

  if (pageSize === 'letter') {
    return { size: 'LETTER', layout: orientation };
  }

  return { size: [612, 792], layout: orientation };
}

export async function analyzeBitmap(buffer: Buffer): Promise<BitmapAnalysis> {
  const normalized = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize({ width: 32, height: 32, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = normalized;
  const total = info.width * info.height;
  const histogram = new Array<number>(256).fill(0);
  let sum = 0;
  let blackPixels = 0;
  let edgeAccumulator = 0;
  let edgeComparisons = 0;

  for (let i = 0; i < data.length; i++) {
    const value = data[i] ?? 0;
    histogram[value] = (histogram[value] ?? 0) + 1;
    sum += value;
    if (value < 160) blackPixels++;
  }

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = y * info.width + x;
      const value = data[idx] ?? 0;
      if (x + 1 < info.width) {
        edgeAccumulator += Math.abs(value - (data[idx + 1] ?? 0));
        edgeComparisons++;
      }
      if (y + 1 < info.height) {
        edgeAccumulator += Math.abs(value - (data[idx + info.width] ?? 0));
        edgeComparisons++;
      }
    }
  }

  let entropy = 0;
  for (const count of histogram) {
    if (count === 0) continue;
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }

  const normalizedEntropy = entropy / 8;
  const mean = sum / total;
  const blackPixelRatio = blackPixels / total;
  const edgeDensity = edgeComparisons > 0 ? edgeAccumulator / (edgeComparisons * 255) : 0;

  const dhash = await createDifferenceHash(buffer);

  return {
    width: info.width,
    height: info.height,
    perceptualHash: dhash,
    entropy: clamp(normalizedEntropy, 0, 1),
    blackPixelRatio: clamp(blackPixelRatio, 0, 1),
    edgeDensity: clamp(edgeDensity + (mean < 128 ? 0.02 : 0), 0, 1),
  };
}

export async function createDifferenceHash(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize({ width: 9, height: 8, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const bits: string[] = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width - 1; x++) {
      const left = data[y * info.width + x] ?? 0;
      const right = data[y * info.width + x + 1] ?? 0;
      bits.push(left > right ? '1' : '0');
    }
  }

  const hex = bitsToHex(bits.join(''));
  return hex.padStart(16, '0');
}

export function hammingDistance(left: string, right: string): number {
  const a = left.padStart(Math.max(left.length, right.length), '0');
  const b = right.padStart(Math.max(left.length, right.length), '0');
  let distance = 0;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }

  return distance;
}

export async function traceToSvg(
  buffer: Buffer,
  options: {
    threshold?: number;
    turdSize?: number;
    alphaMax?: number;
    optCurve?: boolean;
    optTolerance?: number;
    blackOnWhite?: boolean;
  } = {}
): Promise<string> {
  const traceInput = await sharp(buffer)
    .rotate()
    .greyscale()
    .threshold(options.threshold ?? 180)
    .png()
    .toBuffer();

  return await new Promise((resolve, reject) => {
    trace(
      traceInput,
      {
        threshold: options.threshold ?? 180,
        turdSize: options.turdSize ?? 2,
        alphaMax: options.alphaMax ?? 1,
        optCurve: options.optCurve ?? true,
        optTolerance: options.optTolerance ?? 0.2,
        blackOnWhite: options.blackOnWhite ?? true,
        color: '#000000',
        background: 'transparent',
      },
      (error: Error | null, svg?: string) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(svg || '');
      }
    );
  });
}

export async function buildTracedPageArtifact(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    threshold?: number;
    turdSize?: number;
  } = {}
): Promise<TracedPageArtifact> {
  const base = sharp(buffer).rotate().flatten({ background: '#ffffff' }).greyscale();
  const metadata = await base.metadata();
  const resized = base.resize({
    width: options.maxWidth ?? 2200,
    withoutEnlargement: true,
    fit: 'inside',
  });

  const normalizedBuffer = await resized.png().toBuffer();
  const analysis = await analyzeBitmap(normalizedBuffer);
  const svg = await traceToSvg(normalizedBuffer, {
    threshold: options.threshold ?? 180,
    turdSize: options.turdSize ?? 3,
  });

  const previewPng = await sharp(Buffer.from(svg))
    .resize({ width: 1600, withoutEnlargement: true, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const thumbnailPng = await sharp(previewPng)
    .resize({ width: 420, withoutEnlargement: true, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    svg,
    previewPng,
    thumbnailPng,
    analysis,
    width: metadata.width ?? analysis.width,
    height: metadata.height ?? analysis.height,
  };
}

export async function buildPdfBuffer(
  pages: PdfPageInput[],
  options: PdfBuildOptions
): Promise<Buffer> {
  const paper = normalisePaperSize(options.pageSize, options.orientation);
  const margin = options.marginPoints ?? 36;
  const outputChunks: Buffer[] = [];

  const pdf = new PDFDocument({
    autoFirstPage: false,
    margin,
    size: paper.size,
    layout: paper.layout,
    compress: true,
    info: options.title
      ? {
          Title: options.title,
          Creator: 'Genesis Colouring Books',
        }
      : undefined,
  });

  pdf.on('data', (chunk: Buffer) => {
    outputChunks.push(Buffer.from(chunk));
  });

  const finished = new Promise<Buffer>((resolve, reject) => {
    pdf.on('end', () => resolve(Buffer.concat(outputChunks)));
    pdf.on('error', reject);
  });

  for (const page of pages) {
    pdf.addPage({
      size: paper.size,
      layout: page.landscape ? 'landscape' : paper.layout,
      margin,
    });

    const pageWidth = typeof paper.size === 'string' ? pdf.page.width : page.pageWidth;
    const pageHeight = typeof paper.size === 'string' ? pdf.page.height : page.pageHeight;

    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;

    SVGtoPDF(pdf, page.svg, margin, margin, {
      width: contentWidth,
      height: contentHeight,
      preserveAspectRatio: 'xMidYMid meet',
      assumePt: true,
      precision: 3,
    });
  }

  pdf.end();

  return finished;
}

function bitsToHex(bits: string): string {
  let result = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = bits.slice(i, i + 4);
    result += Number.parseInt(nibble.padEnd(4, '0'), 2).toString(16);
  }
  return result;
}

declare module 'pdfkit' {
  const PDFDocument: any;
  export default PDFDocument;
}

declare module 'sharp' {
  const sharp: any;
  export default sharp;
}

declare module 'svg-to-pdfkit' {
  const SVGtoPDF: any;
  export default SVGtoPDF;
}

declare module 'ts-potrace' {
  export function trace(
    input: Buffer | Uint8Array,
    options: Record<string, unknown>,
    callback: (error: Error | null, svg?: string) => void
  ): void;
}

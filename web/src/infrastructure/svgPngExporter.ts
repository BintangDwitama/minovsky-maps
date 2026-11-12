import type { ImageExporter } from '../application/ports';
import type { Scenario } from '../domain/scenario';

export interface RenderedSvg {
  readonly markup: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Rasterises an SVG rendering of the board to PNG via an offscreen canvas.
 * The SVG renderer is injected (composition root), keeping this class free of UI imports.
 */
export class SvgPngExporter implements ImageExporter {
  constructor(private readonly renderSvg: (s: Scenario) => RenderedSvg) {}

  async renderPng(s: Scenario, minLongSide: number): Promise<Blob> {
    const svg = this.renderSvg(s);
    const scale = Math.max(1, minLongSide / Math.max(svg.width, svg.height));
    const width = Math.ceil(svg.width * scale);
    const height = Math.ceil(svg.height * scale);

    const url = URL.createObjectURL(new Blob([svg.markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available in this browser.');
      ctx.drawImage(img, 0, 0, width, height);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render the board image.'));
    img.src = src;
  });

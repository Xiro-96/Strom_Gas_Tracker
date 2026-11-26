import { compressImage, targetSize } from '@/lib/image';

describe('targetSize – längste Kante höchstens 1600 px', () => {
  it('verkleinert proportional, vergrößert nie', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(targetSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('compressImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('speichert ohne Bild-API das Original', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const original = new Blob(['x'], { type: 'image/jpeg' });
    expect(await compressImage(original)).toBe(original);
  });

  it('zeichnet ein 12-MP-Foto auf 1600 px und nimmt das kleinere Ergebnis', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 4000, height: 3000, close })),
    );
    vi.stubGlobal('OffscreenCanvas', undefined);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const small = new Blob(['klein'], { type: 'image/jpeg' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      expect([this.width, this.height]).toEqual([1600, 1200]);
      callback(small);
    });
    const original = new Blob([new Uint8Array(5000)], { type: 'image/jpeg' });
    expect(await compressImage(original)).toBe(small);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(close).toHaveBeenCalled();
  });

  it('behält das Original bei Fehlern', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('HEIC nicht lesbar'))),
    );
    const original = new Blob(['x'], { type: 'image/heic' });
    expect(await compressImage(original)).toBe(original);
  });
});

import { Blob as NodeBlob } from 'node:buffer';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { createMeter } from '@/data/repositories/meters';
import { addReading, savePhoto } from '@/data/repositories/readings';
import { renderRoute } from '@/test/renderRoute';

// jsdom-Blobs lassen sich von fake-indexeddb nicht speichern – Node-Blob wie ein echter Browser.
beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:foto'), revokeObjectURL: vi.fn() });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Fotogalerie im Verlauf', () => {
  it('zeigt Zählerfotos mit Datum und öffnet sie groß', async () => {
    const user = userEvent.setup();
    const meter = await createMeter({
      energyType: 'electricity',
      name: 'Stromzähler',
      unit: 'kWh',
      decimals: 1,
      activeFrom: '2026-10-01',
    });
    await addReading({ meterId: meter.id, date: '2026-10-01', value: 1000, kind: 'regular' });
    const photoId = await savePhoto(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    await addReading({
      meterId: meter.id,
      date: '2026-10-15',
      value: 1140.5,
      kind: 'regular',
      photoId,
    });
    renderRoute('/verlauf');
    const gallery = (await screen.findByRole('heading', { name: 'Fotos' })).closest(
      '[data-slot="card"]',
    );
    if (!(gallery instanceof HTMLElement)) throw new Error('Galerie fehlt');
    const thumb = within(gallery).getByRole('button', {
      name: /Foto vom 15\.10\.2026 · 1\.140,5\skWh/,
    });
    await user.click(thumb);
    const dialog = await screen.findByRole('dialog', { name: 'Foto' });
    expect(
      await within(dialog).findByRole('img', { name: 'Foto des Zählerstands' }),
    ).toHaveAttribute('src', 'blob:foto');
  });
});

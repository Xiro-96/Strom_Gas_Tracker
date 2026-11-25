import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Hintergrund = Icon-Fläche (#111827), damit maskable und Apple-Icon nahtlos wirken.
const background = '#111827';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});

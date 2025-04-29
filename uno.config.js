import { defineConfig, presetAttributify, presetIcons, presetMini, presetWind4, transformerAttributifyJsx, transformerVariantGroup, toEscapedSelector, transformerDirectives } from "unocss";
import extractorSvelte from '@unocss/extractor-svelte';
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import path from "path";
import { readdir } from "fs/promises";

export default defineConfig({
  extractors: [extractorSvelte()],
  presets: [
    presetMini(),
    presetWind4(),
    presetAttributify(),
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
        'width': '1em',
        'height': '1em',
      },
      scale: 1,
      warn: true,
      collections: {
        icons: FileSystemIconLoader('./static/icons'),
      },
      customizations: {
        transform(svg, collection, icon) {
          // do not apply fill to this icons on this collection
          if (collection === 'custom' && icon === 'my-icon')
            return svg
          return svg.replace(/#fff/, 'currentColor')
        },
      },
    })
  ],
  content: {
    inline: [
      async () => {
        const iconDir = path.resolve("static/icons");
        const icons = (await readdir(iconDir) || []).filter(name => name != '.DS_Store').map(file => `i-icons-${path.parse(file).name}`);
        console.log({ icons });

        return icons.join(' ')
      },
    ],
  },
  transformers: [
    transformerAttributifyJsx(),
    transformerVariantGroup(),
    transformerDirectives(),
  ],
  preflights: [
    {
      getCSS: ({ theme }) => {
        // const t = theme;
        return `
          html {
            scroll-behavior: smooth;
            height: 100%;
          }
        `;
      },
    }
  ],
  rules: [
    [/^custom-(.+)$/, ([, name], { rawSelector }) => {
      const selector = toEscapedSelector(rawSelector)
      if (name.includes('noscrollbar')) {
        return `
          ${selector}::-webkit-scrollbar {
            width: 0 !important;
          }
        `
      }
    }],
  ],
  safelist: [
    ...Array.from('text-3 text-4 text-5 text-6 text-7'.split(' ')),
    ...Array.from('text-white/100 text-white/45'.split(' ')),
    ...Array.from('bg-white/100 bg-white/50 bg-[#1B2120]/100 bg-[#1B2120]/50'.split(' ')),
    ...Array.from('underline underline-offset-4 decoration-2 decoration-wavy decoration-red-500"'.split(' ')),
  ],
  shortcuts: [
    ['flex-ac', 'flex justify-around items-center'],
    ['flex-bc', 'flex justify-between items-center'],
    ['flex-ec', 'flex justify-end items-center'],
    ['flex-cc', 'flex justify-center items-center'],
    ['flex-ce', 'flex justify-center items-end'],
    ['flex-cx', 'flex justify-center'],
    ['flex-cy', 'flex items-center'],
    ['scroll-y', 'overflow-y-auto custom-noscrollbar'],
    ['transition300', 'duration-300 ease-in-out transition-all'],
  ],
})
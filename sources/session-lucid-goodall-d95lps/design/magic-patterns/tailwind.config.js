// Brand colors live in data/brand.ts and are injected as CSS variables by BrandTheme.
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './{components,pages,data,hooks,contexts,utils,types}/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        midnight: { DEFAULT: c('midnight'), 2: c('midnight2'), 3: c('midnight3') },
        gold: { DEFAULT: c('gold'), soft: c('goldSoft'), deep: c('goldDeep') },
        ivory: c('ivory'),
        sand: c('sand'),
        ink: c('ink'),
        muted: c('muted'),
        line: c('line'),
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};

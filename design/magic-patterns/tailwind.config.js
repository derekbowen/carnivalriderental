export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        canvas: '#F3F5FA',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#0B1B3F',
          soft: '#2E3B5C',
          muted: '#56627D',
        },
        line: {
          DEFAULT: '#E1E5EE',
          strong: '#C9D0DE',
        },
        accent: {
          DEFAULT: '#FFC629',
          hover: '#F5B700',
          soft: '#FFF2CC',
          ink: '#7A5200',
        },
        pop: {
          DEFAULT: '#E5352B',
          soft: '#FDE4E2',
        },
        placeholder: '#D4D9E3',
        success: {
          DEFAULT: '#1F7A4D',
          soft: '#DFF3E8',
        },
        danger: {
          DEFAULT: '#C2281F',
          soft: '#FDE4E2',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
};

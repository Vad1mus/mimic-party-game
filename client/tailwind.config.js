/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka"', '"Rubik"', 'system-ui', 'sans-serif'],
        sans: ['"Nunito"', '"Rubik"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.7) rotate(-8deg)', opacity: '0' },
          '15%': { transform: 'translateY(-20px) scale(1.15) rotate(6deg)', opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(-260px) scale(1) rotate(-6deg)', opacity: '0' },
        },
        popIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '70%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.75' },
          '100%': { transform: 'scale(1.45)', opacity: '0' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        'float-up': 'floatUp 2.6s ease-out forwards',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-ring': 'pulseRing 1.4s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        wiggle: 'wiggle 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

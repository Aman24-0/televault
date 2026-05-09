export default {
  content: ["./index.html","./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn:  { from:{ opacity:0 }, to:{ opacity:1 } },
        slideUp: { from:{ opacity:0, transform:'translateY(8px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        scaleIn: { from:{ opacity:0, transform:'scale(0.95)' }, to:{ opacity:1, transform:'scale(1)' } },
      }
    }
  },
  plugins: []
}

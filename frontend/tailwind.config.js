export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xs': '375px',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'scale-in':   'scaleIn 0.15s ease-out',
        'float':      'logoFloat 3s ease-in-out infinite',
        'pulse-glow': 'logoPulse 3s ease-in-out infinite',
        'shimmer':    'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 },                           to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: 0, transform: 'scale(0.95)' },  to: { opacity: 1, transform: 'scale(1)' } },
        logoFloat: { '0%,100%': { transform: 'translateY(0)' },      '50%': { transform: 'translateY(-3px)' } },
        logoPulse: {
          '0%,100%': { boxShadow: '0 0 12px rgba(99,102,241,0.4)' },
          '50%':     { boxShadow: '0 0 24px rgba(99,102,241,0.7)' }
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-indigo': '0 0 20px rgba(99,102,241,0.4)',
        'glow-purple': '0 0 20px rgba(168,85,247,0.4)',
        'glow-amber':  '0 0 20px rgba(251,191,36,0.4)',
      }
    }
  },
  plugins: [],
}

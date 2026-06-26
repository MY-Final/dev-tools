/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-active': 'var(--color-surface-active)',
        'sidebar-bg': 'var(--color-sidebar-bg)',
        'editor-bg': 'var(--color-editor-bg)',
        border: 'var(--color-border)',
        'border-hover': 'var(--color-border-hover)',
        'border-active': 'var(--color-border-active)',
        'text-primary': 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-inverse': 'var(--color-text-inverse)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-subtle': 'var(--color-accent-subtle)',
        success: 'var(--color-success)',
        'success-subtle': 'var(--color-success-subtle)',
        warning: 'var(--color-warning)',
        'warning-subtle': 'var(--color-warning-subtle)',
        danger: 'var(--color-danger)',
        'danger-subtle': 'var(--color-danger-subtle)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace']
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)'
      }
    }
  },
  plugins: []
}

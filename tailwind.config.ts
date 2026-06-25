import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        "primary-dark": "rgb(var(--c-primary-dark) / <alpha-value>)",
        "primary-ghost": "rgb(var(--c-primary-ghost) / <alpha-value>)",
        "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        "danger-dark": "rgb(var(--c-danger-dark) / <alpha-value>)",
        "danger-subtle": "rgb(var(--c-danger-subtle) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-subtle": "rgb(var(--c-surface-subtle) / <alpha-value>)",
        bubble: "rgb(var(--c-bubble) / <alpha-value>)",
        "bubble-strong": "rgb(var(--c-bubble-strong) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        "border-strong": "rgb(var(--c-border-strong) / <alpha-value>)",
        "text-base": "rgb(var(--c-text-base) / <alpha-value>)",
        "text-muted": "rgb(var(--c-text-muted) / <alpha-value>)",
      },
      transitionTimingFunction: {
        press: "cubic-bezier(0.23, 1, 0.32, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "dot-fade": {
          "0%, 80%, 100%": { opacity: "0.25", transform: "scale(0.85)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up":
          "fade-in-up 300ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "scale-in": "scale-in 220ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "dot-fade": "dot-fade 1.2s cubic-bezier(0.23, 1, 0.32, 1) infinite",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            // Remove backticks around inline code
            "code::before": { content: '""' },
            "code::after": { content: '""' },
            code: {
              fontSize: "0.85em",
              fontFamily:
                'ui-monospace, "Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
              backgroundColor: "rgb(var(--c-bubble))",
              padding: "0.15em 0.35em",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            pre: {
              backgroundColor: "rgb(17 24 39)", // gray-900
              borderRadius: "0.5rem",
              fontSize: "0.82em",
            },
            "pre code": {
              backgroundColor: "transparent",
              padding: "0",
              borderRadius: "0",
              fontWeight: "400",
            },
          },
        },
        invert: {
          css: {
            code: {
              backgroundColor: "rgb(var(--c-bubble))",
            },
          },
        },
      },
    },
  },
  plugins: [
    typography,
    function ({
      addVariant,
    }: {
      addVariant: (name: string, definition: string) => void;
    }) {
      addVariant("hoverable", "@media (hover: hover) and (pointer: fine)");
    },
  ],
} satisfies Config;

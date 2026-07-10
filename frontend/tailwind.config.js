const printedInk = {
  ink: "#071019",
  "ink-soft": "#0d1a24",
  gold: "#b8893d",
  "gold-soft": "#d6b16a",
  ivory: "#f3e4c7",
  parchment: "#efe1c7",
  "muted-brown": "#6f5130",
  bg: "#071019",
  surface: "#101a22",
  text: "#f3e4c7",
  "text-muted": "#b9a98e",
  primary: "#b8893d",
  accent: "#d6b16a",
  border: "rgba(184, 137, 61, 0.35)",
  paper: "#efe1c7",
  "paper-text": "#071019",
  glow: "rgba(214, 177, 106, 0.08)",
};

const warmPaper = {
  bg: "#f4ebdd",
  surface: "#fff8ed",
  text: "#2b2118",
  "text-muted": "#6f6255",
  primary: "#8b5e34",
  accent: "#c49a6c",
  border: "#ded0bd",
  paper: "#fff8ed",
  "paper-text": "#2b2118",
  glow: "rgba(196, 154, 108, 0.16)",
};

const nightStudy = {
  bg: "#111111",
  surface: "#1a1a1a",
  text: "#ede7dd",
  "text-muted": "#a89f94",
  primary: "#c9a86a",
  accent: "#8e735b",
  border: "#2c2c2c",
  paper: "#202020",
  "paper-text": "#ede7dd",
  glow: "rgba(201, 168, 106, 0.1)",
};

/** @type {import('tailwindcss').Config} */
const config = {
  theme: {
    extend: {
      colors: {
        sophia: {
          bg: "var(--sophia-bg)",
          surface: "var(--sophia-surface)",
          text: "var(--sophia-text)",
          "text-muted": "var(--sophia-text-muted)",
          border: "var(--sophia-border)",
          primary: "var(--sophia-primary)",
          accent: "var(--sophia-accent)",
          paper: "var(--sophia-paper)",
          "paper-text": "var(--sophia-paper-text)",
        },
        "printed-ink": printedInk,
        "warm-paper": warmPaper,
        "night-study": nightStudy,
      },
    },
  },
};

export { printedInk, warmPaper, nightStudy };
export default config;

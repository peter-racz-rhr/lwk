/* Appearance and personal preferences: theme (neutral or Catppuccin), accent, display name,
   sound and haptics. Stored in this device's local storage; applied as CSS variables. */
(function () {
  "use strict";
  const KEY = "ante-prefs";
  const flavor = (name, light, c) => ({ name, light, c });
  // Catppuccin palettes (catppuccin.com/palette): base, mantle, crust, surface0-2, overlay0-1, subtext0, text, plus accents.
  const FLAVORS = {
    neutral: flavor("Neutral", false, { base: "#141414", mantle: "#0a0a0a", crust: "#000000", s0: "#1c1c1c", s1: "#262626", s2: "#333333", o0: "#6b6b6b", o1: "#737373", sub: "#a3a3a3", text: "#fafafa", green: "#4ade80", red: "#f87171", yellow: "#eab308", blue: "#3b82f6" }),
    latte: flavor("Latte", true, { base: "#eff1f5", mantle: "#e6e9ef", crust: "#dce0e8", s0: "#ccd0da", s1: "#bcc0cc", s2: "#acb0be", o0: "#9ca0b0", o1: "#8c8fa1", sub: "#6c6f85", text: "#4c4f69", green: "#40a02b", red: "#d20f39", yellow: "#df8e1d", blue: "#1e66f5" }),
    frappe: flavor("Frappé", false, { base: "#303446", mantle: "#292c3c", crust: "#232634", s0: "#414559", s1: "#51576d", s2: "#626880", o0: "#737994", o1: "#838ba7", sub: "#a5adce", text: "#c6d0f5", green: "#a6d189", red: "#e78284", yellow: "#e5c890", blue: "#8caaee" }),
    macchiato: flavor("Macchiato", false, { base: "#24273a", mantle: "#1e2030", crust: "#181926", s0: "#363a4f", s1: "#494d64", s2: "#5b6078", o0: "#6e738d", o1: "#8087a2", sub: "#a5adcb", text: "#cad3f5", green: "#a6da95", red: "#ed8796", yellow: "#eed49f", blue: "#8aadf4" }),
    mocha: flavor("Mocha", false, { base: "#1e1e2e", mantle: "#181825", crust: "#11111b", s0: "#313244", s1: "#45475a", s2: "#585b70", o0: "#6c7086", o1: "#7f849c", sub: "#a6adc8", text: "#cdd6f4", green: "#a6e3a1", red: "#f38ba8", yellow: "#f9e2af", blue: "#89b4fa" }),
  };
  const ACCENTS = {
    latte: { rosewater: "#dc8a78", flamingo: "#dd7878", pink: "#ea76cb", mauve: "#8839ef", red: "#d20f39", maroon: "#e64553", peach: "#fe640b", yellow: "#df8e1d", green: "#40a02b", teal: "#179299", sky: "#04a5e5", sapphire: "#209fb5", blue: "#1e66f5", lavender: "#7287fd" },
    frappe: { rosewater: "#f2d5cf", flamingo: "#eebebe", pink: "#f4b8e4", mauve: "#ca9ee6", red: "#e78284", maroon: "#ea999c", peach: "#ef9f76", yellow: "#e5c890", green: "#a6d189", teal: "#81c8be", sky: "#99d1db", sapphire: "#85c1dc", blue: "#8caaee", lavender: "#babbf1" },
    macchiato: { rosewater: "#f4dbd6", flamingo: "#f0c6c6", pink: "#f5bde6", mauve: "#c6a0f6", red: "#ed8796", maroon: "#ee99a0", peach: "#f5a97f", yellow: "#eed49f", green: "#a6da95", teal: "#8bd5ca", sky: "#91d7e3", sapphire: "#7dc4e4", blue: "#8aadf4", lavender: "#b7bdf8" },
    mocha: { rosewater: "#f5e0dc", flamingo: "#f2cdcd", pink: "#f5c2e7", mauve: "#cba6f7", red: "#f38ba8", maroon: "#eba0ac", peach: "#fab387", yellow: "#f9e2af", green: "#a6e3a1", teal: "#94e2d5", sky: "#89dceb", sapphire: "#74c7ec", blue: "#89b4fa", lavender: "#b4befe" },
  };
  ACCENTS.neutral = { white: "#fafafa", blue: "#60a5fa", violet: "#a78bfa", rose: "#fb7185", amber: "#fbbf24", emerald: "#34d399" };
  const DEFAULT_ACCENT = { neutral: "white", latte: "mauve", frappe: "mauve", macchiato: "mauve", mocha: "mauve" };

  let prefs = { theme: "neutral", accent: "white", name: "", sound: true, haptics: true };
  try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage blocked */ }
  if (!FLAVORS[prefs.theme]) prefs.theme = "neutral";
  if (!ACCENTS[prefs.theme][prefs.accent]) prefs.accent = DEFAULT_ACCENT[prefs.theme];

  /** Text colour for the accent: whichever of dark ink or white has the higher WCAG contrast. */
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  }
  function onColor(hex) {
    const L = luminance(hex), dark = (L + 0.05) / (luminance("#11111b") + 0.05), light = 1.05 / (L + 0.05);
    return dark >= light ? "#11111b" : "#ffffff";
  }

  function apply() {
    const f = FLAVORS[prefs.theme], c = f.c, acc = ACCENTS[prefs.theme][prefs.accent];
    const root = document.documentElement, set = (k, v) => root.style.setProperty(k, v);
    set("--bg", c.mantle); set("--bg-2", c.mantle); set("--surface", c.base); set("--surface-2", c.s0); set("--surface-3", c.s1);
    set("--line", f.light ? c.s0 : c.s0); set("--line-2", c.s1);
    set("--ivory", c.text); set("--ivory-2", c.sub); set("--ivory-3", c.o1); set("--bar", c.o0);
    set("--win", c.green); set("--loss", c.red); set("--warn", c.yellow); set("--info", c.blue);
    set("--accent", acc); set("--on-accent", onColor(acc));
    set("--nav-bg", f.light ? c.base : c.crust);
    set("--felt", f.light ? c.s0 : c.base); set("--felt-deep", f.light ? c.s1 : c.mantle);
    set("--brass", c.sub); set("--brass-2", c.text); set("--brass-deep", c.o0); set("--brass-ink", f.light ? "#ffffff" : c.crust);
    root.dataset.theme = prefs.theme;
    root.dataset.light = String(f.light);
    root.style.colorScheme = f.light ? "light" : "dark";
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = c.mantle;
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } }

  window.AntePrefs = {
    FLAVORS, ACCENTS,
    get: () => Object.assign({}, prefs),
    isLight: () => FLAVORS[prefs.theme].light,
    set(patch) {
      Object.assign(prefs, patch);
      if (patch.theme && !ACCENTS[prefs.theme][prefs.accent]) prefs.accent = DEFAULT_ACCENT[prefs.theme];
      prefs.name = String(prefs.name || "").slice(0, 40);
      save(); apply();
      return Object.assign({}, prefs);
    },
    apply,
  };
  apply();
})();

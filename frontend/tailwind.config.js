/** @type {import('tailwindcss').Config} */
//
// VOKA-SEAT Tailwind theme.
//
// This file declares two design systems side-by-side, kept on a single
// configuration so a single `tailwindcss` build can serve both apps:
//
//   1. Admin_Flat_Palette — used exclusively by the Admin Dashboard.
//      Tokens: bg-soft-white, bg-secondary, border-soft, text-primary,
//      text-secondary, status-* (occupied / available / low-stock /
//      out-of-stock / success / warning), plus the existing admin font
//      and spacing scales (hero-title, card-title, section-title,
//      sidebar-width, navbar-height, gutter, container-margin,
//      tap-target-min). These values must NOT change.
//
//   2. Customer_MD3_Tokens — used exclusively by the Customer App
//      (frontend/src/customer/**). Mirrors
//      frontend/src/customer/theme/tokens.ts. Adds the MD3 color set,
//      Lexend headline + Inter body/label typography stack, MD3 border
//      radius and the xs/sm/md/lg/xl + margin-mobile/margin-tablet
//      spacing scale.
//
// Spec references: Requirement 18.2, 18.13, 18.14, 18.15, 18.16,
// design.md "Customer App Component" / "Customer App Component
// Architecture".
//
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // -------------------------------------------------------------
        // Admin_Flat_Palette (legacy admin-only tokens — DO NOT REMOVE)
        // -------------------------------------------------------------
        "bg-soft-white": "#FFFFFF",
        "bg-secondary": "#F3F4F6",
        "border-soft": "#E5E7EB",
        "text-primary": "#1E293B",
        "text-secondary": "#475569",
        "status-occupied": "#D81B60",
        "status-available": "#FFFFFF",
        "status-low-stock": "#F59E0B",
        "status-out-of-stock": "#EF4444",
        "status-success": "#10B981",
        "status-warning": "#F97316",

        // -------------------------------------------------------------
        // Customer_MD3_Tokens — Material Design 3 token set
        // -------------------------------------------------------------
        // Primary palette
        "primary": "#b80035",
        "primary-container": "#e11d48",
        "on-primary": "#ffffff",
        "on-primary-container": "#fffaf9",
        "primary-fixed": "#ffdada",
        "surface-tint": "#be0037",

        // Secondary palette (mint-green; used for Customer App available seats)
        "secondary": "#006c49",
        "secondary-container": "#6cf8bb",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#00714d",
        "secondary-fixed": "#6ffbbe",

        // Tertiary palette (used for the "ready" order status pill)
        "tertiary": "#006855",
        "tertiary-container": "#00836c",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#eefff7",

        // Surface / background palette
        "surface": "#fbf8fc",
        "background": "#fbf8fc",
        "surface-bright": "#fbf8fc",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f2f7",
        "surface-container": "#f0edf1",
        "surface-container-high": "#eae7eb",
        "surface-container-highest": "#e4e1e6",
        "surface-variant": "#e4e1e6",

        // Text & outline
        "on-surface": "#1b1b1e",
        "on-surface-variant": "#5c3f40",
        "on-background": "#1b1b1e",
        "outline": "#906f70",
        "outline-variant": "#e5bdbe",

        // Error
        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a"
      },
      borderRadius: {
        // Customer_Border_Radius (also used by admin where appropriate)
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        // -------------------------------------------------------------
        // Admin spacing scale (legacy — DO NOT REMOVE)
        // -------------------------------------------------------------
        "tap-target-min": "44px",
        "sidebar-width": "240px",
        "navbar-height": "72px",
        "gutter": "16px",
        "container-margin": "24px",

        // -------------------------------------------------------------
        // Customer_Spacing_Scale
        // -------------------------------------------------------------
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "margin-mobile": "16px",
        "margin-tablet": "24px"
      },
      fontFamily: {
        // -------------------------------------------------------------
        // Admin font families (legacy — DO NOT REMOVE)
        // -------------------------------------------------------------
        "hero-title": ["Inter"],
        "card-title": ["Inter"],
        "section-title": ["Inter"],
        "section-title-mobile": ["Inter"],
        "body": ["Inter"],
        "label": ["Inter"],
        "small-text": ["Inter"],

        // -------------------------------------------------------------
        // Customer_Typography — Lexend headlines, Inter body/labels
        // -------------------------------------------------------------
        "display-lg": ["Lexend", "sans-serif"],
        "headline-lg-mobile": ["Lexend", "sans-serif"],
        "headline-md": ["Lexend", "sans-serif"],
        "headline-sm": ["Lexend", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "label-md": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"]
      },
      fontSize: {
        // -------------------------------------------------------------
        // Admin font sizes (legacy — DO NOT REMOVE)
        // -------------------------------------------------------------
        "hero-title": ["42px", { lineHeight: "1.2", fontWeight: "700" }],
        "card-title": ["22px", { lineHeight: "1.4", fontWeight: "600" }],
        "section-title": ["32px", { lineHeight: "1.3", fontWeight: "700" }],
        "section-title-mobile": ["24px", { lineHeight: "1.3", fontWeight: "700" }],
        "body": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "label": ["12px", { lineHeight: "1", letterSpacing: "0.02em", fontWeight: "500" }],
        "small-text": ["13px", { lineHeight: "1.5", fontWeight: "400" }],

        // -------------------------------------------------------------
        // Customer_Typography sizes
        // -------------------------------------------------------------
        "display-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }]
      },
      boxShadow: {
        // Customer_App primary-button glow shadow (Requirement 18.17)
        "primary-glow": "0 4px 12px rgba(225, 29, 72, 0.2)",
        // Card / surface elevation used by the Login/Register cards
        "md3-card": "0 8px 24px rgba(0, 0, 0, 0.08)"
      }
    },
  },
  plugins: [],
}

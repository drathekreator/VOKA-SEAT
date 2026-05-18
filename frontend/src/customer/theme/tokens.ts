/**
 * Customer App — Material Design 3 design tokens.
 *
 * This module is the single source of truth for the Customer_MD3_Tokens color
 * set, Customer_Typography (Lexend headlines + Inter body/labels),
 * Customer_Border_Radius and Customer_Spacing_Scale. The same values are
 * mirrored in `frontend/tailwind.config.js` so utility classes
 * (e.g. `bg-primary`, `text-on-surface`, `font-headline-md`, `rounded-xl`,
 * `p-md`) resolve to these tokens at build time.
 *
 * Admin Dashboard styling is intentionally NOT migrated to this token set; it
 * continues to use the legacy Admin_Flat_Palette utility classes.
 *
 * Spec references:
 *   - Customer_MD3_Tokens (requirements.md glossary)
 *   - Customer_Typography (requirements.md glossary)
 *   - Customer_Border_Radius (requirements.md glossary)
 *   - Customer_Spacing_Scale (requirements.md glossary)
 *   - Requirement 18.2, 18.13, 18.14, 18.15, 18.16
 *   - design.md "Customer App Component" / "Customer App Component Architecture"
 */

// ---------------------------------------------------------------------------
// Color tokens — Customer_MD3_Tokens
// ---------------------------------------------------------------------------

export const Customer_MD3_Tokens = {
  // Primary palette
  primary: '#b80035',
  'primary-container': '#e11d48',
  'on-primary': '#ffffff',
  'on-primary-container': '#fffaf9',
  'primary-fixed': '#ffdada',
  'surface-tint': '#be0037',

  // Secondary palette (mint-green family — used for Customer App available seats)
  secondary: '#006c49',
  'secondary-container': '#6cf8bb',
  'on-secondary': '#ffffff',
  'on-secondary-container': '#00714d',
  'secondary-fixed': '#6ffbbe',

  // Tertiary palette (used for the "ready" order status pill)
  tertiary: '#006855',
  'tertiary-container': '#00836c',
  'on-tertiary': '#ffffff',
  'on-tertiary-container': '#eefff7',

  // Surface / background palette
  surface: '#fbf8fc',
  background: '#fbf8fc',
  'surface-bright': '#fbf8fc',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f6f2f7',
  'surface-container': '#f0edf1',
  'surface-container-high': '#eae7eb',
  'surface-container-highest': '#e4e1e6',
  'surface-variant': '#e4e1e6',

  // Text & outline
  'on-surface': '#1b1b1e',
  'on-surface-variant': '#5c3f40',
  outline: '#906f70',
  'outline-variant': '#e5bdbe',

  // Error
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
} as const;

export type CustomerMD3TokenName = keyof typeof Customer_MD3_Tokens;

// ---------------------------------------------------------------------------
// Typography — Customer_Typography
// Lexend for headlines, Inter for body and labels.
// Each entry mirrors Tailwind's [size, { lineHeight, fontWeight }] tuple.
// ---------------------------------------------------------------------------

export const Customer_Typography = {
  fontFamily: {
    headline: ['Lexend', 'sans-serif'] as const,
    display: ['Lexend', 'sans-serif'] as const,
    body: ['Inter', 'sans-serif'] as const,
    label: ['Inter', 'sans-serif'] as const,
  },

  // Headlines — Lexend
  'display-lg': {
    fontFamily: 'Lexend',
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: 600,
  },
  'headline-lg-mobile': {
    fontFamily: 'Lexend',
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: 600,
  },
  'headline-md': {
    fontFamily: 'Lexend',
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 600,
  },
  'headline-sm': {
    fontFamily: 'Lexend',
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: 500,
  },

  // Body & labels — Inter
  'body-md': {
    fontFamily: 'Inter',
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
  },
  'body-sm': {
    fontFamily: 'Inter',
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 400,
  },
  'label-md': {
    fontFamily: 'Inter',
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 600,
  },
  'label-sm': {
    fontFamily: 'Inter',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 500,
  },
} as const;

// ---------------------------------------------------------------------------
// Border radius — Customer_Border_Radius
// ---------------------------------------------------------------------------

export const Customer_Border_Radius = {
  DEFAULT: '0.25rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
} as const;

// ---------------------------------------------------------------------------
// Spacing scale — Customer_Spacing_Scale
// ---------------------------------------------------------------------------

export const Customer_Spacing_Scale = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  'margin-mobile': '16px',
  'margin-tablet': '24px',
} as const;

// ---------------------------------------------------------------------------
// Auxiliary tokens referenced by requirement 18.17 (primary button glow)
// ---------------------------------------------------------------------------

export const Customer_Box_Shadow = {
  'primary-glow': '0 4px 12px rgba(225, 29, 72, 0.2)',
  card: '0 8px 24px rgba(0, 0, 0, 0.08)',
} as const;

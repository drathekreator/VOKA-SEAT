---
name: Vibrant Pulse POS
colors:
  surface: '#fbf8fc'
  surface-dim: '#dcd9dd'
  surface-bright: '#fbf8fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f2f7'
  surface-container: '#f0edf1'
  surface-container-high: '#eae7eb'
  surface-container-highest: '#e4e1e6'
  on-surface: '#1b1b1e'
  on-surface-variant: '#5c3f40'
  inverse-surface: '#303033'
  inverse-on-surface: '#f3f0f4'
  outline: '#906f70'
  outline-variant: '#e5bdbe'
  surface-tint: '#be0037'
  primary: '#b80035'
  on-primary: '#ffffff'
  primary-container: '#e11d48'
  on-primary-container: '#fffaf9'
  inverse-primary: '#ffb3b6'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#006855'
  on-tertiary: '#ffffff'
  tertiary-container: '#00836c'
  on-tertiary-container: '#eefff7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b6'
  on-primary-fixed: '#40000c'
  on-primary-fixed-variant: '#920028'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#90f5d9'
  tertiary-fixed-dim: '#74d8bd'
  on-tertiary-fixed: '#002019'
  on-tertiary-fixed-variant: '#005142'
  background: '#fbf8fc'
  on-background: '#1b1b1e'
  surface-variant: '#e4e1e6'
typography:
  display-lg:
    fontFamily: Lexend
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Lexend
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Lexend
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-tablet: 24px
---

## Brand & Style
The brand personality is energetic, efficient, and welcoming. Designed for fast-paced coffeeshop environments, the UI balances high-energy accents with a clean, clinical foundation to ensure clarity during peak hours.

The design style is **Minimalist with Tactile Accents**. It utilizes heavy whitespace and a restricted color palette to reduce cognitive load for baristas and staff. To avoid looking sterile, the system uses generous corner radii and soft, ambient shadows that give the interface a "friendly-tech" feel. The emotional response should be one of confidence, speed, and modern professionalism.

## Colors
The palette is led by **Pure White** and **Vibrant Magenta**, creating a high-contrast environment that highlights actionable elements immediately.

- **Primary (Magenta Pink):** Used exclusively for primary actions, active states, and critical path buttons. It drives the energetic mood of the app.
- **Success (Soft Green):** Reserved for positive statuses, such as "Available" tables or "Paid" orders.
- **Text (Deep Charcoal):** A soft black used to ensure maximum legibility without the harshness of pure black, maintaining a premium feel.
- **Surface:** The background remains predominantly white to emphasize cleanliness and let the photography of coffee products stand out.

## Typography
This design system uses a dual-font approach to maximize both character and utility.

- **Lexend** is used for headlines and display prices. Its geometric, open nature feels modern and friendly, and its high readability is perfect for quick glances at order totals.
- **Inter** is used for all body copy, lists, and UI labels. It provides a neutral, systematic foundation that handles complex data (like item modifiers or customer notes) with extreme clarity.

Weights are used purposefully: Medium and Semi-bold for interactive elements and titles; Regular for descriptions and secondary metadata.

## Layout & Spacing
The layout follows a **fluid grid** model with a base unit of 4px to ensure a consistent rhythm.

- **Mobile:** Elements use a 16px side margin. Large touch targets are prioritized for one-handed operation.
- **Tablet:** When the app is used as a stationary POS, the layout shifts to a multi-pane view (Categories | Items | Current Cart) using a 24px margin.
- **Hierarchy:** Spacing is used to group related items (e.g., 8px between a title and its description) and separate distinct sections (e.g., 24px between product categories).

## Elevation & Depth
The system uses **Tonal Layers** combined with **Ambient Shadows** to create a sense of physical layering.

- **Level 0 (Base):** The main background color (#FAFAFA).
- **Level 1 (Cards):** Surfaces (#FFFFFF) with a very soft, diffused shadow (Y: 4, Blur: 12, Opacity: 4%) to separate product items from the background.
- **Level 2 (Active/Modals):** Elements that require immediate attention use a more pronounced shadow (Y: 8, Blur: 24, Opacity: 8%).
- **Primary Buttons:** Utilize a subtle magenta-tinted shadow to give them a "glowing" or "lifted" energetic appearance.

## Shapes
The shape language is defined by **large, friendly radii**. This removes the "sharpness" typical of enterprise software, making the app feel approachable.

- **Buttons & Inputs:** Use the standard `rounded-md` (0.5rem) for a balanced feel.
- **Product Cards & Modal Containers:** Use `rounded-lg` (1rem) or `rounded-xl` (1.5rem) to emphasize the soft, tactile style.
- **Status Chips:** Use fully rounded (pill-shaped) ends to distinguish them from interactive buttons.

## Components
- **Buttons:** Primary buttons are Solid Magenta with White text. Secondary buttons use a Magenta tint background (#FEE2E2) with Magenta text. All buttons have a minimum height of 48px for easy tapping.
- **Product Cards:** Feature a top-aligned image with 12px padding. The price is displayed in Lexend Bold in the bottom right corner.
- **Chips (Table Status):** "Available" tables use a Soft Green background with Deep Green text. "Occupied" tables use a light neutral grey.
- **Input Fields:** Large, 16px padded fields with a subtle 1px border (#F4F4F5). On focus, the border transitions to Magenta.
- **Cart List:** High-density list items with a "swipe-to-delete" gesture. Modifier text (e.g., "Oat Milk") appears in `body-sm` muted text.
- **Order Bar:** A persistent sticky footer on mobile that shows the "Total" and a "Charge" button, using Level 2 elevation to stay above the content.
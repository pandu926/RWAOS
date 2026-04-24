---
name: Corporate Contemporary
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#45464d'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#191c1e'
  on-tertiary-container: '#818486'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  space-xl: 48px
  space-2xl: 80px
---

## Brand & Style

This design system is built on a foundation of **Minimalism** blended with **Corporate Modern** sensibilities. The brand personality is professional, reliable, and highly organized, designed to evoke a sense of clarity and institutional trust. 

The aesthetic prioritizes a "content-first" approach, utilizing expansive whitespace (negative space) to reduce cognitive load. By stripping away unnecessary ornamentation, the system directs focus toward critical data and calls to action. The target audience includes enterprise users, financial analysts, and healthcare professionals who require high-density information presented with high-quality editorial precision.

## Colors

The palette is strictly curated to maintain a "Primary White" theme. 
- **Primary:** A deep Slate Blue-Black (#0F172A) used for typography and high-priority interactions to ensure AA/AAA accessibility.
- **Secondary:** A muted Steel Gray (#64748B) for supportive text and secondary icons.
- **Tertiary/Surface:** An ultra-light "Off-White" (#F8FAFC) used to distinguish between different content zones without introducing heavy borders.
- **Background:** Pure White (#FFFFFF) is the default canvas for all layouts.

Subtle gray accents are used exclusively for depth and structural grouping, ensuring the UI remains airy and contemporary.

## Typography

The design system utilizes **Inter** for its exceptional legibility and systematic, utilitarian feel. The hierarchy is established through significant weight changes and tight letter spacing on larger headings to maintain a modern, "tight" corporate look.

- **Headings:** Use Semibold and Bold weights with slight negative letter-spacing to create a distinctive, premium feel.
- **Body Text:** Standardized on 16px for optimal readability across devices. 
- **Labels:** Uppercase styles are used sparingly for small labels (like table headers or overlines) to provide visual variety without introducing new typefaces.

## Layout & Spacing

This design system employs a **Fixed Grid** model for desktop and a **Fluid Grid** for mobile devices. 
- **The 8px Rule:** All spacing and sizing must be increments of 8px to ensure a consistent rhythmic flow.
- **Desktop:** A 12-column grid centered in a 1280px container with 24px gutters.
- **Whitespace:** Use `space-xl` or `space-2xl` between major sections to emphasize the "clean" aesthetic. 
- **Padding:** Internal component padding should be generous to maintain the contemporary feel (e.g., 16px minimum for card interiors).

## Elevation & Depth

To maintain the primary white theme, depth is achieved through **Tonal Layers** and **Ambient Shadows** rather than heavy borders.

1.  **Low Elevation:** Use 1px borders in `#E2E8F0` for structural elements like table rows or input fields.
2.  **Mid Elevation:** Use a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.05)) for cards and dropdown menus.
3.  **High Elevation:** Reserved for modals and floating action buttons, using a more pronounced shadow (0px 10px 30px rgba(0, 0, 0, 0.08)).
4.  **Surface Tiers:** Use the Tertiary color (#F8FAFC) to create "background wells" for sidebars or secondary content areas, allowing the primary content to pop on the pure white background.

## Shapes

The design system adopts a **Soft** shape language. This ensures the interface feels approachable and modern without losing its professional, corporate edge.

- **Small Components:** Checkboxes and small buttons use a 0.25rem (4px) radius.
- **Large Components:** Cards, modals, and input fields use a 0.5rem (8px) radius.
- **Interactive Elements:** Active states should maintain the same corner radius to ensure stability during transitions.

## Components

- **Buttons:** Primary buttons use the Primary Slate color with white text. Secondary buttons use a transparent background with a light gray border. Ghost buttons are reserved for low-priority actions.
- **Input Fields:** Use a subtle `#E2E8F0` border and 16px horizontal padding. On focus, the border should darken to the Primary Slate color with a 2px stroke.
- **Cards:** Always pure white background. Depth is indicated by either a subtle border or the Low Elevation shadow, never both.
- **Chips/Tags:** Use the Tertiary color (#F8FAFC) as a background with Body-sm typography.
- **Lists:** Use horizontal separators in `#F1F5F9`. Ensure 12px vertical padding for list items to maintain the whitespace narrative.
- **Checkboxes & Radios:** Use the Primary color for the checked state to ensure high contrast and accessibility.
- **Data Tables:** Remove all vertical grid lines. Use only horizontal lines and generous 16px cell padding to emphasize the clean, modern layout.
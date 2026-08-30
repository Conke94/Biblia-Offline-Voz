/**
 * Semantic design tokens for the mobile app.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#2B2523',
    tint: '#8C5A46',

    // Core surfaces
    background: '#FDFBF7',
    foreground: '#2B2523',

    // Cards / elevated surfaces
    card: '#F4F0E6',
    cardForeground: '#2B2523',

    // Primary action color (buttons, links, active states)
    primary: '#8C5A46',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E8E1D3',
    secondaryForeground: '#3A312E',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E6E0D4',
    mutedForeground: '#756A65',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#6B705C',
    accentForeground: '#FFFFFF',

    // Destructive actions (delete, error states)
    destructive: '#B74F4F',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DED8CE',
    input: '#DED8CE',
  },
  dark: {
    text: '#FDFBF7',
    tint: '#D4A373',

    background: '#1F1A18',
    foreground: '#FDFBF7',

    card: '#2D2623',
    cardForeground: '#FDFBF7',

    primary: '#D4A373',
    primaryForeground: '#1F1A18',

    secondary: '#3D3430',
    secondaryForeground: '#EAE1DB',

    muted: '#3D3430',
    mutedForeground: '#A39994',

    accent: '#8A9279',
    accentForeground: '#1F1A18',

    destructive: '#D66B6B',
    destructiveForeground: '#1F1A18',

    border: '#4A403C',
    input: '#4A403C',
  },
  radius: 16,
};

export default colors;

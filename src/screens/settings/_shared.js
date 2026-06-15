// Tiny shared helpers used by multiple SettingsScreen section slices.
// Kept tiny on purpose: only things that show up in 2+ files.
import React from 'react';

// Convert a #RRGGBB hex color to #RRGGBBAA by appending an alpha byte (0..1).
// Used everywhere we need a translucent surface tint.
function hexAlpha(hex, a) {
  if (!hex) return hex;
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

// Book icon names (Ionicons) shown in the book picker.
const bookIcons = ['wallet', 'cash', 'card', 'business', 'school', 'heart', 'airplane', 'restaurant'];

// Book color palette shown in the book picker.
const bookColors = [
  '#111827', '#7C5CFF', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#64748B',
];

export { hexAlpha, bookIcons, bookColors };

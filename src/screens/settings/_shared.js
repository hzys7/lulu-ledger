// Tiny shared helpers used by multiple SettingsScreen section slices.
// Kept tiny on purpose: only things that show up in 2+ files.
import React from 'react';

// Convert a #RRGGBB hex color to #RRGGBBAA by appending an alpha byte (0..1).
// Used everywhere we need a translucent surface tint.
function hexAlpha(hex, a) {
  if (!hex) return hex;
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

export { hexAlpha };
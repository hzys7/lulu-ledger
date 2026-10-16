// Tiny shared helpers used by multiple SettingsScreen section slices.
// Kept tiny on purpose: only things that show up in 2+ files.

// Book icon names (Ionicons) shown in the book picker.
const bookIcons = ['wallet', 'cash', 'card', 'business', 'school', 'heart', 'airplane', 'restaurant'];

// Book color palette shown in the book picker.（与主题新拟物色板一致，避免高饱和/近黑）
const bookColors = [
  '#6D5DFC', '#4ECDC4', '#5B8DEF', '#2E9E6B', '#C99A2E',
  '#E5675F', '#E08BAE', '#7C8593',
];

export { bookIcons, bookColors };

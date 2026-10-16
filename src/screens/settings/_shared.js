// Tiny shared helpers used by multiple SettingsScreen section slices.
// Kept tiny on purpose: only things that show up in 2+ files.

// Book icon names (Ionicons) shown in the book picker.
const bookIcons = ['wallet', 'cash', 'card', 'business', 'school', 'heart', 'airplane', 'restaurant'];

// Book color palette shown in the book picker.（与主题 Stripe 色板一致）
const bookColors = [
  '#635BFF', '#0EA5C4', '#3B82F6', '#1EA672', '#C77700',
  '#DF1B41', '#A78BFA', '#697386',
];

export { bookIcons, bookColors };

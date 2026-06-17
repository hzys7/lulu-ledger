// Shared StyleSheet for SettingsScreen and its section slices.
import { StyleSheet } from 'react-native';
import { spacing, borderRadius, fontSize, fontWeight } from '../../theme';

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.base, paddingBottom: 40 },

  headerRow: { paddingBottom: spacing.lg },

  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
    marginBottom: spacing.sm,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { flex: 1, marginLeft: spacing.md },
  listTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
  listSub: { fontSize: fontSize.sm, marginTop: 2, letterSpacing: -0.1 },
  rightMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rightText: { fontSize: fontSize.md, letterSpacing: -0.2 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },

  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },

  inputGroup: { marginBottom: spacing.base },
  inputLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.sm, letterSpacing: -0.1 },
  textInput: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
  },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconOption: {
    width: 48, height: 48, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorOption: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  typePill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  deleteBtn: {
    width: 52, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  currency: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginRight: spacing.sm, letterSpacing: -0.3 },
  amountInput: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    paddingVertical: spacing.md,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  currencyList: {
    margin: spacing.base,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  currencyLabel: { fontSize: fontSize.md, letterSpacing: -0.2 },
});
export { styles };

// BookManagerSection: lists all books with an active indicator, and a "+"
// action to add a new one. The edit/confirm/delete flow lives in the
// parent SettingsScreen which also owns the BookModal.
//
// The parent passes:
//   - books          : array of {id, name, icon, color}
//   - currentBookId  : id of the active book
//   - onSwitch       : (id) => void
//   - onEdit         : (book) => void
//   - onAdd          : () => void
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { hexAlpha } from './_shared';
import { Section } from './Section';
import { styles } from './styles';

function BookManagerSection({ books, currentBookId, onSwitch, onEdit, onAdd }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="账本管理" rightAction={
      <TouchableOpacity onPress={onAdd} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="add" size={22} color={tc.text} />
      </TouchableOpacity>
    }>
      {books.map((book) => {
        const active = book.id === currentBookId;
        return (
          <TouchableOpacity
            key={book.id}
            style={[
              styles.listItem,
              {
                backgroundColor: tc.surface,
                borderColor: active ? tc.primary : tc.border,
                borderWidth: active ? 1 : StyleSheet.hairlineWidth,
              },
            ]}
            onPress={() => onSwitch(book.id)}
            onLongPress={() => onEdit(book)}
            activeOpacity={0.7}
          >
            <View style={[styles.listIcon, { backgroundColor: hexAlpha(book.color, 0.12) }]}>
              <Ionicons name={book.icon} size={18} color={book.color} />
            </View>
            <View style={styles.listContent}>
              <Text style={[styles.listTitle, { color: tc.text }]}>
                {book.name}
              </Text>
              <Text style={[styles.listSub, { color: tc.textMuted }]}>
                {active ? '当前使用' : '点击切换'}
              </Text>
            </View>
            {active ? <View style={[styles.activeDot, { backgroundColor: tc.primary }]} /> : null}
          </TouchableOpacity>
        );
      })}
    </Section>
  );
}

export default BookManagerSection;
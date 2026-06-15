// CurrencyModal: a list of currencies. Tapping one calls onSelect(code)
// and closes. No form state, fully stateless.
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { getCurrencyList } from '../../utils/currency';
import { styles } from './styles';

function CurrencyModal({ visible, onClose, onSelect }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[
            styles.currencyList,
            { backgroundColor: tc.surface, borderColor: tc.border },
          ]}
        >
          {getCurrencyList().map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[styles.currencyItem, { borderBottomColor: tc.border }]}
              onPress={() => onSelect(c.code)}
            >
              <Text style={[styles.currencyLabel, { color: tc.text }]}>
                {c.code} · {c.name}
              </Text>
              {settings.currency === c.code ? (
                <Text style={{ color: tc.primary, fontSize: 16 }}>✓</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default CurrencyModal;
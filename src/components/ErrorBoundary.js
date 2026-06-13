// 顶层错误边界 - 捕获任何子组件 render 错误
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 把堆栈打到 Expo Go 的日志里
    console.error('[ErrorBoundary]', error, info && info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset && this.props.onReset();
  };

  clearAndReload = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const keys = await AsyncStorage.getAllKeys();
      if (keys && keys.length) await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.warn('clear storage failed', e);
    }
    this.reset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    const stack = (e && (e.stack || e.message)) || String(e);
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.subtitle}>应用在初始化过程中遇到问题，请尝试恢复。</Text>
        </View>
        <ScrollView style={styles.logBox} contentContainerStyle={styles.logContent}>
          <Text selectable style={styles.logText}>{stack}</Text>
        </ScrollView>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={this.reset}>
            <Text style={styles.btnTextPrimary}>重试</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={this.clearAndReload}>
            <Text style={styles.btnTextDanger}>清除本地数据并重启</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B12' },
  header: { padding: 20, paddingTop: 24 },
  title: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 13, marginTop: 6 },
  logBox: { flex: 1, margin: 16, backgroundColor: '#15151D', borderRadius: 12, padding: 12 },
  logContent: { paddingBottom: 24 },
  logText: { color: '#FCA5A5', fontSize: 12, fontFamily: 'Courier', lineHeight: 18 },
  actions: { padding: 16, gap: 10 },
  btn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#F8FAFC' },
  btnTextPrimary: { color: '#0B0B12', fontSize: 15, fontWeight: '600' },
  btnDanger: { backgroundColor: '#1F2937' },
  btnTextDanger: { color: '#FCA5A5', fontSize: 14, fontWeight: '600' },
});

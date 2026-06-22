// 小璐记账 · 入口
// 使用动态 import() 延迟加载 App 模块，以便捕获模块级初始化异常
// （同步 import 抛出的异常无法被 ErrorBoundary 捕获）。

let RootComponent = null;
let BootError = null;

async function bootstrap() {
  try {
    const { default: App } = await import('./App');
    RootComponent = App;
  } catch (e) {
    console.error('[Bootstrap] Fatal error during module load:', e);
    BootError = e?.message || String(e);
  }
}

// 立即启动引导（不阻塞注册）
bootstrap();

// 注册根组件。如果 App 尚未加载完成或加载失败，显示兜底 UI。
import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

function BootGate() {
  const [ready, setReady] = React.useState(!!RootComponent);
  const [error, setError] = React.useState(BootError);

  React.useEffect(() => {
    if (RootComponent) {
      setReady(true);
      return;
    }
    const timer = setInterval(() => {
      if (RootComponent) {
        setReady(true);
        clearInterval(timer);
      }
      if (BootError) {
        setError(BootError);
        clearInterval(timer);
      }
    }, 100);
    const timeout = setTimeout(() => {
      clearInterval(timer);
      if (!RootComponent) setError('应用加载超时');
    }, 10000);
    return () => { clearInterval(timer); clearTimeout(timeout); };
  }, []);

  if (error) {
    return (
      <View style={styles.root}>
        <Text style={styles.emoji}>💥</Text>
        <Text style={styles.title}>启动失败</Text>
        <Text style={styles.detail}>{error}</Text>
        <Text style={styles.hint}>
          请尝试重启应用。如果问题持续，请前往设置 → 清除本地数据。
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.root}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.title}>加载中...</Text>
      </View>
    );
  }

  return <RootComponent />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  detail: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  hint: { color: '#64748B', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});

registerRootComponent(BootGate);
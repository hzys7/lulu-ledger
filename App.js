// 璐璐记账 · 入口
import React from 'react';
import ErrorBoundary from './src/components/ErrorBoundary';
import UpdatePrompt, { triggerUpdateCheck } from './src/components/UpdatePrompt';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FinanceProvider, useFinance } from './src/context/FinanceContext';
import HomeScreen from './src/screens/HomeScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import NetWorthScreen from './src/screens/NetWorthScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import AiMonthlyReportScreen from './src/screens/AiMonthlyReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { getThemeColors, fontSize, fontWeight, spacing } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          // 中间 "AddTab" 用自定义外凸的圆形按钮
          if (route.name === 'AddTab') {
            return (
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#000000',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
                elevation: 3,
              }}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </View>
            );
          }
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Statistics: focused ? 'pie-chart' : 'pie-chart-outline',
            NetWorth: focused ? 'wallet' : 'wallet-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size || 22} color={color} />;
        },
        tabBarActiveTintColor: tc.text,
        tabBarInactiveTintColor: tc.textSubtle,
        tabBarStyle: {
          backgroundColor: tc.surface,
          borderTopColor: tc.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          letterSpacing: -0.1,
        },
        tabBarItemStyle: { paddingTop: 2 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '首页' }}
        listeners={() => ({
          tabPress: () => {
            // 切到首页时检查更新（throttled 30 分钟）
            try { triggerUpdateCheck(true); } catch (e) { /* swallow: never block tab press */ }
          },
        })}
      />
      <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ tabBarLabel: '统计' }} />
      <Tab.Screen
        name="AddTab"
        component={AddTabScreen}
        options={{ tabBarLabel: '记一笔' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // 拦截点击，弹到 Stack 层 AddTransaction
            e.preventDefault();
            navigation.navigate('AddTransaction', { type: 'expense' });
          },
        })}
      />
      <Tab.Screen name="NetWorth" component={NetWorthScreen} options={{ tabBarLabel: '净资产' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: '设置' }} />
    </Tab.Navigator>
  );
}

// 一个占位组件（永远不会被渲染，点击被 listeners 拦截跳转了）
function AddTabScreen() {
  return null;
}

function RootNavigator() {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: Platform.OS !== 'web',
        cardStyle: { backgroundColor: tc.background },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          headerShown: true,
          headerTitle: '预算管理',
          headerTitleStyle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: tc.text, letterSpacing: -0.3 },
          headerStyle: { backgroundColor: tc.background, elevation: 0, shadowOpacity: 0 },
          headerTintColor: tc.text,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          headerShown: true,
          headerTitle: '记一笔',
          headerTitleStyle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: tc.text, letterSpacing: -0.3 },
          headerStyle: { backgroundColor: tc.background, elevation: 0, shadowOpacity: 0 },
          headerTintColor: tc.text,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="AiMonthlyReport"
        component={AiMonthlyReportScreen}
        options={{
          headerShown: true,
          headerTitle: 'AI 月度复盘',
          headerTitleStyle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: tc.text, letterSpacing: -0.3 },
          headerStyle: { backgroundColor: tc.background, elevation: 0, shadowOpacity: 0 },
          headerTintColor: tc.text,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

function ThemedApp() {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const navTheme = settings.theme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: tc.background,
          card: tc.surface,
          text: tc.text,
          border: tc.divider,
          primary: tc.text,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: tc.background,
          card: tc.surface,
          text: tc.text,
          border: tc.divider,
          primary: tc.text,
        },
      };
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} backgroundColor={tc.background} />
      <RootNavigator />
      <UpdatePrompt />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary><FinanceProvider><ThemedApp /></FinanceProvider></ErrorBoundary>
    </SafeAreaProvider>
  );
}

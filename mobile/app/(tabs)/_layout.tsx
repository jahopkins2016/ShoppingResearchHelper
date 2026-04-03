import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: 'The Gallery',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 20,
          color: '#191c1d',
        },
        headerStyle: {
          backgroundColor: 'rgba(248,249,250,0.8)',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: 'rgba(248,249,250,0.8)',
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          position: 'absolute',
          shadowColor: 'rgba(0,74,198,0.04)',
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        },
        tabBarActiveBackgroundColor: '#2563eb',
        tabBarItemStyle: {
          borderRadius: 9999,
          marginHorizontal: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Collections' }} />
      <Tabs.Screen name="shared" options={{ title: 'Shared' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

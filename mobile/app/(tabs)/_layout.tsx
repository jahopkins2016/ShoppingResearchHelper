import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563EB' }}>
      <Tabs.Screen name="index" options={{ title: 'Collections' }} />
      <Tabs.Screen name="shared" options={{ title: 'Shared' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

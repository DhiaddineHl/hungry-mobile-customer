import { CustomTabBar } from '@/components/navigation/custom-tab-bar';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

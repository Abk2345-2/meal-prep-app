import { Tabs } from 'expo-router';
import { Text } from 'react-native';

// Bottom-tab navigation, iOS-first. Emoji icons keep it dependency-free.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarStyle: { height: 84, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Cook', tabBarIcon: ({ color }) => icon('🍽️', color) }}
      />
      <Tabs.Screen
        name="pantry"
        options={{ title: 'Pantry', tabBarIcon: ({ color }) => icon('🥦', color) }}
      />
      <Tabs.Screen
        name="track"
        options={{ title: 'Track', tabBarIcon: ({ color }) => icon('📊', color) }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: ({ color }) => icon('🔥', color) }}
      />
    </Tabs>
  );
}

function icon(emoji: string, color: string) {
  return <Text style={{ fontSize: 22, color }}>{emoji}</Text>;
}

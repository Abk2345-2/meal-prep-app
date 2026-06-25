import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth-context';

// This screen handles the deep link pantrytoplate://auth/callback?token=...
// on Android — Expo Router renders it when Chrome Custom Tabs redirects back.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token: string; id: string; name: string; email: string; avatar?: string }>();
  const { applyToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const { token, id, name, email, avatar } = params;
    if (token && id && name && email) {
      applyToken(token, { id, name, email, avatar: avatar ?? '' }).then(() => {
        router.replace('/(tabs)');
      });
    } else {
      router.replace('/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      <ActivityIndicator size="large" color="#16a34a" />
      <Text style={{ marginTop: 16, fontSize: 14, color: '#64748b' }}>Signing you in…</Text>
    </View>
  );
}

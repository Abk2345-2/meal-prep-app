import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth-context';

const brand = '#16a34a';

export default function LoginScreen() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    try {
      await login();
    } finally {
      setLoading(false);
    }
  }, [login]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 32 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 64 }}>🍽️</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a' }}>PantryToPlate</Text>
          <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center' }}>
            Turn your groceries into great meals
          </Text>
        </View>

        {/* Feature list */}
        <View style={{ gap: 12, width: '100%' }}>
          {[
            { emoji: '🥦', text: 'Track your pantry & reduce food waste' },
            { emoji: '🍳', text: 'Get recipes matched to what you have' },
            { emoji: '📊', text: 'Log nutrition and hit your daily goals' },
            { emoji: '🔥', text: 'Build streaks and earn rewards' },
          ].map(({ emoji, text }) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
              <Text style={{ fontSize: 14, color: '#475569', flex: 1 }}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Sign in button */}
        <Pressable
          onPress={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: loading ? '#dcfce7' : brand,
            borderRadius: 16,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {loading ? (
            <ActivityIndicator color={brand} />
          ) : (
            <>
              <Text style={{ fontSize: 20 }}>G</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

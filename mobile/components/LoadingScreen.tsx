import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function SkeletonBox({ width, height = 16, radius = 8, marginBottom = 0 }: {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
  marginBottom?: number;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#e2e8f0',
        marginBottom,
        opacity,
      }}
    />
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    }}>
      {children}
    </View>
  );
}

// Cook tab skeleton
export function CookScreenSkeleton() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 16 }}>
        {/* Header */}
        <Card>
          <SkeletonBox width="50%" height={12} marginBottom={10} />
          <SkeletonBox width="100%" height={36} radius={12} />
        </Card>
        {/* Recipe chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[60, 80, 70, 65].map((w, i) => (
            <SkeletonBox key={i} width={w} height={32} radius={999} />
          ))}
        </View>
        {/* Recipe cards */}
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonBox width={72} height={72} radius={12} />
              <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
                <SkeletonBox width="80%" height={14} />
                <SkeletonBox width="50%" height={11} />
                <SkeletonBox width="40%" height={11} />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </SafeAreaView>
  );
}

// Pantry tab skeleton
export function PantryScreenSkeleton() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonBox width="45%" height={22} />
        <SkeletonBox width={50} height={16} />
      </View>
      {/* Tab chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {[55, 75, 70, 75].map((w, i) => (
          <SkeletonBox key={i} width={w} height={32} radius={999} />
        ))}
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        {[1, 2].map((group) => (
          <Card key={group}>
            <SkeletonBox width="30%" height={12} marginBottom={12} />
            {[1, 2, 3].map((row) => (
              <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: row < 3 ? 12 : 0 }}>
                <View style={{ gap: 6 }}>
                  <SkeletonBox width={120} height={14} />
                  <SkeletonBox width={80} height={11} />
                </View>
                <SkeletonBox width={20} height={20} radius={10} />
              </View>
            ))}
          </Card>
        ))}
      </View>
    </SafeAreaView>
  );
}

// Track tab skeleton
export function TrackScreenSkeleton() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 16 }}>
        <SkeletonBox width="40%" height={22} marginBottom={16} />
        <Card>
          <SkeletonBox width="60%" height={14} marginBottom={12} />
          <SkeletonBox width="100%" height={12} radius={6} marginBottom={8} />
          <SkeletonBox width="100%" height={12} radius={6} marginBottom={8} />
          <SkeletonBox width="100%" height={12} radius={6} />
        </Card>
        <Card>
          <SkeletonBox width="50%" height={14} marginBottom={12} />
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <SkeletonBox width={80} height={12} />
              <SkeletonBox width={60} height={12} />
            </View>
          ))}
        </Card>
      </View>
    </SafeAreaView>
  );
}

// You tab skeleton
export function YouScreenSkeleton() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 16 }}>
        <SkeletonBox width="35%" height={22} marginBottom={16} />
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                <SkeletonBox width={48} height={48} radius={24} />
                <SkeletonBox width={50} height={11} />
              </View>
            ))}
          </View>
        </Card>
        <Card>
          <SkeletonBox width="40%" height={14} marginBottom={12} />
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <SkeletonBox width={100} height={12} />
              <SkeletonBox width={40} height={12} />
            </View>
          ))}
        </Card>
      </View>
    </SafeAreaView>
  );
}

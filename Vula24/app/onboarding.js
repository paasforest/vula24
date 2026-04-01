import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Always Available',
    body: 'Find a verified locksmith near you, 24 hours a day',
    icon: 'construct',
  },
  {
    title: 'Know The Price',
    body: 'See the exact price before you confirm. No surprises.',
    icon: 'pricetag',
  },
  {
    title: 'Track In Real Time',
    body: 'Watch your locksmith travel to you live on the map',
    icon: 'location',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);

  const onScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    setIndex(i);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.skip} onPress={() => router.replace('/login')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <Ionicons name={s.icon} size={80} color={COLORS.accent} />
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      {index < SLIDES.length - 1 ? (
        <View style={styles.footer}>
          <GoldButton title="Next" onPress={goNext} />
        </View>
      ) : (
        <View style={styles.footer}>
          <GoldButton title="Get Started" onPress={() => router.push('/register')} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  skip: { alignSelf: 'flex-end', padding: 16 },
  skipText: { color: COLORS.textMuted, fontSize: 16 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 32,
    textAlign: 'center',
  },
  body: {
    color: COLORS.textMuted,
    fontSize: 17,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 22,
  },
  footer: { padding: 24, paddingBottom: 32 },
});

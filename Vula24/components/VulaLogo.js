import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export function VulaLogo({ iconSize = 72, showText = true }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="key" size={iconSize} color={COLORS.accent} />
      {showText ? (
        <Text style={[styles.brand, { fontSize: iconSize * 0.42 }]}>Vula24</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  brand: {
    color: COLORS.accent,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
  },
});

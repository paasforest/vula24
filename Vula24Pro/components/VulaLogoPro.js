import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export function VulaLogoPro({ iconSize = 72 }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="key" size={iconSize} color={COLORS.accent} />
      <Text style={styles.brand}>Vula24 Pro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  brand: {
    color: COLORS.accent,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0.5,
  },
});

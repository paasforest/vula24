import { View, Image } from 'react-native';

export function VulaLogo({ size = 120 }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      overflow: 'hidden',
      backgroundColor: '#111111',
    }}>
      <Image
        source={require('../assets/icon.png')}
        style={{ width: size, height: size, resizeMode: 'cover' }}
      />
    </View>
  );
}

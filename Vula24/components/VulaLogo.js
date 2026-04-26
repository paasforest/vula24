import { Image } from 'react-native';
export function VulaLogo({ size = 120 }) {
  return (
    <Image
      source={require('../assets/icon.png')}
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}

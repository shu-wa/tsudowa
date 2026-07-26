import { Image } from 'expo-image';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type Props = {
  uri?: string;
  initials: string;
  color: string;
  size: number;
  radius?: number;
  style?: ViewStyle;
};

export function UserAvatar({ uri, initials, color, size, radius = Math.round(size * 0.34), style }: Props) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: radius, backgroundColor: color }, style]}>
      {uri
        ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        : <Text style={[styles.initials, { fontSize: Math.max(10, Math.round(size * 0.25)) }]}>{initials}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: '#FFFFFF', fontWeight: '900' },
});

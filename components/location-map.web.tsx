import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { LocationMapProps } from './location-map';

export function LocationMap({ latitude, longitude }: LocationMapProps) {
  return (
    <View style={styles.map}>
      <View style={styles.roadOne} /><View style={styles.roadTwo} />
      <View style={styles.pin}><Ionicons name="location" size={28} color={palette.surface} /></View>
      <Text style={styles.title}>地図プレビュー</Text>
      <Text style={styles.text}>正確な地図とピン移動はExpo Goで利用できます</Text>
      <Text style={styles.coords}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 350, backgroundColor: '#DDE8DE', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  roadOne: { position: 'absolute', width: 520, height: 26, backgroundColor: '#F6F3E9', transform: [{ rotate: '-18deg' }] },
  roadTwo: { position: 'absolute', width: 480, height: 20, backgroundColor: '#F6F3E9', transform: [{ rotate: '58deg' }] },
  pin: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  text: { color: palette.muted, fontSize: 13, marginTop: 5 },
  coords: { color: palette.primary, fontSize: 13, fontWeight: '700', marginTop: 7 },
});

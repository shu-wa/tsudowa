import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LocationMapProps } from './location-map';

export function LocationMap({ latitude, longitude }: LocationMapProps) {
  const longitudeDelta = 0.012;
  const latitudeDelta = 0.008;
  const source = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - longitudeDelta}%2C${latitude - latitudeDelta}%2C${longitude + longitudeDelta}%2C${latitude + latitudeDelta}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  return (
    <View style={styles.map}>
      {createElement('iframe', {
        title: '選択したイベント場所の地図',
        src: source,
        loading: 'lazy',
        style: webMapStyle,
      })}
      <View style={styles.note}><Ionicons name="location" size={15} color={palette.primary} /><Text style={styles.text}>検索または現在地から位置を変更できます</Text><Text style={styles.coords}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text></View>
    </View>
  );
}

const webMapStyle = { width: '100%', height: 304, border: 0 };

const styles = StyleSheet.create({
  map: { height: 350, backgroundColor: '#DDE8DE', overflow: 'hidden' },
  note: { height: 46, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 7 },
  text: { flex: 1, color: palette.muted, fontSize: 11 },
  coords: { color: palette.primary, fontSize: 11, fontWeight: '700' },
});

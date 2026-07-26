import { LocationMap } from '@/components/location-map';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TOKYO = { latitude: 35.6812, longitude: 139.7671 };

const addressLabel = (address?: Location.LocationGeocodedAddress) => {
  if (!address) return '';
  return [address.region, address.city, address.district, address.street, address.streetNumber]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join('');
};

export default function EditLocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, updateEventLocation } = useEvents();
  const event = findEvent(id);
  const [query, setQuery] = useState(event?.address || event?.location || '');
  const [name, setName] = useState(event?.location || '');
  const [address, setAddress] = useState(event?.address || '');
  const [latitude, setLatitude] = useState(event?.latitude ?? TOKYO.latitude);
  const [longitude, setLongitude] = useState(event?.longitude ?? TOKYO.longitude);
  const [loading, setLoading] = useState(false);

  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;

  const reverse = async (nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude); setLongitude(nextLongitude);
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: nextLatitude, longitude: nextLongitude });
      const nextAddress = addressLabel(result[0]);
      if (nextAddress) { setAddress(nextAddress); setQuery(nextAddress); }
      if (result[0]?.name) setName(result[0].name);
    } catch { /* ピンの移動自体は保存できる */ }
  };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await Location.geocodeAsync(query.trim());
      if (!result[0]) return Alert.alert('場所が見つかりません', '施設名や住所を変えて検索してください。');
      setName(query.trim()); setAddress(query.trim());
      await reverse(result[0].latitude, result[0].longitude);
    } catch {
      Alert.alert('場所を検索できませんでした', '通信状態を確認するか、地図のピンを動かしてください。');
    } finally { setLoading(false); }
  };

  const useCurrentLocation = async () => {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return Alert.alert('位置情報の許可が必要です', '端末の設定からTSUDOWAの位置情報を許可してください。');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await reverse(current.coords.latitude, current.coords.longitude);
    } catch { Alert.alert('現在地を取得できませんでした'); } finally { setLoading(false); }
  };

  const save = () => {
    const finalName = name.trim() || query.trim() || '設定した場所';
    updateEventLocation(id, { location: finalName, address: address.trim() || query.trim() || finalName, latitude, longitude });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.searchArea}>
          <View style={styles.searchBox}><Ionicons name="search" size={19} color={palette.muted} /><TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="施設名・駅名・住所で検索" placeholderTextColor="#9AA39E" returnKeyType="search" onSubmitEditing={search} /><TouchableOpacity style={styles.searchButton} onPress={search}>{loading ? <ActivityIndicator size="small" color={palette.surface} /> : <Text style={styles.searchButtonText}>検索</Text>}</TouchableOpacity></View>
          <TouchableOpacity style={styles.current} onPress={useCurrentLocation}><Ionicons name="navigate" size={16} color={palette.primary} /><Text style={styles.currentText}>現在地へ移動</Text></TouchableOpacity>
        </View>
        <View style={styles.mapWrap}><LocationMap latitude={latitude} longitude={longitude} onSelect={reverse} /></View>
        <View style={styles.placeCard}>
          <View style={styles.placeIcon}><Ionicons name="location" size={22} color={palette.accent} /></View>
          <View style={styles.placeCopy}><TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="場所の表示名" placeholderTextColor="#9AA39E" /><Text style={styles.address} numberOfLines={2}>{address || '地図をタップして場所を設定'}</Text></View>
        </View>
        <View style={styles.bottom}><TouchableOpacity style={styles.save} onPress={save}><Text style={styles.saveText}>この場所に設定</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchArea: { padding: 14, backgroundColor: palette.surface, zIndex: 2 }, searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: palette.canvas, paddingLeft: 13 }, searchInput: { flex: 1, color: palette.ink, fontSize: 13, paddingHorizontal: 10 }, searchButton: { width: 62, height: 42, marginRight: 4, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, searchButtonText: { color: palette.surface, fontSize: 12, fontWeight: '900' },
  current: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', paddingTop: 10 }, currentText: { color: palette.primary, fontSize: 13, fontWeight: '800', marginLeft: 5 }, mapWrap: { flex: 1, minHeight: 280 },
  placeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, padding: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line }, placeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.accentSoft, alignItems: 'center', justifyContent: 'center' }, placeCopy: { flex: 1, marginLeft: 12 }, nameInput: { color: palette.ink, fontSize: 15, fontWeight: '900', paddingVertical: 2 }, address: { color: palette.muted, fontSize: 13, lineHeight: 15, marginTop: 2 },
  bottom: { padding: 14, backgroundColor: palette.surface }, save: { minHeight: 54, borderRadius: 17, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { color: palette.surface, fontSize: 14, fontWeight: '900' },
});

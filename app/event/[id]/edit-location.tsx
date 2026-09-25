import { LocationMap } from '@/components/location-map';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { isEventArchived } from '@/lib/event-display';
import { isEventManager } from '@/lib/event-permissions';
import { EventItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  const { findEvent } = useEvents();
  const event = findEvent(id);
  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;
  return <LocationForm key={event.id} event={event} />;
}

function LocationForm({ event }: { event: EventItem }) {
  const { updateEventLocation, profile } = useEvents();
  const { user } = useAuth();
  const canEdit = isEventManager(event, user?.id, profile.name) && !isEventArchived(event);
  const [query, setQuery] = useState(event.address || event.location || '');
  const [name, setName] = useState(event.location || '');
  const [address, setAddress] = useState(event.address || '');
  // Tokyo is only the map viewport, not an implicit saved event location.
  const [latitude, setLatitude] = useState(event.latitude);
  const [longitude, setLongitude] = useState(event.longitude);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const lookupVersion = useRef(0);
  useEffect(() => () => { lookupVersion.current += 1; }, []);

  const invalidateLookup = () => {
    lookupVersion.current += 1;
    setLoading(false);
  };

  const resolvePosition = async (version: number, nextLatitude: number, nextLongitude: number, label = '') => {
    if (version !== lookupVersion.current) return;
    setLatitude(nextLatitude); setLongitude(nextLongitude);
    // Never pair a newly selected pin with an address from the previous pin.
    setName(label); setAddress(label); setQuery(label);
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: nextLatitude, longitude: nextLongitude });
      if (version !== lookupVersion.current) return;
      const nextAddress = addressLabel(result[0]);
      if (nextAddress) { setAddress(nextAddress); setQuery(nextAddress); }
      if (result[0]?.name) setName(result[0].name);
    } catch { /* ピンの移動自体は保存できる */ }
  };

  const reverse = async (nextLatitude: number, nextLongitude: number) => {
    if (!canEdit || savingRef.current) return;
    const version = ++lookupVersion.current;
    setLoading(true);
    try {
      await resolvePosition(version, nextLatitude, nextLongitude);
    } finally {
      if (version === lookupVersion.current) setLoading(false);
    }
  };

  const search = async () => {
    if (!canEdit || savingRef.current || !query.trim()) return;
    const version = ++lookupVersion.current;
    const searchText = query.trim();
    setLoading(true);
    try {
      // Android's geocoder requires foreground permission, even for a query.
      if (Platform.OS === 'android') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (version !== lookupVersion.current) return;
        if (!permission.granted) return Alert.alert('位置情報の許可が必要です', '検索するには位置情報を許可してください。場所の表示名は手入力でも設定できます。');
      }
      const result = await Location.geocodeAsync(searchText);
      if (version !== lookupVersion.current) return;
      if (!result[0]) return Alert.alert('場所が見つかりません', '施設名や住所を変えて検索してください。');
      await resolvePosition(version, result[0].latitude, result[0].longitude, searchText);
    } catch {
      if (version === lookupVersion.current) Alert.alert('場所を検索できませんでした', '通信状態を確認するか、地図のピンを動かしてください。');
    } finally { if (version === lookupVersion.current) setLoading(false); }
  };

  const useCurrentLocation = async () => {
    if (!canEdit || savingRef.current) return;
    const version = ++lookupVersion.current;
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (version !== lookupVersion.current) return;
      if (!permission.granted) return Alert.alert('位置情報の許可が必要です', '端末の設定からTSUDOWAの位置情報を許可してください。');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (version !== lookupVersion.current) return;
      await resolvePosition(version, current.coords.latitude, current.coords.longitude);
    } catch {
      if (version === lookupVersion.current) Alert.alert('現在地を取得できませんでした');
    } finally { if (version === lookupVersion.current) setLoading(false); }
  };

  const save = async () => {
    if (!canEdit || savingRef.current || loading) return;
    invalidateLookup();
    savingRef.current = true;
    setSaving(true);
    const finalName = name.trim() || query.trim() || '設定した場所';
    try {
      const error = await updateEventLocation(event.id, { location: finalName, address: address.trim() || query.trim(), latitude, longitude });
      if (error) return Alert.alert('保存できませんでした', error);
      router.back();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.searchArea}>
          <View style={styles.searchBox}><Ionicons name="search" size={19} color={palette.muted} /><TextInput style={styles.searchInput} value={query} editable={canEdit && !saving} onChangeText={(value) => { invalidateLookup(); setQuery(value); }} placeholder="施設名・駅名・住所で検索" placeholderTextColor="#9AA39E" returnKeyType="search" onSubmitEditing={search} /><TouchableOpacity disabled={!canEdit || saving || loading} style={styles.searchButton} onPress={search}>{loading ? <ActivityIndicator size="small" color={palette.surface} /> : <Text style={styles.searchButtonText}>検索</Text>}</TouchableOpacity></View>
          <TouchableOpacity disabled={!canEdit || saving || loading} style={styles.current} onPress={useCurrentLocation}><Ionicons name="navigate" size={16} color={palette.primary} /><Text style={styles.currentText}>現在地へ移動</Text></TouchableOpacity>
        </View>
        <View style={styles.mapWrap} pointerEvents={!canEdit || saving ? 'none' : 'auto'}><LocationMap latitude={latitude ?? TOKYO.latitude} longitude={longitude ?? TOKYO.longitude} onSelect={reverse} /></View>
        <View style={styles.placeCard}>
          <View style={styles.placeIcon}><Ionicons name="location" size={22} color={palette.accent} /></View>
          <View style={styles.placeCopy}><TextInput style={styles.nameInput} value={name} editable={canEdit && !saving} onChangeText={(value) => { invalidateLookup(); setName(value); }} placeholder="場所の表示名" placeholderTextColor="#9AA39E" /><Text style={styles.address} numberOfLines={2}>{address || '地図をタップして場所を設定'}</Text></View>
        </View>
        <View style={styles.bottom}><TouchableOpacity accessibilityRole="button" disabled={!canEdit || saving || loading} style={[styles.save, (!canEdit || saving || loading) && { opacity: 0.5 }]} onPress={save}><Text style={styles.saveText}>{saving ? '保存中…' : canEdit ? 'この場所に設定' : '閲覧のみ'}</Text></TouchableOpacity></View>
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

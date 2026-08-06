import { FormField } from '@/components/form-field';
import { KeyboardDismissBar } from '@/components/keyboard-dismiss-bar';
import { LocationMap } from '@/components/location-map';
import { DateRangeCalendar, formatJapaneseDateRange, toDateString } from '@/components/date-range-calendar';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { TimeRangePicker } from '@/components/time-range-picker';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { formatEventTimeLabel } from '@/lib/time-values';
import { ChatImageInput, EventTimeMode } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

export default function CreateEventScreen() {
  const { addEvent } = useEvents();
  const today = toDateString(new Date());
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState<string | undefined>();
  const [timeMode, setTimeMode] = useState<EventTimeMode>('start');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(35.6812);
  const [longitude, setLongitude] = useState(139.7671);
  const [hasSelectedCoordinates, setHasSelectedCoordinates] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [initialFee, setInitialFee] = useState('');
  const [coverImage, setCoverImage] = useState<ChatImageInput>();
  const mapSelectionHint = Platform.OS === 'web'
    ? '場所名の直接入力、現在地、地図プレビューに対応'
    : '施設名・住所検索、現在地、地図タップに対応';
  const mapSelectionEmpty = Platform.OS === 'web'
    ? '場所名を入力するか、現在地を選択'
    : '検索・現在地・地図タップで場所を選択';

  const submit = () => {
    if (!title.trim()) {
      Alert.alert('イベント名を入力してください');
      return;
    }
    if (timeMode === 'range' && endTime && startDate === endDate && endTime <= startTime) {
      Alert.alert('終了時刻を確認してください', '同じ日の場合、終了時刻は開始時刻より後にしてください。');
      return;
    }
    const event = addEvent({ title: title.trim(), startDate, endDate, startTime, endTime, timeMode, location, address, latitude: hasSelectedCoordinates ? latitude : undefined, longitude: hasSelectedCoordinates ? longitude : undefined, description, initialFee: Number(initialFee) || 0, coverImage });
    router.dismiss();
    setTimeout(() => router.push(`/event/${event.id}`), 0);
  };

  const pickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('写真へのアクセスを許可してください');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!asset) return;
    setCoverImage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      fileName: asset.fileName ?? undefined,
    });
  };

  const addressLabel = (value?: Location.LocationGeocodedAddress) => value
    ? [value.region, value.city, value.district, value.street, value.streetNumber].filter((part, index, values) => part && values.indexOf(part) === index).join('')
    : '';

  const selectLocation = async (nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setHasSelectedCoordinates(true);
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: nextLatitude, longitude: nextLongitude });
      const nextAddress = addressLabel(result[0]);
      const nextName = result[0]?.name || nextAddress;
      if (nextAddress) { setAddress(nextAddress); setLocationQuery(nextAddress); }
      if (nextName) setLocation(nextName);
    } catch { /* 地図上の座標はそのまま利用できる */ }
  };

  const searchLocation = async () => {
    const query = locationQuery.trim() || location.trim();
    if (!query) return Alert.alert('検索する場所を入力してください');
    Keyboard.dismiss();
    setLocationLoading(true);
    try {
      const result = await Location.geocodeAsync(query);
      if (!result[0]) return Alert.alert('場所が見つかりません', '施設名や住所を変えて検索してください。');
      setLocation(query);
      setAddress(query);
      await selectLocation(result[0].latitude, result[0].longitude);
    } catch {
      Alert.alert('場所を検索できませんでした', Platform.OS === 'web'
        ? '通信状態を確認するか、場所を直接入力してください。'
        : '通信状態を確認するか、地図上で場所を選択してください。');
    } finally { setLocationLoading(false); }
  };

  const useCurrentLocation = async () => {
    Keyboard.dismiss();
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return Alert.alert('位置情報の許可が必要です', Platform.OS === 'web'
        ? '場所は検索または直接入力でも設定できます。'
        : '場所は検索または地図タップでも設定できます。');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await selectLocation(current.coords.latitude, current.coords.longitude);
    } catch { Alert.alert('現在地を取得できませんでした'); } finally { setLocationLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} onScrollBeginDrag={Keyboard.dismiss} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={styles.introIcon}><Ionicons name="calendar-outline" size={22} color={palette.accent} /></View>
            <View style={styles.introCopy}><Text style={styles.introTitle}>まずは基本情報から</Text><Text style={styles.introText}>あとからいつでも編集できます</Text></View>
          </View>

          <FormField label="イベント名" icon="ticket-outline" placeholder="例：夏のキャンプ 2026" value={title} onChangeText={setTitle} autoFocus />
          <Text style={styles.photoLabel}>イベント写真</Text>
          <TouchableOpacity style={styles.coverPicker} onPress={pickCoverImage} activeOpacity={0.82}>
            {coverImage
              ? <Image source={{ uri: coverImage.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              : <><View style={styles.coverIcon}><Ionicons name="image-outline" size={24} color={palette.primary} /></View><Text style={styles.coverTitle}>イベントを表す写真を選ぶ</Text><Text style={styles.coverText}>作成後も主催者・共同主催者が変更できます</Text></>}
            <View style={styles.coverEdit}><Ionicons name={coverImage ? 'pencil' : 'add'} size={17} color={palette.surface} /></View>
          </TouchableOpacity>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>開催日</Text><Text style={styles.sectionHint}>カレンダーから開始日と終了日を選択</Text></View><Text style={styles.selection}>{formatJapaneseDateRange(startDate, endDate)}</Text></View>
          <DateRangeCalendar startDate={startDate} endDate={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); }} />
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>開催時間</Text><Text style={styles.sectionHint}>開始時刻のみでも登録できます</Text></View><Text style={styles.selection}>{formatEventTimeLabel(startTime, endTime, timeMode)}</Text></View>
          <TimeRangePicker startTime={startTime} endTime={endTime} timeMode={timeMode} onChange={(value) => { setStartTime(value.startTime); setEndTime(value.endTime); setTimeMode(value.timeMode); }} />
          <View style={styles.fieldGap} />
          <FormField label="場所" icon="location-outline" placeholder="会場名、住所、集合場所など" value={location} onChangeText={(value) => { setLocation(value); if (!mapOpen) setLocationQuery(value); }} />
          <TouchableOpacity style={styles.mapToggle} onPress={() => { setMapOpen((current) => !current); setLocationQuery((current) => current || location); }}><View style={styles.mapToggleIcon}><Ionicons name="map-outline" size={19} color={palette.primary} /></View><View style={styles.mapToggleCopy}><Text style={styles.mapToggleTitle}>{mapOpen ? '地図を閉じる' : '地図から場所を設定'}</Text><Text style={styles.mapToggleText}>{mapSelectionHint}</Text></View><Ionicons name={mapOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} /></TouchableOpacity>
          {mapOpen ? <View style={styles.mapPanel}>
            {Platform.OS === 'web'
              ? <View style={styles.webMapNotice}><Ionicons name="information-circle-outline" size={18} color={palette.primary} /><Text style={styles.webMapNoticeText}>会場名や住所は上の「場所」欄へ入力してください。地図は現在地を選ぶと移動します。</Text></View>
              : <View style={styles.mapSearch}><Ionicons name="search" size={18} color={palette.muted} /><TextInput style={styles.mapSearchInput} value={locationQuery} onChangeText={setLocationQuery} placeholder="施設名・駅名・住所で検索" placeholderTextColor="#9AA39E" returnKeyType="search" onSubmitEditing={searchLocation} /><TouchableOpacity style={styles.mapSearchButton} onPress={searchLocation}>{locationLoading ? <ActivityIndicator size="small" color={palette.surface} /> : <Text style={styles.mapSearchButtonText}>検索</Text>}</TouchableOpacity></View>}
            <TouchableOpacity style={styles.currentLocation} onPress={useCurrentLocation}><Ionicons name="navigate" size={16} color={palette.primary} /><Text style={styles.currentLocationText}>現在地へ移動</Text></TouchableOpacity>
            <View style={styles.map}><LocationMap latitude={latitude} longitude={longitude} onSelect={selectLocation} /></View>
            <View style={styles.selectedPlace}><Ionicons name="location" size={18} color={palette.accent} /><View style={styles.selectedCopy}><Text style={styles.selectedName}>{hasSelectedCoordinates ? location || '設定した場所' : mapSelectionEmpty}</Text><Text style={styles.selectedAddress}>{hasSelectedCoordinates ? address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '初期表示：東京駅周辺'}</Text></View></View>
          </View> : null}
          <FormField label="イベントの説明" hint="任意" icon="document-text-outline" placeholder="持ち物や連絡事項を書きましょう" value={description} onChangeText={setDescription} multiline />
          <FormField label="1人あたりの参加費" hint="後から参加した人にも自動で追加" icon="wallet-outline" placeholder="0" value={initialFee} onChangeText={setInitialFee} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} blurOnSubmit />

          <View style={styles.nextInfo}>
            <Text style={styles.nextTitle}>作成後に設定できること</Text>
            <View style={styles.chips}><View style={styles.chip}><Ionicons name="list" size={14} color={palette.primary} /><Text style={styles.chipText}>タイムフロー</Text></View><View style={styles.chip}><Ionicons name="people" size={14} color={palette.primary} /><Text style={styles.chipText}>参加者別料金</Text></View><View style={styles.chip}><Ionicons name="link" size={14} color={palette.primary} /><Text style={styles.chipText}>招待リンク</Text></View></View>
          </View>
        </ScrollView>
        <View style={styles.bottom}>
          <KeyboardDismissBar />
          <TouchableOpacity style={styles.submit} onPress={submit} activeOpacity={0.85}><Text style={styles.submitText}>イベントを作成する</Text><Ionicons name="arrow-forward" size={19} color={palette.surface} /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 22 },
  intro: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderLeftWidth: 3, borderLeftColor: palette.accent, padding: 14, marginBottom: 24 },
  introIcon: { width: 40, height: 40, borderRadius: 6, backgroundColor: palette.primarySoft, justifyContent: 'center', alignItems: 'center' },
  introCopy: { marginLeft: 12 },
  introTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  introText: { color: palette.muted, fontSize: 13 },
  photoLabel: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: -4, marginBottom: 9 },
  coverPicker: { height: 176, borderRadius: 10, backgroundColor: '#242A26', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 22, borderWidth: 1, borderColor: '#242A26' },
  coverIcon: { width: 46, height: 46, borderRadius: 7, backgroundColor: '#E8E9E6', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  coverTitle: { color: palette.surface, fontSize: 14, fontWeight: '900' },
  coverText: { color: '#C8CBC7', fontSize: 11, marginTop: 4 },
  coverEdit: { position: 'absolute', right: 12, bottom: 12, width: 38, height: 38, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },
  sectionTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  sectionHint: { color: palette.muted, fontSize: 12, marginTop: 3 },
  selection: { maxWidth: '48%', color: palette.primary, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  fieldGap: { height: 20 },
  mapToggle: { minHeight: 62, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginTop: -6, marginBottom: 18 }, mapToggleIcon: { width: 38, height: 38, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, mapToggleCopy: { flex: 1, marginHorizontal: 10 }, mapToggleTitle: { color: palette.primary, fontSize: 12, fontWeight: '900' }, mapToggleText: { color: palette.muted, fontSize: 11, marginTop: 3 }, mapPanel: { borderRadius: 8, backgroundColor: palette.surface, overflow: 'hidden', marginTop: -10, marginBottom: 18, borderWidth: 1, borderColor: palette.line }, mapSearch: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, backgroundColor: palette.canvas, margin: 11, marginBottom: 0, borderRadius: 6 }, mapSearchInput: { flex: 1, color: palette.ink, fontSize: 12, paddingHorizontal: 9 }, mapSearchButton: { width: 58, height: 42, marginRight: 4, borderRadius: 6, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, mapSearchButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' }, webMapNotice: { margin: 11, marginBottom: 0, borderLeftWidth: 2, borderLeftColor: palette.primary, backgroundColor: palette.primarySoft, flexDirection: 'row', alignItems: 'center', padding: 12 }, webMapNoticeText: { flex: 1, marginLeft: 8, color: palette.primary, fontSize: 12, lineHeight: 18 }, currentLocation: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 }, currentLocationText: { color: palette.primary, fontSize: 13, fontWeight: '800', marginLeft: 5 }, map: { height: 260, overflow: 'hidden' }, selectedPlace: { minHeight: 62, padding: 12, flexDirection: 'row', alignItems: 'center' }, selectedCopy: { flex: 1, marginLeft: 9 }, selectedName: { color: palette.ink, fontSize: 12, fontWeight: '900' }, selectedAddress: { color: palette.muted, fontSize: 12, marginTop: 3 },
  nextInfo: { borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 15 },
  nextTitle: { color: palette.muted, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.primarySoft, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 4 },
  chipText: { color: palette.primary, fontSize: 13, fontWeight: '700', marginLeft: 4 },
  bottom: { backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, padding: 14 },
  submit: { minHeight: 55, borderRadius: 8, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: palette.surface, fontSize: 15, fontWeight: '800', marginRight: 9 },
});

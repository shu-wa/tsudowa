import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function extractCode(data: string) {
  const match = data.match(/[?&]code=([^&]+)/i);
  return decodeURIComponent(match?.[1] ?? data).trim().toUpperCase();
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <View style={styles.loading} />;
  if (!permission.granted) return <SafeAreaView style={styles.permission}><View style={styles.permissionIcon}><Ionicons name="camera-outline" size={34} color={palette.primary} /></View><Text style={styles.permissionTitle}>カメラの許可が必要です</Text><Text style={styles.permissionText}>招待QRコードを読み取るために、Do Eventerのカメラ利用を許可してください。</Text><TouchableOpacity style={styles.permissionButton} onPress={requestPermission}><Text style={styles.permissionButtonText}>カメラを許可する</Text></TouchableOpacity></SafeAreaView>;

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    router.replace({ pathname: '/join', params: { code: extractCode(data) } });
  };

  return <View style={styles.container}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : handleScan} /><SafeAreaView style={styles.overlay}><View style={styles.copy}><Text style={styles.title}>招待QRコードを枠内に</Text><Text style={styles.text}>読み取るとイベントを確認できます</Text></View><View style={styles.frame}><View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} /><View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} /></View><TouchableOpacity style={styles.cancel} onPress={() => router.back()}><Ionicons name="close" size={22} color={palette.surface} /><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity></SafeAreaView></View>;
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: '#111' }, container: { flex: 1, backgroundColor: '#111' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 70 }, copy: { alignItems: 'center' }, title: { color: palette.surface, fontSize: 20, fontWeight: '900', marginBottom: 7 }, text: { color: '#E5E7E5', fontSize: 13 }, frame: { width: 245, height: 245 }, corner: { position: 'absolute', width: 48, height: 48, borderColor: palette.surface }, topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }, topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }, bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }, bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }, cancel: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 17, paddingHorizontal: 17, paddingVertical: 11 }, cancelText: { color: palette.surface, fontSize: 12, fontWeight: '700', marginLeft: 5 }, permission: { flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', padding: 28 }, permissionIcon: { width: 76, height: 76, borderRadius: 25, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, permissionTitle: { color: palette.ink, fontSize: 21, fontWeight: '900', marginBottom: 9 }, permissionText: { color: palette.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginBottom: 24 }, permissionButton: { height: 52, borderRadius: 17, backgroundColor: palette.primary, paddingHorizontal: 24, justifyContent: 'center' }, permissionButtonText: { color: palette.surface, fontSize: 13, fontWeight: '800' } });

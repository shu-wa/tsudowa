import { Platform } from 'react-native';

export const palette = {
  canvas: '#F3F3F0',
  surface: '#FCFCFA',
  ink: '#151816',
  muted: '#626762',
  line: '#D7D8D3',
  primary: '#173E33',
  primarySoft: '#E8E9E6',
  accent: '#A8442F',
  accentSoft: '#EEEAE6',
  yellow: '#B58A25',
  danger: '#A63832',
};

export const typography = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'system-ui' }),
  rounded: Platform.select({
    ios: 'Arial Rounded MT Bold',
    android: 'sans-serif-medium',
    default: 'system-ui',
  }),
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  android: { elevation: 0 },
  default: {},
});

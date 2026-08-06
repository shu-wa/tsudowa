import { Alert, AlertButton, AlertOptions, Platform } from 'react-native';

// React Native Web 0.21 ships Alert.alert as an empty function. Keep the
// native API at call sites, but provide browser-native feedback and callbacks
// so confirmations and post-success navigation work on web as well.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) => {
    const body = [title, message].filter(Boolean).join('\n\n');
    const choices = buttons ?? [];

    if (choices.length <= 1) {
      window.alert(body);
      choices[0]?.onPress?.();
      options?.onDismiss?.();
      return;
    }

    const cancel = choices.find((button) => button.style === 'cancel');
    const confirm = choices.find((button) => button.style === 'destructive')
      ?? [...choices].reverse().find((button) => button.style !== 'cancel');

    if (!confirm) {
      window.alert(body);
      cancel?.onPress?.();
      options?.onDismiss?.();
      return;
    }

    const accepted = window.confirm(`${body}\n\n${confirm.text}`);
    if (accepted) confirm.onPress?.();
    else cancel?.onPress?.();
    options?.onDismiss?.();
  };
}

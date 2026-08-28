import * as Notifications from 'expo-notifications';
import { Href, router } from 'expo-router';
import { useEffect } from 'react';

const EVENT_ROUTE = /^\/event\/[^/]+(?:\/(?:chat|participants|collection\/[^/]+))?$/;

export default function NotificationObserver() {
  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string' && EVENT_ROUTE.test(url)) {
        router.push(url as Href);
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
    };

    const response = Notifications.getLastNotificationResponse();
    if (response?.notification) redirect(response.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((nextResponse) => {
      redirect(nextResponse.notification);
    });
    return () => subscription.remove();
  }, []);

  return null;
}

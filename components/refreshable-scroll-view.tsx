import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, ScrollViewProps } from 'react-native';

export function RefreshableScrollView({ horizontal, refreshControl, ...props }: ScrollViewProps) {
  const { refreshData } = useEvents();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  return (
    <ScrollView
      {...props}
      horizontal={horizontal}
      alwaysBounceVertical={horizontal ? false : (props.alwaysBounceVertical ?? true)}
      refreshControl={horizontal ? refreshControl : (refreshControl ?? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} colors={[palette.primary]} />)}
    />
  );
}

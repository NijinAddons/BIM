import React, { useEffect } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';

import { useManualRefresh } from '../queries';

const ACCENT_TEAL = '#2ECFC0';

type Props = Omit<
  RefreshControlProps,
  'colors' | 'onRefresh' | 'refreshing' | 'tintColor'
> & {
  /** Spinner colour on both platforms. */
  color?: string;
  /** Reload whatever the screen shows; the spinner stays up until it settles. */
  onRefresh: () => Promise<unknown>;
  /** For screens that show their own progress UI instead of the spinner. */
  onRefreshingChange?: (refreshing: boolean) => void;
};

/**
 * Pull-to-refresh for any ScrollView/FlatList: pass it as `refreshControl`.
 * A failed refresh leaves the current content on screen (queries keep their
 * last data), so screens don't need their own error handling for it.
 */
export default function AppRefreshControl({
  color = ACCENT_TEAL,
  onRefresh,
  onRefreshingChange,
  ...rest
}: Props) {
  const { refreshing, onRefresh: handleRefresh } = useManualRefresh(onRefresh);

  useEffect(() => {
    onRefreshingChange?.(refreshing);
  }, [onRefreshingChange, refreshing]);

  // `rest` also carries the `style`/children Android's ScrollView clones in.
  return (
    <RefreshControl
      colors={[color]}
      tintColor={color}
      {...rest}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    />
  );
}

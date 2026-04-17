import { useCallback, useState } from 'react';
import { findNodeHandle, Platform, type View as RNView } from 'react-native';

/**
 * Tracks the Android native view tag for D-pad `nextFocus*` props.
 */
export function useTvNativeTag() {
  const [nativeTag, setNativeTag] = useState<number | null>(null);

  const setRef = useCallback((node: RNView | null) => {
    if (Platform.OS !== 'android') {
      setNativeTag(null);
      return;
    }
    setNativeTag(node ? findNodeHandle(node) : null);
  }, []);

  return { setRef, nativeTag };
}

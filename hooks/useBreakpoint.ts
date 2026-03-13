import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const isMobile = width < TABLET_BREAKPOINT;
  return { isMobile };
}

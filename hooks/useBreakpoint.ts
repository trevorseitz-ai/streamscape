import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < TABLET_BREAKPOINT;
  const isLandscape = width > height;
  return { isMobile, isLandscape, width, height };
}

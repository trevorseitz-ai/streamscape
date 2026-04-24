import { Platform } from 'react-native';

/** Android TV D-pad overrides; no-ops on other platforms. */
export function tvAndroidNavProps(args: {
  /** Clamp: focus stays on this view when moving left (native tag of this view). */
  nextFocusLeftSelf?: number | null;
  /** Clamp: focus stays when moving right. */
  nextFocusRightSelf?: number | null;
  /** Explicit right target (e.g. search field tag). Overrides right self-clamp. */
  nextFocusRight?: number | null;
  /** Explicit left target (e.g. sidebar search tag from search field). */
  nextFocusLeft?: number | null;
  /** Explicit down target (e.g. first poster below hero). */
  nextFocusDown?: number | null;
  /** Explicit up target (e.g. hero button above first row). */
  nextFocusUp?: number | null;
  hasTVPreferredFocus?: boolean;
}): Record<string, unknown> {
  if (Platform.OS !== 'android') {
    return {};
  }
  const out: Record<string, unknown> = {};
  if (args.nextFocusLeft != null) {
    out.nextFocusLeft = args.nextFocusLeft;
  } else if (args.nextFocusLeftSelf != null) {
    out.nextFocusLeft = args.nextFocusLeftSelf;
  }
  if (args.nextFocusRight != null) {
    out.nextFocusRight = args.nextFocusRight;
  } else if (args.nextFocusRightSelf != null) {
    out.nextFocusRight = args.nextFocusRightSelf;
  }
  if (args.nextFocusDown != null) {
    out.nextFocusDown = args.nextFocusDown;
  }
  if (args.nextFocusUp != null) {
    out.nextFocusUp = args.nextFocusUp;
  }
  if (args.hasTVPreferredFocus) {
    out.hasTVPreferredFocus = true;
  }
  return out;
}

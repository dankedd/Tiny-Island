import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Short vibration on iPhone; silently does nothing in a browser. */
export function tap(strong = false): void {
  Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
}

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.eilandrijk.app',
  appName: 'Eilandrijk',
  webDir: 'dist',
  ios: { contentInset: 'never' },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tinyisland.game',
  appName: 'Tiny Island',
  webDir: 'dist',
  ios: { contentInset: 'never' },
};

export default config;

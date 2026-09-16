import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emcinemara.app',
  appName: 'EmCinemaRa',
  webDir: 'dist',
  // Black behind the web view, so there is no white flash between the splash
  // screen and the game's first paint.
  backgroundColor: '#000000',
  plugins: {
    SystemBars: {
      // Light icons, for the black header. The default follows the phone's
      // theme, which in light mode draws black icons on a black bar.
      style: 'DARK',
    },
  },
};

export default config;

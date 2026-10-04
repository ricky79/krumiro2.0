import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // L'id identifica l'app su Android e sul Play Store: dopo la pubblicazione non si può più cambiare.
  appId: 'io.github.ricky79.timbrature',
  appName: 'Timbrature',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#0f766e',
    },
  },
};

export default config;

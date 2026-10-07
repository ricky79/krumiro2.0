import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // L'id identifica l'app su Android e sul Play Store: dopo la pubblicazione non si può più cambiare.
  appId: 'app.sbeggio',
  appName: 'Krumiro',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#0f766e',
    },
  },
};

export default config;

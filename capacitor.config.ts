import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.m2gi.projetkahoot',
  appName: 'Projet Kahoot',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      google: {
        enabled: true,
        webClientId: process.env.VITE_GOOGLE_WEB_CLIENT_ID || ''
      }
    }
  }
};

export default config;
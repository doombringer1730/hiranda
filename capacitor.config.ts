import type { CapacitorConfig } from '@capacitor/cli'

// The iPhone app is a native shell around the live site: it loads
// hiranda-616i.vercel.app, so every web deploy reaches the app instantly —
// no App Store update needed for UI changes. Native-only pieces (haptics,
// status bar, splash) come from the Capacitor plugins below. See IOS.md.
const config: CapacitorConfig = {
  appId: 'com.hiranda.app',
  appName: 'Hiranda',
  webDir: 'native-shell',
  backgroundColor: '#120c08',
  server: {
    url: 'https://hiranda-616i.vercel.app',
    // Shown when the site can't load (offline, airplane mode).
    errorPath: 'offline.html',
  },
  ios: {
    // The web app already pads for the notch and home bar (viewport-fit=cover).
    contentInset: 'never',
    backgroundColor: '#120c08',
    scheme: 'Hiranda',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#120c08',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
}

export default config

# Hiranda for iPhone

The iPhone app is a native Capacitor shell that loads the live site
(`https://hiranda-616i.vercel.app`, set in `capacitor.config.ts`). Web deploys
reach the app instantly; only native changes need a rebuild in Xcode.

## Run it on your iPhone (Mac)

1. Install Xcode (App Store) and open it once so it installs the iOS components.
2. Install Node LTS from https://nodejs.org.
3. In Xcode → Settings → Accounts, add the Apple ID you develop with.
4. In Terminal:
   ```sh
   git clone https://github.com/doombringer1730/hiranda.git   # or: git pull
   cd hiranda
   git checkout claude/dazzling-archimedes-q2orhj               # until it's merged
   npm install
   npm run ios        # cap sync ios + opens Xcode
   ```
5. In Xcode, click **App** (blue icon, top of the left sidebar) → **Signing &
   Capabilities** → **Team**: pick your Apple ID. If it says the bundle ID is
   taken, change **Bundle Identifier** to something unique like
   `com.yourname.hiranda`.
6. Plug in your iPhone, pick it in the device menu at the top, press ▶.
   - First time: iPhone **Settings → Privacy & Security → Developer Mode** → on (it restarts).
   - Then **Settings → General → VPN & Device Management** → trust your Apple ID.
   - No phone handy? Pick an iPhone simulator instead.

A free Apple ID's install lasts 7 days; press ▶ again to refresh it.

## Google sign-in in the app
Google blocks sign-in inside app web views, so the app opens Google in a
Safari sheet and Google sends you back through `hiranda://auth/callback`.
One-time setup: Supabase Dashboard → Authentication → URL Configuration →
Redirect URLs → add `hiranda://**`. Needs an app build that includes the
Browser plugin (after `git pull`, run `npm install && npm run ios`, then ▶).

## Known limits (for now)
- **Notifications**: web push doesn't exist inside iOS apps. Native push (APNs)
  needs the paid Apple Developer Program — next step after that.

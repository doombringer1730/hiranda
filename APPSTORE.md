# Shipping Hiranda to the App Store

The code side is done. The steps below need your paid Apple Developer account
(enrollment must be approved first) and are one-time. Do them in order.

## 1. Xcode: team and capabilities

```sh
cd ~/Desktop/hiranda && git pull && npm install && npm run ios
```

In Xcode, click the blue **App** project → target **App** → **Signing & Capabilities**:

1. **Team**: your paid team (not "Personal Team").
2. **Bundle Identifier**: `com.hiranda.app`. If Apple says it's taken, pick
   another, and use that same id everywhere below. Also change
   `group.com.hiranda.app` in `ios/App/App/WidgetBridgePlugin.swift` and
   `ios/widget/HirandaWidget.swift` to `group.<your id>`.
3. Click **+ Capability** and add each:
   - **Push Notifications**
   - **Sign in with Apple**
   - **App Groups** → **+** → `group.com.hiranda.app`
   - *(optional)* **Time Sensitive Notifications**, so urgent messages break through Focus

## 2. Xcode: the home-screen widget

1. Go to **File → New → Target… → Widget Extension**.
   - Name: `HirandaWidget`.
   - Uncheck "Include Live Activity" and "Include Configuration App Intent".
   - Click **Activate** if asked.
2. In the new `HirandaWidget` folder in the sidebar, delete the generated
   `.swift` files. Keep `Assets.xcassets` and `Info.plist`.
3. Drag `ios/widget/HirandaWidget.swift` into that folder. Tick **only** the
   `HirandaWidget` target.
4. Select target **HirandaWidget** → **Signing & Capabilities** → **+ Capability**
   → **App Groups** → tick the same `group.com.hiranda.app`.
5. Press ▶, then long-press your home screen → **+** → Hiranda → "Days together".

## 3. Push notification key → Vercel

1. Go to developer.apple.com → **Certificates, IDs & Profiles → Keys → +**.
2. Name it "Hiranda push", tick **Apple Push Notifications service (APNs)**,
   continue, and **Download** the `.p8`. You can only download it once.
3. In Vercel → hiranda-616i → Settings → Environment Variables, add:
   - `APNS_KEY`: the whole `.p8` file contents
   - `APNS_KEY_ID`: the key's 10-character ID
   - `APNS_TEAM_ID`: your Team ID (top right of the developer site)
   - `APNS_BUNDLE_ID`: `com.hiranda.app`
4. Redeploy. In the app, go to Settings → Notifications → turn on → **Send me a test**.

## 4. Supabase

In Authentication:

- **Providers → Apple → Enable.** Under **Client IDs**, enter `com.hiranda.app`.
  For the native app, that's all it needs. The secret and key fields are only
  for Apple sign-in on the website.
- **URL Configuration → Redirect URLs → Add** `hiranda://**`. This is for Google
  sign-in returning to the app.

## 5. A demo couple for the reviewer

Apple's reviewer must be able to try everything, and Hiranda needs two people:

1. Create two accounts, for example `appreview.sam@…` and `appreview.riley@…`.
2. Pair them with the invite link.
3. Add a little content: a memory, a letter, a few chat messages, a jar.
4. Set the Theater passcode in Settings.
5. Do **not** turn on 2FA for these accounts.

## 6. App Store Connect

Go to appstoreconnect.apple.com → **Apps → + → New App**.

- **Platform:** iOS
- **Name:** Hiranda
- **Bundle ID:** com.hiranda.app
- **SKU:** hiranda-ios
- **Category:** Lifestyle
- **Price:** Free
- **Age rating:** answer the questionnaire honestly. Private messaging with no
  public content usually comes out at **12+**.
- **Privacy Policy URL:** https://hiranda-616i.vercel.app/privacy
- **Support URL:** https://hiranda-616i.vercel.app/support
- **App Privacy**, which must match `ios/App/App/PrivacyInfo.xcprivacy`:
  - **Data collected:** Email Address, Name, User ID, Photos or Videos, Other User Content.
  - **Linked to the user:** yes.
  - **Used for tracking:** no.
  - **Purpose:** App Functionality.
- **Screenshots:** iPhone 6.9" (1320 × 2868). Take them in the Simulator with
  ⌘S on an "iPhone 16 Pro Max" (or newer) device, or ask me to make them.

### Description (draft)

> A private little place for the two of you.
>
> Hiranda is a shared space for couples — especially long-distance ones. One question every morning, answers hidden until you both reply. "Open when…" letters sealed until the day they're needed. A jar of date ideas that pulls one from each of you. Fifteen minutes of phone-down talk time. A tiny daily lesson built on relationship research, where every stamp earns you both a coupon.
>
> Chat with good-news cards, a shared memory book, someday lists, and a Theater where you watch together — free public-domain classics and YouTube play right in Hiranda, in sync.
>
> No ads. No feeds. Just the two of you.

**Keywords:** couples,relationship,long distance,LDR,partner,date ideas,love,letters,boyfriend,girlfriend

### Review notes (paste into "App Review Information")

> Hiranda is a private space for two partners, so it needs a pair of accounts.
>
> Sign in with: appreview.sam@… / [password]
> Partner account (to see the other side, e.g. on a second device): appreview.riley@… / [password]
>
> The Theater (watch-together) is behind a couple passcode, which a couple sets in Settings. For review it is: [passcode]
> Theater content is public-domain films from the Internet Archive and YouTube videos played through YouTube's official embedded player. For commercial services, Hiranda only links out to the official apps, and partners start playback together with a countdown.
>
> Native features: push notifications when your partner answers, writes or plays; Sign in with Apple; a home-screen widget (Days together); haptics; native share sheet.

## 7. Upload

1. In Xcode's device menu, choose **Any iOS Device (arm64)**.
2. Go to **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
3. In App Store Connect → TestFlight, add Miri as a tester to try it first.
4. Then go to the app's page → add the build → **Add for Review → Submit**.

## Ground rules that keep the app approved

- **The iPhone app loads the website, so the website *is* the app.** Don't
  switch on features in the app that the reviewer didn't see, and never bring
  back streaming from debrid or torrent services.
- **Keep the review notes accurate**, including the passcode, whenever you resubmit.

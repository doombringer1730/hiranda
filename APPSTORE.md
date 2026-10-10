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
   - **In-App Purchase** (for Hiranda Plus)
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
  - **Data collected:** Email Address, Name, User ID, Photos or Videos, Other User Content, Purchase History, Physical Address, Phone Number (optional, for gift delivery).
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
> Hiranda Plus is an optional auto-renewing subscription (monthly or yearly, one plan covering both partners). The demo couple can test it with a Sandbox Apple ID. Free users see at most one clearly labeled sponsored card on a few browse pages.
>
> Native features: push notifications when your partner answers, writes or plays; Sign in with Apple; a home-screen widget (Days together); haptics; native share sheet.

## 7. Hiranda Plus (subscriptions)

Plus is one subscription per couple: $4.99/month or $39.99/year, with a 7-day
trial. Prices, perks, free themes and free Grow units all live in
`src/lib/plus-config.ts`. Sponsors live in `src/lib/sponsors.ts`.

**App Store (in-app purchase, via RevenueCat):**
1. App Store Connect → your app → **Subscriptions** → create a group "Hiranda Plus" with:
   - **Monthly:** `hiranda_plus_monthly`, $4.99, 1-week free trial.
   - **Yearly:** `hiranda_plus_yearly`, $39.99, 1-week free trial.
2. Sign the **Paid Apps agreement** (Business → Agreements). Purchases don't work without it.
3. Join the **Small Business Program**, so Apple takes 15% instead of 30%.
4. Set up RevenueCat (free under $2.5k/month in revenue):
   - Create a project and add your iOS app with its App Store Connect API key.
   - Create the entitlement **`plus`** and attach both products.
   - Create an offering marked **Current** with a **Monthly** and an **Annual** package.
5. Add to Vercel:
   - `NEXT_PUBLIC_REVENUECAT_IOS_KEY`: RevenueCat's public iOS SDK key
   - `REVENUECAT_SECRET_KEY`: a secret (v1) API key
   - `REVENUECAT_WEBHOOK_AUTH`: any long random string
6. In RevenueCat → Integrations → Webhooks, set the URL to
   `https://hiranda.com/api/revenuecat/webhook` and the Authorization
   header to the same `REVENUECAT_WEBHOOK_AUTH` value.

**Web (Stripe):**
1. In Stripe, create the product "Hiranda Plus" with two recurring prices
   ($4.99 monthly, $39.99 yearly). Turn on the customer portal (Settings → Billing → Customer portal).
2. Add a webhook at `https://hiranda.com/api/stripe/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Add to Vercel:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_YEARLY`

**Testing first:** use Stripe's *test* keys (`sk_test_…`) and test-mode prices
and webhook. While the key is a test key, only the people in
`STORE_ADMIN_EMAILS` can check out (Plus or gifts). Everyone else sees "coming
soon", so nobody gets Plus with a fake card. Testers pay with card
`4242 4242 4242 4242`. To go live, swap in the live key and recreate the
prices and webhook in live mode, because test-mode ids don't carry over.

**Both** need `SUPABASE_SERVICE_ROLE_KEY` set in Vercel, spelled exactly like
that. The old misspelled `UPABASE_SERVICE_ROLE_KEY` doesn't count.

Inside the app, Plus is only ever sold through Apple. The web checkout never
appears there (App Store rule 3.1.1). Your couple has a permanent "founders" grant.

## 8. Hiranda Store (gifts)

Partners can send each other gifts (`/store`). Physical goods are paid with
Stripe, which Apple allows outside in-app purchase (rule 3.1.3(e)).

**Suppliers make and ship the gifts.** Once Stripe confirms a payment, the
gift goes to its supplier automatically, and tracking flows back to the
recipient. Set each one up from **Gifts → Orders to ship → Suppliers**
(`/store/admin/suppliers`). That page shows whether each supplier is connected,
the exact steps, and a product finder for the ids that go in
`src/lib/store/catalog.ts`.

| Supplier | Makes | Vercel settings |
|---|---|---|
| Gelato | The printed card ("A card in the mail") | `GELATO_API_KEY` |
| Printful | Blankets, mugs and posters with your names | `PRINTFUL_API_TOKEN` (`PRINTFUL_STORE_ID` only with an account-level token) |
| Printify | The same, from many print shops | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID` |
| CJ Dropshipping | Care-package items from its US warehouse | `CJ_API_KEY` (paid from your CJ wallet) |
| Goody | Chocolates and treats, sent straight to the address | `GOODY_API_KEY`, `GOODY_WEBHOOK_SECRET`; needs Goody's "direct send" approval |

All of them also need:
- `STORE_CONTACT_EMAIL`: your email, which suppliers put on shipments instead of the user's.
- `STORE_WEBHOOK_KEY`: any long random text, used to secure tracking updates.
- `CRON_SECRET`: any long random text. A daily job checks every order in flight.

A gift whose supplier ids are empty is fulfilled **by hand**. It appears under
**Orders to ship** with the address and note, and you press **Mark shipped**.

While Stripe uses test keys, suppliers get **test orders only**: Gelato and
Printful drafts, and CJ sandbox orders. Goody is used only with
`GOODY_SANDBOX=1` and a sandbox key, and Printify not at all.

Then add to Vercel:
- `STORE_ENABLED=1`: the store stays "opens soon" until you set this.
- `STORE_ADMIN_EMAILS=you@example.com`: who sees `/store/admin`.

Keep every price above the supplier's cost plus shipping plus Stripe's fee
(about 3%). Before selling to the public, set up sales tax (Stripe Tax) and a
business (for example an LLC).

## 9. Upload

1. In Xcode's device menu, choose **Any iOS Device (arm64)**.
2. Go to **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
3. In App Store Connect → TestFlight, add Miri as a tester to try it first.
4. Then go to the app's page → add the build → **Add for Review → Submit**.

## Ground rules that keep the app approved

- **The iPhone app loads the website, so the website *is* the app.** Don't
  switch on features in the app that the reviewer didn't see, and never bring
  back streaming from debrid or torrent services.
- **Keep the review notes accurate**, including the passcode, whenever you resubmit.

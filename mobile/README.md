# Mobile app (React Native / Expo)

Native app using the **same REST API and database** as the web app. Screens: Login, Product list + search, Product page (colour swatches, size, storage, headboard, base, assembly tick box, live price, swipe gallery, sticky Add to Basket), Basket, Checkout (fake), Buyer orders (auto-refreshes so seller status changes appear).

## Run on your phone (quickest)
1. Start the backend from the repo root: `npm start` (port 3000).
2. `cd mobile && npm install && npx expo start`
3. Install **Expo Go** on the phone, scan the QR code (phone and PC on same Wi-Fi).
4. On the Login screen set **Server URL** to `http://<your-PC-IP>:3000` (or the live link), log in as `buyer@demo.test` / `buyer123`.
   Android emulator: the default `http://10.0.2.2:3000` works.

## Build an installable APK
Needs a free Expo account (builds in the cloud, no Android SDK needed):
```bash
npm i -g eas-cli && eas login
eas build -p android --profile preview     # outputs an .apk download link
```
(`usesCleartextTraffic` is enabled so the APK can talk to an http dev server; use https for the live link.)

## Status
Bundles successfully (`npx expo export --platform android`). **Not yet run on a device/emulator and no APK built yet** – no Android SDK or Expo login on the dev machine. Seller/admin features are web-only by design (the brief requires only buyer screens in the app).

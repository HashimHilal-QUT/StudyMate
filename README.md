# My Study Friends

A student study buddy directory with interactive city/university connection maps.

[Open the app](https://mystudyfriends.netlify.app/)

## Student experience

1. Register with a `.edu.au` university email, first name, four-digit app PIN and a photo or emoji avatar.
2. Save a passkey with the device's unlock method to complete registration. This is required for self-service PIN reset.
3. Optionally add a university, city, subjects, study style, availability, bio and social handles.
4. Explore the connection map or grouped cards. Group by city or university, search the directory, and highlight shared subjects/study habits with callouts.
5. The browser remembers sign-in for up to 90 days. On another device, sign in with the email and PIN.
6. Forgot the PIN? Choose a new PIN and verify the saved passkey. No email delivery or personal-fact questions are used.

The `.edu.au` check validates the address format, **not mailbox ownership or student status**. The app does not send email. Students need access to their saved passkey, its synced password manager or a compatible authenticator to reset a PIN. Email and city are deliberately not sufficient. Losing both PIN and passkey cannot be solved automatically without another trusted recovery channel. A four-digit PIN has limited strength even with attempt limits; this design does not promise impossible-to-compromise accounts.

## Mobile installation

The site is a Progressive Web App. Tap **Install app** or use the browser's install menu. On iPhone/iPad, open in Safari and choose **Share → Add to Home Screen**, enabling **Open as Web App** if offered. Installation availability varies by browser.

The manifest includes standalone display, home-screen icons and theme colors. The service worker caches only the public HTML/CSS/JavaScript shell and icons. Student profiles, API responses, authentication requests and photos are never cached. Internet is required to sign in, load students and save changes. The app shows an offline notice and offers a reload button when a new service-worker version is ready.

## Accounts and privacy

- Azure Table Storage holds profiles, account records, passkey public keys, challenges, session hashes and attempt counters.
- Email addresses are normalized and stored only as keyed lookup hashes, not raw text. They are never returned in public profile data or saved to browser storage.
- PINs use per-account random salts and scrypt hashes. Leading zeros are preserved.
- Login allows five attempts per account and 120 per client IP in a 15-minute window. Counters live in Azure with ETag concurrency checks, rather than per-function memory. Successful login clears the account counter. Passkey reset bypasses the PIN lockout after cryptographic verification.
- Passkeys use SimpleWebAuthn with discoverable credentials and required user verification. Server challenges expire after five minutes and are consumed exactly once. The server validates the expected origin, relying-party ID and signature.
- Sessions use random tokens in Secure, HttpOnly, SameSite=Strict cookies. Only token hashes are stored. PIN reset rotates the account's authentication version, invalidating all older sessions.
- No account is created until passkey registration has been verified. Pending challenges are rate-limited and contain sanitized profile data and PIN hashes.
- Photo selection works with device/computer galleries. The browser crops/resizes the image and the server re-encodes it as a 384×384 JPEG, removing EXIF/location metadata. Private Azure blobs are served through an authenticated function. Selecting an emoji removes the uploaded photo.
- Profile details and photos are visible to signed-in students. Contact happens through optional social handles outside the app.
- Expired Azure session/challenge/counter records are rejected but not automatically deleted; arrange cleanup if storage volume grows.

## Universities and connection maps

The dropdown contains 42 universities from [Study Australia](https://www.studyaustralia.gov.au/en/plan-your-studies/list-of-australian-universities), retrieved 26 October 2026. The last option allows manual institution/team entry. City accepts suggested and custom values; both city and university are optional.

Clustering runs entirely in JavaScript. Cyan links connect students to groups; violet links show shared subjects. Callouts count actual shared subjects, study styles and availability across distinct profiles. Matching ignores capitalization and extra spaces; it does not infer interests from bios or send data to an AI service. Missing locations have explicit “not shared” groups.

Map previews show at most 60 students and 12 per group; cards show every search result. Drag cards, or use keyboard focus and Enter/Space to open profiles. Reduced-motion preferences disable the spring animation. **Try a demo network** shows fictional profiles in memory, never database records.

## Code map

| Path | Responsibility |
| --- | --- |
| `public/index.html`, `public/css/main.css` | Screens, forms and responsive styles |
| `public/js/app.js` | Profile and directory flows |
| `public/js/account.js` | PIN forms and browser passkey ceremonies |
| `public/js/photos.js` | Photo picker, preprocessing and avatar rendering |
| `public/js/universities.js` | University snapshot and city suggestions |
| `public/js/network-model.js`, `network-view.js` | Explainable clustering and interactive graphs |
| `public/manifest.webmanifest`, `public/sw.js`, `public/js/pwa.js` | Installation, offline shell and updates |
| `netlify/functions/register.js`, `passkey.js`, `session.js` | Registration, PIN authentication and passkey reset |
| `netlify/functions/photo.js` | Authenticated private photo upload/download/removal |
| `netlify/functions/lib/auth.js` | Account, session, challenge and attempt-limit helpers |

## Deployment and local development

Netlify publishes `public/` and bundles the functions, using Node 22 and the existing Azure storage account. `sharp` is packaged as an external dependency so its native image decoder is available to functions. The private blob container `studymate-photos` is created on the first upload using the existing storage account credentials. If the account's policies prevent container creation, provision that private container in Azure first. Never enable public access for profile photos.

Required existing environment variables:

- `AZURE_STORAGE_ACCOUNT_NAME`
- `AZURE_STORAGE_ACCOUNT_KEY`

Passkeys default to the production origin `https://mystudyfriends.netlify.app`. Set `APP_ORIGIN` for a custom domain or local environment. For example, when using Netlify Dev on port 8888, set it to `http://localhost:8888`. Passkeys are domain-bound, so localhost/preview credentials do not work on production. Do not derive the trusted passkey origin from arbitrary request headers.

Optional `AUTH_EMAIL_PEPPER` provides a stable server-only secret for email lookup hashes. Set it **before launch** if storage keys will be rotated independently. Otherwise the Azure storage key is used as the pepper. Changing the pepper or rotating that storage key without migrating account lookup hashes will break existing email login; plan that change explicitly.

Run `npm install`, then `npm test`. Use Netlify Dev to run the static site and functions on the same origin. Deploy frontend, manifest, service worker and functions together. When changing the offline shell, bump the cache version in `public/sw.js` so installed apps receive an update prompt. Browser testing of WebAuthn can use a virtual CTAP2 authenticator; real-device checks should cover Safari/iOS and Android passkey/password-manager behavior before inviting students.

# Turning on Google sign-in

The code is in place. Google sign-in will **not work until the three
steps below are done in the Firebase console**, because the parts that
remain are account configuration that cannot live in a repository.

Until then the button appears and fails with "operation not allowed"
(web) or error code 10 (Android).

## Why the app signs in twice on a phone

Google refuses OAuth requests from an embedded webview and answers
`disallowed_useragent`. Capacitor runs the app inside exactly such a
webview, so the ordinary popup shows a Google error page rather than a
sign-in screen.

The installed app therefore opens Android's own account picker through
`@capacitor-firebase/authentication`, then passes the credential that
comes back to the JavaScript SDK. The second step is not redundant: the
JavaScript SDK is the one every Firestore rule reads, and without it the
pilgrim would be signed in natively while every database read was made
as a signed-out visitor.

## 1. Enable the provider

Firebase console → **Authentication** → **Sign-in method** → **Google**
→ Enable. Set the support email. Save.

That alone makes the **web** version work. Try it at `/` in a browser
before going further; if it fails here, nothing below will help.

## 2. Register the Android app

Firebase console → **Project settings** → **Your apps** → **Add app** →
Android.

- Package name: `ph.edu.sti.sanctiwalk` (must match exactly; it is in
  `android/app/build.gradle`)
- Download `google-services.json` and put it at
  `android/app/google-services.json`

That file is **not** in this repository and must not be committed.

## 3. Register the signing fingerprints

This is the step that is usually missed, and its failure mode is
silent: the account picker opens, you choose an account, and it closes
again with error code 10 and no explanation.

Get the debug fingerprint:

```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
```

Copy the **SHA-1** and the **SHA-256** into Firebase console → Project
settings → your Android app → **Add fingerprint**. Then download
`google-services.json` again — it changes once fingerprints are added —
and replace the one from step 2.

Do this for every keystore you build with. A release APK signed with a
different key needs that key's fingerprints registered too, or Google
sign-in works in testing and fails for everybody who installs the
release.

## Where the web client id goes

Nowhere. The console shows one under **Web SDK configuration** once the
provider is enabled, and it is tempting to paste it somewhere.

It is already in `google-services.json`, and the google-services Gradle
plugin turns it into `R.string.default_web_client_id`, which is the
string the authentication plugin reads. Pasting it into the code as
well would be a second copy that can go stale.

What *is* configured, in `capacitor.config.ts`:

```ts
plugins: {
  FirebaseAuthentication: {
    skipNativeAuth: true,
    providers: ['google.com'],
  },
},
```

`providers` is not optional. Without it the Google SDK is not loaded on
Android and the account picker never opens. `skipNativeAuth: true`
keeps a single session: the plugin returns a credential, and
`src/lib/googleAuth.ts` signs that into the JavaScript SDK, which is
the SDK every Firestore rule reads.

## 4. Rebuild

```bash
npm run apk
```

## What Google does not give you

An email address and a display name. It does not know which parish
somebody belongs to, and `firestore.rules` refuses an application whose
submitter has no `churchId`.

So a profile created by Google sign-in records the parish the app is
currently showing, exactly as the app already does for a pilgrim who
never signs in, and **Me → Change Parish** moves it. It never claims a
verified phone number, and it never grants a role.

## Apple sign-in

Not implemented, and the recommendation is not to.

It requires membership of the Apple Developer Program, which costs
US$99 a year, and SanctiWalk has no iOS build — the companion augmented
reality application is Android-only because compiling for iOS needs
Xcode on macOS, which this project does not have. Apple sign-in on an
Android handset is technically possible through Firebase's generic
OAuth flow, but it would be a paid dependency serving no one: every
user of this app is on Android, and all of them have a Google account
on the device already.

If a panel asks, that is the answer: it was considered, it costs money,
and it would serve zero users of an Android-only application.

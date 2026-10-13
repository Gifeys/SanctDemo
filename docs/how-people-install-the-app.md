# How somebody gets SanctiWalk onto their Android phone

There are two separate apps, and most people only need the first:

| App | Size | What it is |
|---|---|---|
| **SanctiWalk** | 47 MB | the whole app — bulletin, Mass, Rosary, history, map, ministries, sacraments, AI scanner |
| **SanctiWalk AR** | 155 MB | the AR Museum tour only. Opened *by* SanctiWalk; it has no icon of its own |

A visitor who never uses the AR tour needs only SanctiWalk.

## There is no Play Store step

Android installs an `.apk` file directly. The Play Store needs a
developer account, a review, and a signed release build, and none of
that is required for a capstone. Putting the file somewhere people can
download it is the whole job.

## Where to put the file

Use **GitHub Releases** on the repository you already have at
`github.com/Gifeys/SanctDemo`:

1. Repository → **Releases** → **Draft a new release**
2. Tag `v1.0`, title `SanctiWalk v1.0`
3. Drag both APKs into the attachments box
4. Publish

Each attachment then has a permanent direct link, something like
`https://github.com/Gifeys/SanctDemo/releases/download/v1.0/SanctiWalk.apk`.

Why not the alternatives:

- **Google Drive** warns "can't scan for viruses" on files this size and
  adds a confirmation step people get stuck on.
- **Committing the APK into `public/`** puts 200 MB into git history
  permanently, and every clone pays for it afterwards.
- GitHub Releases is free, fast, allows up to 2 GB per file, and the
  link never changes.

## What the person does

1. Opens the link on their phone, in Chrome.
2. Chrome downloads the file and warns that this kind of file can harm
   your device. That warning appears for every APK; tap **Download
   anyway**.
3. Taps the downloaded file.
4. Android says Chrome is not allowed to install unknown apps. Tap
   **Settings**, turn on **Allow from this source**, and come back.
5. Tap **Install**, then **Open**.

Step 4 happens once per phone, not once per app.

## For a defence or a parish launch

Make a QR code pointing at the release link and print it. People scan
it with the camera, Chrome opens, and they are at step 2. The project
already generates QR codes for the station markers, so the same tool
does this:

```bash
npx qrcode -o public/download/sanctiwalk-apk.png \
  "https://github.com/Gifeys/SanctDemo/releases/download/v1.0/SanctiWalk.apk"
```

## One honest caveat about the build

The APK being handed out is a **debug build**. It installs and runs
normally, and for a capstone that is fine. Two things follow from it:

- It is signed with the generic Android debug key, so it cannot later
  be updated by a release-signed build of the same app — the phone will
  refuse the upgrade and the app has to be uninstalled first.
- It is not optimised or minified, so it is larger and marginally
  slower than a release build would be.

If the parish is going to keep using it, build a signed release instead
(`android/app/build.gradle` already has a `release` block) and hand out
that APK from then on.

## The scanner needs the server to be deployed

Installing the app is not enough for the AI scanner to work. It sends
each photograph to a server, and that server has to be reachable from
the phone — see
[make-the-scanner-always-work.md](make-the-scanner-always-work.md).
Everything else in the app works as soon as it is installed.

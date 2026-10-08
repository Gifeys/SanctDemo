# Putting the parish admin on the web

The admin is not a separate application. It is `/admin` inside the same
React bundle as the pilgrim app, so deploying the site deploys both: the
pilgrim app at `/` and the parish office at `/admin`.

## Why Vercel can host it as a plain static site

The parish office talks to Firestore directly from the browser. It makes
no calls to the Express backend at all — that server exists for the AI
scanner and the emailer, and the admin uses neither. So there is nothing
to run server-side here, and nothing to configure beyond the build.

`vercel.json` in the repository root already sets:

- **buildCommand** `npm run build:app` — `vite build` only. The ordinary
  `npm run build` also bundles `server.ts` into `dist/`, and a Node
  bundle has no business in a static deployment.
- **installCommand** `npm install --ignore-scripts`. Two packages in
  this tree compile C++ at install time: `canvas`, a hard dependency of
  `mind-ar` (the AR scanner), and `re2`, which arrives under
  `firebase-tools`. Neither is used by the build - Vite never loads
  them - but npm still builds them, and on Vercel's Node 24 image
  node-pre-gyp finds no prebuilt binary, falls back to compiling from
  source, and fails. The whole deployment then ends at
  `npm install exited with 1`, before the build is reached.

  Skipping install scripts skips exactly that compilation. esbuild and
  rollup, the two things a Vite build genuinely needs a binary for,
  ship theirs as platform-specific optional packages rather than
  install scripts, so they are unaffected. Verified by installing this
  lockfile with the flag and building from it.

  Do NOT remove this to "clean up" the config. The deployment fails
  without it.
- **rewrites** every path to `index.html`. This is the one setting that
  must not be missed: without it `/admin/applications` returns 404 the
  moment anyone refreshes the page or follows a link to it, because
  there is no such file — the route exists only inside React. Vercel
  checks the filesystem before applying a rewrite, so real assets are
  still served normally.
- **X-Frame-Options: DENY** so the office cannot be framed by another
  site and clicked through invisibly.
- a long cache on `/assets/*`, which is safe because Vite fingerprints
  every filename.

## There are no environment variables to set

Firebase's web config is committed as `firebase-applet-config.json`, and
that is correct rather than an oversight: a Firebase web config is
public by design. It identifies the project; it does not authorise
anything. What stops a stranger reading another parish's applications is
`firestore.rules`, which runs on Google's servers on every request.

`VITE_API_BASE` and `VITE_APP_KEY` are for the AI scanner's backend and
are not needed by the admin. Leave them unset unless the scanner is
being deployed too.

## Deploying

From the repository root, once:

    npx vercel link

then for a production deploy:

    npx vercel --prod

The first run asks which Vercel account and project to use. After that
the URL it prints is the parish office — give the admins
`https://<project>.vercel.app/admin`.

### Connecting it to GitHub instead

Importing `Gifeys/SanctDemo` from the Vercel dashboard works as well and
is the better option for a parish: every push to `main` redeploys, so
nobody has to run a command to publish a change. Vercel reads the same
`vercel.json`, so there is nothing further to configure.

## After it is up

Check these three, in this order:

1. `/admin` loads and asks for a sign-in.
2. **Refresh the page while on `/admin/applications`.** This is the one
   that catches a missing rewrite, and it is the failure that would
   otherwise be found by an admin rather than by us.
3. Sign in as a parish admin and confirm the applications table fills.
   If it is empty but the dashboard counts are not, the rules are
   refusing the query rather than the deployment being wrong.

## What is NOT deployed by this

The AI scanner still has no backend. It calls `/api/identify`, which
does not exist on a static deployment, so scanning will fail there
exactly as it does in the APK. That needs the Express server deployed
separately — `render.yaml` in the root is set up for it.

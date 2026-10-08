import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SpotlightProvider } from './components/Spotlight';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import App from './App.tsx';
import FinishSignIn from './routes/FinishSignIn.tsx';
import SignUpFlow from './routes/SignUpFlow.tsx';
import AdminApp from './admin/AdminApp.tsx';
import './index.css';

/**
 * Uncaught errors, with their stack, into the Android log.
 *
 * Capacitor forwards console output to logcat, but an uncaught TypeError
 * arrives there as one line with no file, no line number and no stack -
 * "Cannot read properties of undefined" and nothing to say who read it.
 * That is unusable on a device with no devtools attached.
 *
 * This prints the stack explicitly, tagged, so `adb logcat` can find it.
 * It only listens; it changes no behaviour and swallows nothing.
 */
window.addEventListener('error', event => {
  const err = event.error as Error | undefined;
  console.error(
    '[SW-ERROR]', event.message,
    '| at', event.filename || '(no file)', event.lineno + ':' + event.colno,
    '| stack:', err?.stack ?? '(none)',
  );
});

window.addEventListener('unhandledrejection', event => {
  const reason = event.reason as { message?: string; stack?: string } | undefined;
  console.error(
    '[SW-REJECT]', reason?.message ?? String(event.reason),
    '| stack:', reason?.stack ?? '(none)',
  );
});


/**
 * Routing was added AROUND the existing app, not through it.
 *
 * App.tsx drives its own screens from a tab held in state, and has done
 * since before there was a router. Converting those tabs into routes would
 * touch every screen in the product to gain nothing a pilgrim would notice,
 * so "/" still renders App exactly as it did and the new routes sit beside
 * it:
 *
 *   /                the pilgrim app, unchanged
 *   /signup          account creation, which is a flow rather than a screen
 *   /finish-sign-in  where the second-factor email link lands
 *   /admin/*         the parish office
 *
 * BrowserRouter rather than HashRouter: the link Firebase emails has to
 * point at a real path on an authorised domain, and Capacitor serves the
 * Android build over http://localhost, where the history API works
 * normally.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignUpFlow />} />
        <Route path="/finish-sign-in" element={<FinishSignIn />} />
        <Route path="/admin/*" element={<AdminApp />} />
        {/* Everything else is the app: a catch-all rather than an exact "/"
            so any deep link the pilgrim app already understands still
            reaches it. */}
        {/* The spotlight lives inside the pilgrim app's route only. The
            parish office has no tutorial and no assistant, and a
            provider wrapping both would put a portal on the admin's
            document for no reason. */}
        <Route path="*" element={<SpotlightProvider><App /></SpotlightProvider>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

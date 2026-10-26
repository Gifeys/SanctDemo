package ph.edu.sti.sanctiwalk;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.Logger;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Handles the WebView's camera and microphone requests.
 *
 * Capacitor's own BridgeWebChromeClient crashes the app on these. It keeps a
 * single `permissionListener` field, sets it to a lambda that closes over the
 * PermissionRequest, and never clears it. Android then delivers the runtime
 * permission result twice - once through dispatchActivityResult, and again
 * through BridgeActivity.onRequestPermissionsResult, which forwards to the
 * ActivityResultRegistry - so that lambda runs twice against the same
 * request. Chromium allows grant() or deny() exactly once and throws
 * IllegalStateException on the second call, on the main thread, uncaught:
 *
 *   FATAL EXCEPTION: main
 *   java.lang.IllegalStateException: Either grant() or deny() has been
 *   already called.
 *       at com.getcapacitor.BridgeWebChromeClient.lambda$onPermissionRequest$2
 *
 * Which is what killed the app whenever the Rosary opened, because its glow
 * meter asks for the microphone (public/rosary/index.html, startMeter).
 *
 * So this bypasses that path entirely. Permission already held: grant at
 * once, no launcher involved. Not held: hand the request to MainActivity,
 * which asks and resolves it exactly once.
 */
public class SanctiWalkWebChromeClient extends BridgeWebChromeClient {

    private final Bridge bridge;

    public SanctiWalkWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    /**
     * Lets the voice bridge's own log lines out of a release build.
     *
     * Capacitor routes console.log through its Logger, which is silent
     * in a release build - so the diagnostics added for the Rosary's
     * microphone produced nothing at all in logcat, and the empty
     * capture looked like "the user never pressed the button" rather
     * than "this cannot be seen from here".
     *
     * Only SW-VOICE lines are forwarded. Everything else keeps
     * Capacitor's behaviour, so a release build does not start
     * narrating every console message in the app.
     *
     * This path has no automated test and cannot have one: there is no
     * WebView, no recogniser and no logcat in the test environment.
     */
    @Override
    public boolean onConsoleMessage(android.webkit.ConsoleMessage message) {
        String text = message.message();
        if (text != null && text.startsWith("SW-VOICE")) {
            android.util.Log.i("SW-VOICE", text);
        }
        return super.onConsoleMessage(message);
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        List<String> resources = Arrays.asList(request.getResources());
        List<String> required = new ArrayList<>();

        if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            required.add(Manifest.permission.CAMERA);
        }
        if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            required.add(Manifest.permission.RECORD_AUDIO);
        }

        // Anything else the page asks for (protected media, for instance) is
        // not an OS permission and needs no dialog.
        if (required.isEmpty()) {
            request.grant(request.getResources());
            return;
        }

        List<String> missing = new ArrayList<>();
        for (String permission : required) {
            if (ContextCompat.checkSelfPermission(bridge.getActivity(), permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }

        if (missing.isEmpty()) {
            request.grant(request.getResources());
            return;
        }

        if (bridge.getActivity() instanceof MainActivity) {
            ((MainActivity) bridge.getActivity()).requestWebViewPermissions(request, missing);
            return;
        }

        // Should not happen, but denying is recoverable and crashing is not:
        // the scanner offers manual station picking and the Rosary advances
        // on a tap, so both survive a refusal.
        Logger.warn("Denying a WebView permission request: activity is not MainActivity");
        request.deny();
    }
}

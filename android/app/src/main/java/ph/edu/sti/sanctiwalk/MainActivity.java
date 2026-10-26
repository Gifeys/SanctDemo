package ph.edu.sti.sanctiwalk;

import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.List;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    /** Our own request code, so Capacitor's plugin results are untouched. */
    private static final int WEBVIEW_MEDIA_PERMISSIONS = 4610;

    private PermissionRequest pendingRequest;
    private boolean pendingResolved = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Replace Capacitor's WebChromeClient, whose permission handling
        // takes the whole app down. See SanctiWalkWebChromeClient.
        getBridge().getWebView().setWebChromeClient(new SanctiWalkWebChromeClient(getBridge()));

        publishWindowInsets();
    }

    /**
     * Hands the system bar insets to CSS.
     *
     * The app's stylesheets are full of env(safe-area-inset-top), which
     * is the right thing on iOS and reports ZERO in the Android WebView -
     * Android never populates it. So every one of those rules evaluated
     * to no inset at all, and with targetSdk 36 the window is edge to
     * edge whether it likes it or not: the map's search bar, the
     * navigation banner and the Rosary's title were all drawn underneath
     * the clock and the signal bars, where they could not be tapped.
     *
     * targetSdk 35 could have opted out of edge to edge. 36 cannot - the
     * opt-out flag is ignored from Android 16 - so the insets have to be
     * measured and passed in rather than avoided.
     *
     * Published as --sw-inset-*, which index.css folds together with
     * env() so the same stylesheet stays correct on iOS and the web.
     */
    private void publishWindowInsets() {
        final android.webkit.WebView webView = getBridge().getWebView();

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            // The cutout as well as the bars: on a punch-hole phone the
            // camera sits outside the status bar's own height.
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());

            float density = getResources().getDisplayMetrics().density;
            final String js = String.format(
                Locale.US,
                "(function(){var s=document.documentElement.style;"
                    + "s.setProperty('--sw-inset-top','%dpx');"
                    + "s.setProperty('--sw-inset-bottom','%dpx');"
                    + "s.setProperty('--sw-inset-left','%dpx');"
                    + "s.setProperty('--sw-inset-right','%dpx');"
                    + "window.dispatchEvent(new Event('sanctiwalk:insets'));})()",
                Math.round(bars.top / density),
                Math.round(bars.bottom / density),
                Math.round(bars.left / density),
                Math.round(bars.right / density));

            // Insets arrive before the page has loaded, and again on
            // rotation. Re-applied each time rather than read once.
            view.post(() -> webView.evaluateJavascript(js, null));
            return windowInsets;
        });

        ViewCompat.requestApplyInsets(webView);
    }

    /**
     * Asks for the permissions a page needs and answers the page once.
     *
     * The single-resolution guard is the entire point: resolving a
     * PermissionRequest twice throws IllegalStateException on the main
     * thread, which is the crash this class exists to avoid.
     */
    void requestWebViewPermissions(PermissionRequest request, List<String> missing) {
        // A second page asking while the first dialog is still up: refuse the
        // newcomer rather than lose track of which request is outstanding.
        if (!pendingResolved) {
            request.deny();
            return;
        }

        pendingRequest = request;
        pendingResolved = false;
        ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), WEBVIEW_MEDIA_PERMISSIONS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == WEBVIEW_MEDIA_PERMISSIONS) {
            resolvePending(grantResults);
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    private void resolvePending(int[] grantResults) {
        if (pendingResolved || pendingRequest == null) return;
        pendingResolved = true;

        PermissionRequest request = pendingRequest;
        pendingRequest = null;

        boolean granted = grantResults.length > 0;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) granted = false;
        }

        if (granted) {
            request.grant(request.getResources());
        } else {
            // Both features degrade rather than break: the scanner falls back
            // to choosing a station by hand, and the Rosary says the
            // microphone is blocked and advances on a tap.
            request.deny();
        }
    }
}

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

        insetWebViewFromSystemBars();
    }

    /**
     * Keeps the page out from under the status and navigation bars.
     *
     * targetSdk 36 means the window is edge to edge and cannot opt out -
     * the flag that allowed it is ignored from Android 16 - so the web
     * content is laid out behind the clock and the signal bars unless
     * something insets it.
     *
     * This pads the WebView itself rather than publishing the insets as
     * CSS variables, which is what it did first. That version was
     * correct in principle and failed in practice for a reason worth
     * recording: the Rosary runs in an IFRAME, which is a separate
     * document that cannot see the host page's variables, so the fix
     * had to be forwarded to it by message and depended on a handshake
     * landing before the first paint. Padding the view needs none of
     * that - every document inside it, iframes included, simply starts
     * below the bars.
     *
     * The strip left behind shows the window background. Capacitor's
     * theme sets that from the splash background, which is the app's
     * own paper, so it reads as part of the page rather than a band.
     */
    private void insetWebViewFromSystemBars() {
        // The CONTENT view, not the WebView.
        //
        // The listener was on the WebView and never fired. Insets
        // travel down from the decor view and any parent may consume
        // them on the way; Capacitor's own layout sits in between, so
        // by the time they would have reached the WebView there was
        // nothing left to deliver. The app went on being drawn under
        // the clock and the fix looked like it had done nothing.
        //
        // android.R.id.content is the first view below the decor that
        // is ours, so nothing can have eaten the insets before it.
        final android.view.View content = findViewById(android.R.id.content);
        if (content == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            // The cutout as well as the bars: on a punch-hole phone the
            // camera sits outside the status bar's own height.
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());

            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);

            // Consumed, so nothing underneath applies them a second time
            // and pads the content twice.
            return WindowInsetsCompat.CONSUMED;
        });

        ViewCompat.requestApplyInsets(content);
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

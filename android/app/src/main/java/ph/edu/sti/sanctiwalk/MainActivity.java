package ph.edu.sti.sanctiwalk;

import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;

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

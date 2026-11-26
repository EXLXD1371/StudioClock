package com.studioclock.tablet;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.Collections;

/** Offline Vue host. Only bundled assets can access the narrow window-control bridge. */
public final class MainActivity extends ComponentActivity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView webView;
    private FrameLayout content;
    private SharedPreferences preferences;
    private volatile boolean fullScreen = true;
    private volatile boolean keepAwake = true;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences("studio-window", MODE_PRIVATE);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { handleBack(); }
        });
        keepAwake = preferences.getBoolean("keepAwake", true);
        applyKeepAwake();

        PackageInfo provider = WebView.getCurrentWebViewPackage();
        if (provider == null || majorVersion(provider.versionName) < 90) {
            TextView message = new TextView(this);
            message.setText(R.string.webview_update);
            message.setTextColor(Color.WHITE);
            message.setTextSize(20);
            message.setPadding(40, 60, 40, 40);
            setContentView(message);
            return;
        }

        content = new FrameLayout(this);
        content.setBackgroundColor(Color.rgb(9, 13, 16));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(9, 13, 16));
        content.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(content);
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                left = safe.left; top = safe.top; right = safe.right; bottom = safe.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            return insets;
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setTextZoom(100);
        webView.addJavascriptInterface(new ClockBridge(), "StudioClockAndroid");
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isLocal(request.getUrl())) {
                    WebResourceResponse response = assets.shouldInterceptRequest(request.getUrl());
                    if (response != null) return response;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public void onPageFinished(WebView view, String url) {
                emitFullscreen();
            }
        });
        applyFullscreen();
        webView.loadUrl("https://" + HOST + "/index.html");
    }

    private static int majorVersion(String version) {
        try { return Integer.parseInt(version.split("\\.")[0]); }
        catch (RuntimeException ignored) { return 0; }
    }
    private static boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }
    private void applyKeepAwake() {
        if (keepAwake) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    @SuppressWarnings("deprecation")
    private void applyFullscreen() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (fullScreen) controller.hide(WindowInsets.Type.systemBars());
                else controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(fullScreen
                ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                : View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
        if (content != null) content.requestApplyInsets();
        emitFullscreen();
    }
    private void emitFullscreen() {
        if (webView != null) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('studio-fullscreen',{detail:" + fullScreen + "}))", null);
    }
    private void handleBack() {
        if (webView == null) { moveTaskToBack(true); return; }
        webView.evaluateJavascript("typeof window.studioClockHandleBack === 'function' && window.studioClockHandleBack()", consumed -> {
            if (!"true".equals(consumed)) moveTaskToBack(true);
        });
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && webView != null) applyFullscreen();
    }
    @Override protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null);
        }
    }
    @Override protected void onDestroy() {
        if (webView != null) {
            content.removeView(webView);
            webView.removeJavascriptInterface("StudioClockAndroid");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public final class ClockBridge {
        @JavascriptInterface public boolean isFullscreen() { return fullScreen; }
        @JavascriptInterface public boolean isKeepScreenOn() { return keepAwake; }
        @JavascriptInterface public void setFullscreen(boolean enabled) {
            runOnUiThread(() -> { fullScreen = enabled; applyFullscreen(); });
        }
        @JavascriptInterface public void setKeepScreenOn(boolean enabled) {
            runOnUiThread(() -> {
                keepAwake = enabled;
                preferences.edit().putBoolean("keepAwake", enabled).apply();
                applyKeepAwake();
            });
        }
    }
}

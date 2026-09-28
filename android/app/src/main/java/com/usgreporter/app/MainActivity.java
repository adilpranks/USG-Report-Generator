package com.usgreporter.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * USG Reporter — WebView shell around the offline HTML report builder in assets.
 * Native share / clipboard / print (Save as PDF) are exposed to JS as window.AndroidBridge.
 */
public class MainActivity extends Activity {

    private WebView web;
    private WebView printView; // kept referenced until printing completes

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xFFF3F5F8);
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // settings, drafts and saved reports live in localStorage
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient()); // enables any native JS dialogs as a fallback
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__onBack && window.__onBack()", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void copy(final String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("USG report", text));
                Toast.makeText(MainActivity.this, "Report copied", Toast.LENGTH_SHORT).show();
            });
        }

        @JavascriptInterface
        public void share(final String text, final String title) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title);
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "Share report"));
            });
        }

        @JavascriptInterface
        public void print(final String html, final String title) {
            runOnUiThread(() -> {
                printView = new WebView(MainActivity.this);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        String job = title.replaceAll("[^A-Za-z0-9 _.-]", "_");
                        PrintDocumentAdapter ad = view.createPrintDocumentAdapter(job);
                        pm.print(job, ad, new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                    }
                });
                printView.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
            });
        }
    }
}

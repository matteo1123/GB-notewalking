package com.guitarbrain.notewalking;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GbRecorderPlugin.class);
        super.onCreate(savedInstanceState);
        // sign-in (Clerk) keeps its session in cookies on clerk.guitarbrain.org
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }
}

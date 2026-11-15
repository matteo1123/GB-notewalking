package com.guitarbrain.notewalking;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * The page's way to the phone (src/native/nativeApp.ts):
 *  - startScreen / stopScreen: record the real screen (ScreenRecordService)
 *  - openFile / appendFile / closeFile: write the page's own files (voice, session log) next to it
 *  - share: hand them all to the share sheet (Drive)
 * Everything lives in the app's Movies/Notewalking folder.
 */
@CapacitorPlugin(name = "GbRecorder")
public class GbRecorderPlugin extends Plugin {
    private PluginCall startCall;
    private File pendingFile;
    private final Map<String, FileOutputStream> open = new HashMap<>();
    private final Map<String, File> openFiles = new HashMap<>();
    private int nextId = 1;

    private File dir() {
        File base = getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        if (base == null) base = new File(getContext().getFilesDir(), "Movies");
        File d = new File(base, "Notewalking");
        //noinspection ResultOfMethodCallIgnored
        d.mkdirs();
        return d;
    }

    /** a plain file name (no folders) */
    private static String safe(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        return n.isEmpty() ? "notewalking-" + System.currentTimeMillis() : n;
    }

    /** Chrome hands the sign-in pass back here: com.guitarbrain.notewalking://signin?ticket=... */
    @Override
    public void load() {
        Intent first = getActivity().getIntent();
        if (first != null) takeTicket(first);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        takeTicket(intent);
    }

    private void takeTicket(Intent intent) {
        Uri u = intent.getData();
        if (u == null || !"com.guitarbrain.notewalking".equals(u.getScheme()) || !"signin".equals(u.getHost())) return;
        String ticket = u.getQueryParameter("ticket");
        if (ticket == null || ticket.isEmpty()) return;
        intent.setData(null);   // once
        JSObject r = new JSObject();
        r.put("ticket", ticket);
        notifyListeners("signinTicket", r, true);
    }

    /** Open a page in the phone's browser (Google sign-in won't run inside the app). */
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Not a web address");
            return;
        }
        Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(view);
        call.resolve();
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("screen", Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP);
        r.put("recording", ScreenRecordService.running != null);
        call.resolve(r);
    }

    @PluginMethod
    public void startScreen(PluginCall call) {
        if (ScreenRecordService.running != null) {
            call.reject("Already recording the screen");
            return;
        }
        MediaProjectionManager mpm = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(call, mpm.createScreenCaptureIntent(), "onProjection");
    }

    @ActivityCallback
    private void onProjection(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen recording wasn't allowed", "DENIED");
            return;
        }
        startCall = call;
        pendingFile = new File(dir(), "screen-" + System.currentTimeMillis() + ".mp4");
        ScreenRecordService.listener = new ScreenRecordService.Listener() {
            @Override
            public void started(long startedAt, int width, int height) {
                PluginCall c = startCall;
                startCall = null;
                if (c == null) return;
                JSObject r = new JSObject();
                r.put("startedAt", startedAt);
                r.put("width", width);
                r.put("height", height);
                c.resolve(r);
            }

            @Override
            public void failed(String message) {
                PluginCall c = startCall;
                startCall = null;
                if (c != null) c.reject(message, "FAILED");
            }

            @Override
            public void ended(String reason) {
                JSObject r = new JSObject();
                r.put("reason", reason);
                notifyListeners("screenEnded", r);
            }
        };
        Intent svc = ScreenRecordService.intent(getContext(), result.getResultCode(), result.getData(), pendingFile);
        ContextCompat.startForegroundService(getContext(), svc);
    }

    @PluginMethod
    public void stopScreen(PluginCall call) {
        ScreenRecordService svc = ScreenRecordService.running;
        String name = call.getString("name");
        File f;
        long startedAt;
        int w, h;
        boolean ok;
        if (svc != null) {
            startedAt = svc.startedAt();
            w = svc.width();
            h = svc.height();
            f = svc.file();
            ok = svc.finish();
        } else if (pendingFile != null && pendingFile.exists()) {
            // already stopped from the system's side: the file is still there
            f = pendingFile;
            startedAt = 0;
            w = h = 0;
            ok = f.length() > 0;
        } else {
            call.reject("Not recording the screen");
            return;
        }
        pendingFile = null;
        if (!ok) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
            call.reject("The screen recording is empty");
            return;
        }
        if (name != null) {
            File to = new File(dir(), safe(name));
            if (f.renameTo(to)) f = to;
        }
        JSObject r = new JSObject();
        r.put("path", f.getAbsolutePath());
        r.put("name", f.getName());
        r.put("bytes", f.length());
        r.put("startedAt", startedAt);
        r.put("width", w);
        r.put("height", h);
        call.resolve(r);
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        try {
            File f = new File(dir(), safe(call.getString("name")));
            String id = String.valueOf(nextId++);
            open.put(id, new FileOutputStream(f, false));
            openFiles.put(id, f);
            JSObject r = new JSObject();
            r.put("id", id);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't save the file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void appendFile(PluginCall call) {
        FileOutputStream out = open.get(call.getString("id"));
        if (out == null) {
            call.reject("File isn't open");
            return;
        }
        try {
            out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't save the file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void closeFile(PluginCall call) {
        String id = call.getString("id");
        FileOutputStream out = open.remove(id);
        File f = openFiles.remove(id);
        if (out == null || f == null) {
            call.reject("File isn't open");
            return;
        }
        try {
            out.close();
            JSObject r = new JSObject();
            r.put("path", f.getAbsolutePath());
            r.put("bytes", f.length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't save the file: " + e.getMessage());
        }
    }

    /** The share sheet with all the files (pick Drive, then the inbox folder). */
    @PluginMethod
    public void share(PluginCall call) {
        try {
            JSArray paths = call.getArray("paths");
            ArrayList<Uri> uris = new ArrayList<>();
            String auth = getContext().getPackageName() + ".fileprovider";
            for (int i = 0; i < paths.length(); i++) {
                File f = new File(paths.getString(i));
                if (f.exists()) uris.add(FileProvider.getUriForFile(getContext(), auth, f));
            }
            if (uris.isEmpty()) {
                call.reject("Nothing to share");
                return;
            }
            Intent send = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
            send.setType("*/*");
            if (uris.size() == 1) send.putExtra(Intent.EXTRA_STREAM, uris.get(0));
            else send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            ClipData clip = ClipData.newRawUri("recording", uris.get(0));
            for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
            send.setClipData(clip);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            String title = call.getString("title", "Notewalking recording");
            send.putExtra(Intent.EXTRA_SUBJECT, title);
            Intent chooser = Intent.createChooser(send, "Send the recording");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open the share sheet: " + e.getMessage());
        }
    }

    /** Remove files (a discarded recording). */
    @PluginMethod
    public void remove(PluginCall call) {
        try {
            JSArray paths = call.getArray("paths");
            String root = dir().getAbsolutePath();
            for (int i = 0; i < paths.length(); i++) {
                File f = new File(paths.getString(i));
                //noinspection ResultOfMethodCallIgnored
                if (f.getAbsolutePath().startsWith(root)) f.delete();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}

package com.guitarbrain.notewalking;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import java.io.File;

/**
 * Records the phone's screen into an MP4 (video only: the page records the voice and the
 * app's sound itself, so the microphone is never fought over). MediaProjection needs a
 * foreground service, which is also what keeps the recording going if the screen dims.
 */
public class ScreenRecordService extends Service {
    private static final String TAG = "NotewalkingScreen";
    private static final String CHANNEL = "notewalking-recording";
    private static final int NOTE_ID = 4417;

    /** What the plugin hears back. */
    interface Listener {
        void started(long startedAt, int width, int height);
        void failed(String message);
        void ended(String reason);
    }

    static Listener listener;
    static volatile ScreenRecordService running;

    private MediaProjection projection;
    private VirtualDisplay display;
    private MediaRecorder recorder;
    private File file;
    private long startedAt;
    private int width, height;
    private boolean stopping;
    private final Handler main = new Handler(Looper.getMainLooper());

    static Intent intent(Context ctx, int resultCode, Intent data, File out) {
        Intent i = new Intent(ctx, ScreenRecordService.class);
        i.putExtra("code", resultCode);
        i.putExtra("data", data);
        i.putExtra("file", out.getAbsolutePath());
        return i;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // Android 14: the foreground service must be running before the projection is made
        Notification note = notification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTE_ID, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NOTE_ID, note);
            }
        } catch (Exception e) {
            fail("The recording couldn't start (" + e.getMessage() + ")");
            return START_NOT_STICKY;
        }
        int code = intent.getIntExtra("code", Activity.RESULT_CANCELED);
        Intent data = intent.getParcelableExtra("data");
        file = new File(intent.getStringExtra("file"));
        try {
            MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
            projection = mpm.getMediaProjection(code, data);
            if (projection == null) throw new IllegalStateException("no permission to record the screen");
            projection.registerCallback(new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    // stopped from the system (the notification, the status-bar chip, a lock)
                    if (!stopping) main.post(() -> {
                        finish();
                        if (listener != null) listener.ended("stopped");
                    });
                }
            }, main);
            begin(1920);
        } catch (Exception first) {
            Log.w(TAG, "1920 failed, trying 1280", first);
            try {
                releaseRecorder();
                begin(1280);
            } catch (Exception e) {
                fail("The screen couldn't be recorded (" + e.getMessage() + ")");
                return START_NOT_STICKY;
            }
        }
        running = this;
        if (listener != null) listener.started(startedAt, width, height);
        return START_NOT_STICKY;
    }

    /** The screen at its own shape, its long side at most `longSide` pixels. */
    private void begin(int longSide) throws Exception {
        DisplayMetrics m = new DisplayMetrics();
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        int w, h;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.graphics.Rect b = wm.getCurrentWindowMetrics().getBounds();
            w = b.width();
            h = b.height();
        } else {
            wm.getDefaultDisplay().getRealMetrics(m);
            w = m.widthPixels;
            h = m.heightPixels;
        }
        int dpi = getResources().getDisplayMetrics().densityDpi;
        float s = Math.min(1f, longSide / (float) Math.max(w, h));
        width = even(Math.round(w * s));
        height = even(Math.round(h * s));

        recorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new MediaRecorder(this) : new MediaRecorder();
        recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        recorder.setVideoSize(width, height);
        recorder.setVideoFrameRate(30);
        recorder.setVideoEncodingBitRate(longSide >= 1920 ? 6_000_000 : 4_000_000);
        recorder.setOutputFile(file.getAbsolutePath());
        recorder.prepare();
        if (display == null) {
            display = projection.createVirtualDisplay("notewalking-recording", width, height, Math.round(dpi * s),
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, recorder.getSurface(), null, null);
        } else {
            display.resize(width, height, Math.round(dpi * s));
            display.setSurface(recorder.getSurface());
        }
        recorder.start();
        startedAt = System.currentTimeMillis();
    }

    private static int even(int v) {
        return v - (v % 2);
    }

    /** Stop and keep the file; true if it holds a video. */
    boolean finish() {
        stopping = true;
        boolean ok = true;
        try {
            if (recorder != null) recorder.stop();
        } catch (Exception e) {
            ok = false;   // stopped before a single frame
            Log.w(TAG, "stop", e);
        }
        releaseRecorder();
        if (display != null) display.release();
        display = null;
        if (projection != null) projection.stop();
        projection = null;
        running = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        return ok && file != null && file.length() > 0;
    }

    long startedAt() { return startedAt; }
    int width() { return width; }
    int height() { return height; }
    File file() { return file; }

    private void releaseRecorder() {
        if (recorder != null) {
            try { recorder.reset(); } catch (Exception ignored) { }
            recorder.release();
        }
        recorder = null;
    }

    private void fail(String msg) {
        Log.e(TAG, msg);
        releaseRecorder();
        if (display != null) display.release();
        display = null;
        if (projection != null) projection.stop();
        projection = null;
        running = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        if (listener != null) listener.failed(msg);
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Recording", NotificationManager.IMPORTANCE_LOW));
        }
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pi = android.app.PendingIntent.getActivity(this, 0, open,
                android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return b.setContentTitle("Notewalking is recording the screen")
                .setContentText("Stop it in Notewalking to save the video")
                .setSmallIcon(android.R.drawable.presence_video_online)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        if (!stopping && (recorder != null || projection != null)) finish();
        super.onDestroy();
    }
}

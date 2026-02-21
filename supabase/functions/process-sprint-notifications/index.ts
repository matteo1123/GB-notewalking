import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

serve(async (req) => {
  try {
    // Authenticate the request (it should come from Supabase Cron, which we can verify via a secret header or just trust anon if no sensitive data is leaked, 
    // but passing a service role key in the cron definition is best practice).

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@guitarbrain.org";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("Missing VAPID keys!");
      return new Response("Server error: Missing VAPID keys", { status: 500 });
    }

    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://guitarbrain.org";

    // 1. Fetch all active sprints
    const { data: sprints, error: sprintsError } = await supabase
      .from("sprints")
      .select("*, push_subscriptions:user_id(subscription)")
      .eq("status", "active");

    if (sprintsError) {
      throw sprintsError;
    }

    if (!sprints || sprints.length === 0) {
      return new Response("No active sprints found.", { status: 200 });
    }

    let sentCount = 0;
    let errorCount = 0;

    // 2. Process each sprint
    for (const sprint of sprints) {
      // Simplified logic: If the cron runs every 4 hours, we just send a notification.
      // A more robust system would check when the last session was logged today,
      // or calculate exact times based on user timezone and 'sessions_per_day'.
      // For v1.0, let's just blast a notification to them if they have an active sprint.

      const subscriptions = sprint.push_subscriptions as any[];

      if (!subscriptions || subscriptions.length === 0) {
        continue; // User hasn't enabled push notifications
      }

      const payload = JSON.stringify({
        title: "Sprint Time! 🎸",
        body: `Time for your 2-minute ${sprint.module_type} focus session!`,
        url: `${frontendUrl}/practice/sprint/${sprint.id}`
      });

      // Send to all their registered devices
      for (const subRecord of subscriptions) {
        try {
          await webpush.sendNotification(subRecord.subscription, payload);
          sentCount++;
        } catch (err: any) {
          console.error("Error sending push to subscription:", err);
          errorCount++;
          // If the subscription is gone/expired (410, 404), we should probably delete it from the DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('subscription->>endpoint', subRecord.subscription.endpoint);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      errors: errorCount
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error processing sprints:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

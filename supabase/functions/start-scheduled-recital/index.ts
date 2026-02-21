import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header");

        const supabaseAnon = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabaseAnon.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { scheduleId } = await req.json();
        if (!scheduleId) throw new Error("Missing scheduleId");

        // Use service role for atomic idempotent operation
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Atomically claim the schedule row (prevents concurrent auto-starts)
        const { data: schedule, error: claimErr } = await supabase
            .from("recital_schedule")
            .update({ auto_started: true })
            .eq("id", scheduleId)
            .eq("auto_started", false)  // only succeeds if not already started
            .select()
            .single();

        if (claimErr || !schedule) {
            // Another client already started it — return the existing active recital
            const { data: existing } = await supabase
                .from("recitals")
                .select("*")
                .eq("schedule_id", scheduleId)
                .eq("status", "active")
                .single();

            if (existing) {
                return new Response(
                    JSON.stringify({ recital: existing, alreadyStarted: true }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            throw new Error("Schedule not found or already started");
        }

        // Create Daily.co room by calling our own edge function internally
        const dailyApiKey = Deno.env.get("DAILY_API_KEY");
        if (!dailyApiKey) throw new Error("DAILY_API_KEY not configured");

        const roomName = `recital-${Date.now()}`;
        const expiresAt = Math.floor(Date.now() / 1000) + 4 * 60 * 60;

        const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${dailyApiKey}`,
            },
            body: JSON.stringify({
                name: roomName,
                properties: {
                    exp: expiresAt,
                    enable_chat: false,
                    start_video_off: true,
                    start_audio_off: true,
                    max_participants: 100,
                },
            }),
        });

        if (!dailyRes.ok) {
            const err = await dailyRes.text();
            // Roll back auto_started so it can be retried
            await supabase
                .from("recital_schedule")
                .update({ auto_started: false })
                .eq("id", scheduleId);
            throw new Error(`Daily.co API error: ${err}`);
        }

        const room = await dailyRes.json();

        // Insert the recital row
        const { data: recital, error: insertErr } = await supabase
            .from("recitals")
            .insert({
                created_by: user.id,
                schedule_id: scheduleId,
                status: "active",
                daily_room_url: room.url,
                daily_room_name: room.name,
            })
            .select()
            .single();

        if (insertErr) throw new Error(insertErr.message);

        return new Response(
            JSON.stringify({ recital, alreadyStarted: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

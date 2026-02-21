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

        // Validate user and check admin role
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();

        if (roleData?.role !== "admin") throw new Error("Admin only");

        // Create Daily.co room
        const dailyApiKey = Deno.env.get("DAILY_API_KEY");
        if (!dailyApiKey) throw new Error("DAILY_API_KEY not configured");

        const roomName = `recital-${Date.now()}`;
        const expiresAt = Math.floor(Date.now() / 1000) + 4 * 60 * 60; // 4 hours

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
                    enable_chat: false,       // we handle chat ourselves
                    start_video_off: true,    // all participants start with video off
                    start_audio_off: true,
                    max_participants: 100,
                },
            }),
        });

        if (!dailyRes.ok) {
            const err = await dailyRes.text();
            throw new Error(`Daily.co API error: ${err}`);
        }

        const room = await dailyRes.json();

        return new Response(
            JSON.stringify({ url: room.url, name: room.name }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

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

        const { recitalId } = await req.json();
        if (!recitalId) throw new Error("Missing recitalId");

        // Use service role for atomic update (bypasses RLS for the combined operation)
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Check admin role
        const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();

        // Also allow if the caller IS the current performer (auto-advance when timer expires)
        const { data: recital } = await supabase
            .from("recitals")
            .select("*")
            .eq("id", recitalId)
            .eq("status", "active")
            .single();

        if (!recital) throw new Error("Active recital not found");

        const isAdmin = roleData?.role === "admin";
        const isCurrentPerformer = recital.current_performer_id === user.id;

        if (!isAdmin && !isCurrentPerformer) {
            throw new Error("Only admin or current performer can advance");
        }

        // Mark current performer as done (if any)
        if (recital.current_performer_id) {
            await supabase
                .from("recital_queue")
                .update({ performed_at: new Date().toISOString() })
                .eq("recital_id", recitalId)
                .eq("user_id", recital.current_performer_id)
                .is("performed_at", null);
        }

        // Find next ready user in queue order (joined_at asc, not yet performed, not video_banned)
        const { data: nextEntry } = await supabase
            .from("recital_queue")
            .select("*")
            .eq("recital_id", recitalId)
            .eq("ready", true)
            .eq("video_banned", false)
            .is("performed_at", null)
            .neq("user_id", recital.current_performer_id ?? "")
            .order("joined_at", { ascending: true })
            .limit(1)
            .single();

        const nextPerformerId = nextEntry?.user_id ?? null;
        const now = new Date().toISOString();

        const { data: updated } = await supabase
            .from("recitals")
            .update({
                current_performer_id: nextPerformerId,
                performer_slot_started_at: nextPerformerId ? now : null,
            })
            .eq("id", recitalId)
            .select()
            .single();

        return new Response(
            JSON.stringify({ recital: updated, nextPerformerId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

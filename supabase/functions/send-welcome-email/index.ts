import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Support both webhook format (from database trigger) and direct invocation
    const { record, email: directEmail } = payload;
    const email = record?.email || directEmail;
    const subscriberId = record?.id;

    if (!email) {
      throw new Error("No email found in payload");
    }

    console.log(`Processing welcome email for: ${email}`);

    // Update database to mark as fulfilled
    if (subscriberId) {
      const { error: dbError } = await supabase
        .from("email_subscribers")
        .update({ fulfilled: true })
        .eq("id", subscriberId);
      
      if (dbError) {
        console.error("DB Update error:", dbError);
      }
    } else if (email) {
      const { error: dbError } = await supabase
        .from("email_subscribers")
        .update({ fulfilled: true })
        .eq("email", email);
      
      if (dbError) {
        console.error("DB Update error:", dbError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      email: email,
      message: "Subscriber marked as fulfilled"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

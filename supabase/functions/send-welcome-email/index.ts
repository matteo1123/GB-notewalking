import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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
    const { record } = payload; // Webhook payload from email_subscribers INSERT
    const email = record.email;
    const subscriberId = record.id;

    if (!email) {
      throw new Error("No email found in payload");
    }

    const { data, error: resendError } = await resend.emails.send({
      from: "Matthew from Guitar Brain <matt@guitarbrain.org>",
      to: [email],
      subject: "Your Hitting Chord Tones PDF (and a personal note)",
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <p>Hi, and thank you for signing up!</p>
          
          <p>I’m actually very excited to say that you are one of my first sign-ups. I just put this site live a couple of days ago and I’m still figuring things out, so this is a huge milestone for me.</p>
          
          <p>As a thank you for being an early adopter, I want to invite you to try the full app for free for 30 days. I’ve attached the resource below aimed at making chord tones as easy as humanly possible. It will definitely help, but the <strong>NoteWalking</strong> module in the app is really the "secret weapon" for building this skill quickly.</p>

          <p><strong>Download your PDF here:</strong><br />
          <a href="https://idsufbsfywgmcrhldqxq.supabase.co/storage/v1/object/public/other/Guitarbrain%20Chord%20tones.pdf" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-top: 10px;">Hitting Chord Tones PDF</a></p>

          <p>I'm very serious about making this the best possible platform for helping people skill up on guitar as fast as possible. The system isn't really "ready" for paying customers yet because I'm still perfecting it, so please enjoy the 30-day free trial on me once you create an account.</p>

          <p>Please let me know if you have any suggestions, feedback, or requests. It's definitely still a work in progress, and I'd love to hear from you.</p>

          <p>Nice to meet you,<br />
          <strong>Matthew Semroska</strong><br />
          Developer, Guitar Brain</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">To get your 30-day trial, just create an account on <a href="https://guitarbrain.org/auth">guitarbrain.org</a> using this email address. The trial will be applied automatically.</p>
        </div>
      `,
    });

    if (resendError) {
      console.error("Resend error:", resendError);
      return new Response(JSON.stringify({ error: resendError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update database to mark as fulfilled
    if (subscriberId) {
      const { error: dbError } = await supabase
        .from("email_subscribers")
        .update({ fulfilled: true })
        .eq("id", subscriberId);
      
      if (dbError) {
        console.error("DB Update error:", dbError);
      }
    }

    return new Response(JSON.stringify(data), {
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

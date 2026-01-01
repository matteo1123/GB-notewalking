import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
});
const frontendUrl = Deno.env.get("FRONTEND_URL") || "";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("Function called. Method:", req.method);

        // 1. Authenticate user
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("Missing Authorization header");
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("User not authenticated");
        }

        console.log("User authenticated:", user.id);

        // 2. Get Request Body (Price ID)
        let priceId;
        try {
            const body = await req.json();
            console.log("Request body received:", body);
            priceId = body.priceId;
        } catch (e) {
            console.error("Failed to parse request body:", e);
            throw new Error("Invalid JSON body");
        }

        if (!priceId) {
            console.error("Missing Price ID in body");
            throw new Error("Missing Price ID");
        }

        console.log("Price ID:", priceId);

        // Check Stripe Key
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
            console.error("STRIPE_SECRET_KEY is missing in environment variables");
            throw new Error("Server misconfiguration: Stripe key missing");
        }

        console.log("Using Frontend URL:", frontendUrl);
        if (!frontendUrl || !frontendUrl.startsWith("http")) {
            console.error("FRONTEND_URL is invalid or missing:", frontendUrl);
            throw new Error("Server misconfiguration: Invalid FRONTEND_URL");
        }

        // 3. Get or Create Stripe Customer
        // Check if user already has a stripe_customer_id in profiles
        const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", user.id)
            .single();

        let customerId = profile?.stripe_customer_id;
        console.log("Existing Customer ID:", customerId);

        if (!customerId) {
            console.log("Creating new Stripe customer...");
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id,
                },
            });
            customerId = customer.id;
            console.log("Created Customer ID:", customerId);

            // Save customer ID to profile
            await supabase
                .from("profiles")
                .update({ stripe_customer_id: customerId })
                .eq("id", user.id);
        }

        // 4. Create Checkout Session
        console.log("Creating Checkout Session...");
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${frontendUrl}/premium?success=true`,
            cancel_url: `${frontendUrl}/premium?canceled=true`,
        });

        console.log("Session created:", session.id);

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        console.error("Error in prepare-checkout-session:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

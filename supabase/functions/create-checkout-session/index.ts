import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
});
const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://guitarbrain.org";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
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

        // 2. Get Request Body (Price ID, mode, metadata)
        let priceId, subscriptionPriceId, mode, metadata;
        try {
            const body = await req.json();
            priceId = body.priceId;
            subscriptionPriceId = body.subscriptionPriceId;
            mode = body.mode || "subscription";
            metadata = body.metadata || {};
        } catch (e) {
            throw new Error("Invalid JSON body");
        }

        if (!priceId) {
            throw new Error("Missing Price ID");
        }

        // Check Stripe Key
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
            console.error("STRIPE_SECRET_KEY is missing");
            throw new Error("Server misconfiguration");
        }

        if (!frontendUrl || !frontendUrl.startsWith("http")) {
            console.error("FRONTEND_URL is invalid:", frontendUrl);
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

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id,
                },
            });
            customerId = customer.id;

            // Save customer ID to profile
            await supabase
                .from("profiles")
                .update({ stripe_customer_id: customerId })
                .eq("id", user.id);
        }

        // 4. Create Checkout Session
        const isCoursePurchase = metadata.type === 'course_purchase' && subscriptionPriceId;

        const lineItems = isCoursePurchase ? [
            // The ongoing subscription
            {
                price: subscriptionPriceId,
                quantity: 1,
            },
            // The one-time course fee
            {
                price: priceId,
                quantity: 1,
            }
        ] : [
            {
                price: priceId,
                quantity: 1,
            }
        ];

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            customer: customerId,
            line_items: lineItems,
            mode: isCoursePurchase ? 'subscription' : (mode as Stripe.Checkout.SessionCreateParams.Mode),
            success_url: `${frontendUrl}/premium?success=true`,
            cancel_url: `${frontendUrl}/premium?canceled=true`,
        };

        if (isCoursePurchase) {
            sessionParams.subscription_data = {
                trial_period_days: 90,
                metadata: metadata
            };
        }

        // Attach metadata to the session if provided (useful for webhooks)
        if (Object.keys(metadata).length > 0) {
            sessionParams.metadata = metadata;
            if (!isCoursePurchase) {
                // Also attach it to the resulting subscription/payment intent so the webhook can see it
                if (mode === 'subscription') {
                    sessionParams.subscription_data = { metadata };
                } else if (mode === 'payment') {
                    sessionParams.payment_intent_data = { metadata };
                }
            }
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
});

// Admin client to write to profiles without RLS restrictions
const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
    try {
        const signature = req.headers.get("Stripe-Signature");
        const body = await req.text();
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");

        if (!webhookSecret) {
            throw new Error("Missing STRIPE_WEBHOOK_SIGNING_SECRET");
        }

        let event;
        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature!,
                webhookSecret,
                undefined,
                cryptoProvider
            );
        } catch (err) {
            console.error(`⚠️  Webhook signature verification failed.`, err.message);
            return new Response(err.message, { status: 400 });
        }

        console.log(`Processing event: ${event.type}`);

        switch (event.type) {
            case "checkout.session.completed":
                // Fired when a checkout session completes (subscription or one-time payment)
                const session = event.data.object;
                if (session.metadata && session.metadata.type === 'course_purchase') {
                    await handleCoursePurchase(session);
                } else {
                    await handleSubscriptionUpdate(session);
                }
                break;

            case "customer.subscription.updated":
            case "customer.subscription.deleted":
                // Fired when subscription renews, cancels, expands, etc.
                const subscription = event.data.object;
                await handleSubscriptionChange(subscription);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err) {
        console.error(err);
        return new Response(
            JSON.stringify({ error: err.message }),
            {
                headers: { "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});

async function handleCoursePurchase(session: any) {
    const customerId = session.customer;

    // We need the user's Supabase ID via the stripe_customer_id
    if (customerId) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("id, premium_until")
            .eq("stripe_customer_id", customerId)
            .single();

        if (profile) {
            const userId = profile.id;

            // 1. Calculate new premium_until date (add 90 days)
            const now = new Date();
            const currentPremium = profile.premium_until ? new Date(profile.premium_until) : now;
            const baseDate = currentPremium > now ? currentPremium : now;

            const newPremiumDate = new Date(baseDate);
            newPremiumDate.setDate(newPremiumDate.getDate() + 90);

            // Update profile with new premium duration
            await supabase
                .from("profiles")
                .update({
                    premium_until: newPremiumDate.toISOString(),
                    is_premium: true
                })
                .eq("id", userId);

            // 2. Enroll user in course
            // Check if already enrolled to prevent duplicates
            const { data: existingEnrollment } = await supabase
                .from("course_enrollments")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (!existingEnrollment) {
                await supabase
                    .from("course_enrollments")
                    .insert({
                        user_id: userId,
                        source: 'stripe_one_time',
                        status: 'verified'
                    });
            } else {
                // If they had a pending enrollment, verify it
                await supabase
                    .from("course_enrollments")
                    .update({ status: 'verified', source: 'stripe_one_time' })
                    .eq("id", existingEnrollment.id);
            }
        }
    }
}

async function handleSubscriptionUpdate(session: any) {
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    if (customerId && subscriptionId) {
        // Fetch subscription details to get the period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000); // Stripe is seconds

        await supabase
            .from("profiles")
            .update({
                stripe_subscription_id: subscriptionId,
                subscription_status: 'active',
                premium_until: currentPeriodEnd.toISOString(),
                is_premium: true // Keep this for backward compatibility if needed, or remove
            })
            .eq("stripe_customer_id", customerId);
    }
}

async function handleSubscriptionChange(subscription: any) {
    const customerId = subscription.customer;
    const status = subscription.status;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // If active or trialing, they are premium until the period ends
    // If canceled, they remain premium until period ends (which Stripe handles via current_period_end)
    // If unpaid, maybe revoke immediately? For now, trust period end.

    // Logic: Always trust current_period_end from Stripe for access duration

    await supabase
        .from("profiles")
        .update({
            subscription_status: status,
            premium_until: currentPeriodEnd.toISOString(),
            is_premium: status === 'active' || status === 'trialing'
        })
        .eq("stripe_customer_id", customerId);
}

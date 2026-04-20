import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

// Stripe webhook receiver. Register the URL
//   <convex-deployment-url>/stripe/webhook
// in the Stripe dashboard, copy the signing secret it gives you, and set
//   STRIPE_WEBHOOK_SECRET   on the Convex deployment.
http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const sig = request.headers.get('stripe-signature');
    if (!sig) return new Response('Missing signature', { status: 400 });

    const rawBody = await request.text();
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia',
    });

    let event: import('stripe').Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      console.error('Stripe webhook signature failed', err);
      return new Response('Bad signature', { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await ctx.runMutation(internal.purchases.markSessionPaid, {
        stripeSessionId: session.id,
        amount: session.amount_total ?? undefined,
      });
    }

    return new Response('ok', { status: 200 });
  }),
});

export default http;

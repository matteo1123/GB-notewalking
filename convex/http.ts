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
      // Convex HTTP actions run in a V8 isolate without Node's sync crypto;
      // Stripe's sync constructEvent throws "SubtleCryptoProvider cannot be
      // used in a synchronous context" here. The async variant uses WebCrypto.
      event = await stripe.webhooks.constructEventAsync(
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

// Content pipeline -> creator brief. The pipeline sends
//   Authorization: Bearer <PIPELINE_TOKEN>
// where PIPELINE_TOKEN is set on the Convex deployment and in the pipeline's
// .env. Body: { date, pillar, topic, hook, points: string[], demo }.
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

http.route({
  path: '/pipeline/brief',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.PIPELINE_TOKEN ?? '';
    const auth = request.headers.get('authorization') ?? '';
    if (!sameSecret(auth.replace(/^Bearer\s+/i, ''), expected)) {
      return new Response('Unauthorized', { status: 401 });
    }
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response('Body must be JSON', { status: 400 });
    }
    const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '');
    const points = Array.isArray(body.points) ? body.points.filter((p): p is string => typeof p === 'string') : [];
    const brief = {
      date: str('date'),
      pillar: str('pillar'),
      topic: str('topic'),
      hook: str('hook'),
      points: points.slice(0, 5),
      demo: str('demo'),
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(brief.date) || !brief.hook || brief.points.length === 0) {
      return new Response('Need date (YYYY-MM-DD), hook and points', { status: 400 });
    }
    await ctx.runMutation(internal.creator.upsertBrief, brief);
    return new Response(JSON.stringify({ ok: true, date: brief.date }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

export default http;

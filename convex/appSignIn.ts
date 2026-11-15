import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';

// Google won't show its sign-in inside an app's web view, so the Android app signs in
// through Chrome: the person signs in there as usual, Chrome asks this for a one-time
// pass (a Clerk sign-in token) for that same account, and hands it back to the app,
// which signs in with it (src/native/AppSignIn.tsx). The pass is good for two minutes, once.
export const ticket = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Sign in first.');
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) throw new ConvexError("The app's sign-in needs CLERK_SECRET_KEY on the Convex deployment.");
    const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: identity.subject, expires_in_seconds: 120 }),
    });
    if (!res.ok) throw new ConvexError(`Clerk refused the sign-in pass (${res.status}).`);
    const body = (await res.json()) as { token?: string };
    if (!body.token) throw new ConvexError('Clerk sent no sign-in pass.');
    return body.token;
  },
});

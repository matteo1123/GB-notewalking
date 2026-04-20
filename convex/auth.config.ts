// Tells Convex to accept JWTs minted by Clerk. The CLERK_JWT_ISSUER_DOMAIN
// env var must be set on the Convex deployment to your Clerk Frontend API URL
// (e.g. https://yourapp.clerk.accounts.dev or your custom Clerk domain).
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
  ],
};

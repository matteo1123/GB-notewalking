import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const convexUrl = (import.meta.env.VITE_CONVEX_URL as string | undefined)?.replace(/\/$/, '');

if (!clerkPublishableKey) {
  // Surfacing this loudly during build/preview is intentional — silently
  // shipping with auth disabled would let unsigned users skip the paywall.
  console.error('VITE_CLERK_PUBLISHABLE_KEY is not set');
}
if (!convexUrl) {
  console.error('VITE_CONVEX_URL is not set');
}

const convex = new ConvexReactClient(convexUrl ?? 'https://invalid.convex.cloud');

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={clerkPublishableKey ?? ''}>
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </ClerkProvider>,
);

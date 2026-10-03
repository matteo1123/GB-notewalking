import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Public legal pages. Linked from the welcome page footer and from the
// Google OAuth consent screen (required for the YouTube publishing app).
// Keep them accurate to what the app actually does: if a tracker, processor
// or data flow changes, change these pages in the same commit.

const UPDATED = 'October 2, 2026';
const CONTACT = 'matthew.semroska@gmail.com';

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10 leading-relaxed text-[15px] [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_li]:my-1 [&_a]:text-primary [&_a]:underline">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        {children}
        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link> ·{' '}
          <Link to="/">Guitar Brain</Link>
        </p>
      </article>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        Guitar Brain ("we", "us") is a web app for learning the guitar fretboard at guitarbrain.org. This policy
        explains what information we collect, how we use it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in, our authentication provider (Clerk) gives us your
          email address and an account identifier.
        </li>
        <li>
          <strong>Learning progress.</strong> The skill-tree nodes you've unlocked and your XP, so your progress
          follows you between devices. Some preferences are also kept in your browser's local storage.
        </li>
        <li>
          <strong>Purchases.</strong> Payments are processed by Stripe. We receive a record that you paid (and the
          amount); your card details go to Stripe, never to us.
        </li>
        <li>
          <strong>Usage analytics.</strong> We use Google Analytics and the Meta (Facebook) Pixel to understand
          which pages are visited and to measure our advertising. These services set cookies and receive
          information such as pages viewed, browser and device type, and approximate location.
        </li>
      </ul>

      <h2>Microphone, camera and recordings</h2>
      <p>
        Pitch detection uses your microphone. The audio is analysed in your browser and is not uploaded to us. If you
        use the optional recording feature, the screen, camera and microphone are recorded in your browser and the
        files stay on your device. They are only sent anywhere if you choose to download or share them yourself
        (for example to YouTube or Google Drive), and that sharing is governed by the service you share to.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the app: sign-in, saving progress, and unlocking what you've purchased.</li>
        <li>To understand usage and improve the app, and to measure advertising.</li>
        <li>To contact you about your account or purchase when needed.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Service providers</h2>
      <p>
        We rely on: Clerk (sign-in), Convex (database), Stripe (payments), Cloudflare (hosting), Google Analytics and
        the Meta Pixel (analytics and advertising measurement). Each processes data under its own privacy policy.
      </p>

      <h2>YouTube and Google API Services</h2>
      <p>
        Guitar Brain uses YouTube API Services to publish Guitar Brain's own practice videos to Guitar Brain's own
        YouTube channel, and to read that channel's analytics. This uses Google account access granted by the Guitar
        Brain channel owner only; the app does not request access to students' Google or YouTube accounts. Data
        received from Google APIs is used only to publish and measure our own videos, is stored only as needed for
        that (video ids, links and view statistics), and is not shared or sold. Our use of information received from
        Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <p>
        See the{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Google Privacy Policy
        </a>{' '}
        for how Google handles data. Access granted to Guitar Brain can be revoked at any time at{' '}
        <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noreferrer">
          Google security settings
        </a>
        .
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep account, progress and purchase records while your account exists. To delete your account and data,
        email us and we'll remove it, except records we must keep for tax or payment purposes.
      </p>

      <h2>Children</h2>
      <p>Guitar Brain is not directed to children under 13, and we don't knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we'll update this page and the date above.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These terms govern your use of Guitar Brain at guitarbrain.org. By using the app, you agree to them.
      </p>

      <h2>Your account</h2>
      <p>
        You're responsible for activity on your account and for keeping your sign-in secure. Please give accurate
        information when you sign up.
      </p>

      <h2>Purchases</h2>
      <p>
        Guitar Brain is sold as a one-time purchase that unlocks the full app for your account, with no subscription.
        Payments are processed by Stripe. If something's wrong with your purchase, contact us.
      </p>

      <h2>License</h2>
      <p>
        We grant you a personal, non-transferable license to use Guitar Brain for your own learning. Please don't
        copy, resell or redistribute the app or its lesson content, or try to bypass access controls.
      </p>

      <h2>Your recordings</h2>
      <p>
        Recordings you make with the app are yours. If you share them to other services, those services' terms apply.
      </p>

      <h2>YouTube</h2>
      <p>
        Guitar Brain publishes its own videos using YouTube API Services. Where YouTube is involved, the{' '}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
          YouTube Terms of Service
        </a>{' '}
        also apply.
      </p>

      <h2>No warranty</h2>
      <p>
        Guitar Brain is provided "as is". We work to keep it running and accurate but can't guarantee it will always
        be available or error-free. To the extent the law allows, we aren't liable for indirect or consequential
        losses from using it, and our total liability is limited to what you paid us.
      </p>

      <h2>Changes</h2>
      <p>
        We may update the app and these terms. If the terms change materially, we'll update this page and the date
        above; continuing to use the app means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </LegalShell>
  );
}

# Guitar Brain - Agent Documentation

This document contains technical details for AI agents working on this project.

## Email Configuration

### Email List Welcome Emails

The `send-welcome-email` Supabase Edge Function handles sending welcome emails to new email list subscribers.

**Current Status:**
- Edge function is deployed and marks subscribers as `fulfilled` in the database
- Email sending requires an external email service API (SendGrid recommended)

**Recommended Solution: SendGrid**

SendGrid offers a reliable HTTP API that works perfectly in Supabase Edge Functions:
- Free tier: 100 emails/day
- Simple fetch() API call (no SMTP complexity)
- Reliable delivery

**Setup Instructions:**

1. **Sign up for SendGrid:**
   - Go to https://sendgrid.com/
   - Create a free account
   - Verify your sender email (matt@guitarbrain.org)
   - Create an API key with "Mail Send" permissions

2. **Set Supabase Secrets:**
   ```bash
   supabase secrets set SENDGRID_API_KEY="SG.xxxxx" --project-ref idsufbsfywgmcrhldqxq
   ```

3. **Update the Edge Function** to use SendGrid (see code below)

**Alternative: Zoho**

Zoho Mail is primarily SMTP-based which is difficult in edge functions. Options:
1. Use Zoho's REST API (requires OAuth 2.0 setup - complex)
2. Use a relay service like SendGrid/Amazon SES with your Zoho domain
3. Set up a small Node.js server to handle SMTP

**Recommended: Stick with SendGrid for reliability.**

---

## SendGrid Integration Code

To enable SendGrid, update `supabase/functions/send-welcome-email/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmailViaSendGrid(to: string, subject: string, htmlBody: string): Promise<void> {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "matt@guitarbrain.org", name: "Matthew from Guitar Brain" },
      subject: subject,
      content: [{ type: "text/html", value: htmlBody }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid error: ${error}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { record, email: directEmail } = payload;
    const email = record?.email || directEmail;
    const subscriberId = record?.id;

    if (!email) {
      throw new Error("No email found in payload");
    }

    console.log(`Sending welcome email to: ${email}`);

    // Send email via SendGrid if configured
    if (sendgridApiKey) {
      const htmlBody = `...your HTML email content...`;
      await sendEmailViaSendGrid(email, "Your Hitting Chord Tones PDF (and a personal note)", htmlBody);
      console.log(`Email sent successfully via SendGrid to: ${email}`);
    } else {
      console.log(`SendGrid not configured, email not sent to: ${email}`);
    }

    // Mark as fulfilled in database
    if (subscriberId) {
      await supabase.from("email_subscribers").update({ fulfilled: true }).eq("id", subscriberId);
    } else if (email) {
      await supabase.from("email_subscribers").update({ fulfilled: true }).eq("email", email);
    }

    return new Response(JSON.stringify({ success: true }), {
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
```

---

## How Email Signup Works

1. **User submits email** via form in `src/pages/Course.tsx` (the "Free PDF" modal)
2. **Frontend** inserts into `email_subscribers` table and calls edge function:
   ```typescript
   supabase.functions.invoke('send-welcome-email', { body: { email } })
   ```
3. **Edge function** sends email via email service API and marks subscriber as `fulfilled`

---

## Supabase Edge Functions

### Deployment

```bash
# Deploy specific function
supabase functions deploy send-welcome-email --project-ref idsufbsfywgmcrhldqxq

# Deploy all functions
supabase functions deploy --project-ref idsufbsfywgmcrhldqxq

# View logs
supabase functions logs send-welcome-email --project-ref idsufbsfywgmcrhldqxq
```

### Local Development

```bash
# Serve function locally
supabase functions serve send-welcome-email
```

---

## Project Structure

```
supabase/
├── functions/           # Supabase Edge Functions
│   ├── send-welcome-email/    # Email welcome function
│   ├── create-checkout-session/
│   └── ...
├── migrations/          # Database migrations
└── config.toml         # Supabase configuration
```

---

## Dependencies

### Frontend (Node.js)
- React 18 + TypeScript
- Vite build system
- TailwindCSS + shadcn/ui
- Supabase JS client

### Edge Functions (Deno)
- Deno standard library
- Supabase JS client via esm.sh

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Guitar Brain - Agent Documentation

This document contains technical details for AI agents working on this project.

## Email Configuration

### Email List Welcome Emails (Zoho SMTP)

The `send-welcome-email` Supabase Edge Function handles sending welcome emails to new email list subscribers.

**Technology Stack:**
- Uses Zoho SMTP (migrated from Resend)
- Denomailer library for SMTP in Deno
- SMTP over SSL on port 465

**Required Environment Variables:**

```bash
# Supabase Edge Function Secrets (set via Supabase dashboard or CLI)
ZOHO_SMTP_PASSWORD=<your_zoho_app_specific_password>

# Optional - defaults to matt@guitarbrain.org if not set
ZOHO_SMTP_USERNAME=matt@guitarbrain.org

# Existing Supabase secrets (already configured)
SUPABASE_URL=<supabase_project_url>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>
```

**Setting Environment Variables:**

```bash
# Using Supabase CLI
supabase secrets set ZOHO_SMTP_PASSWORD="your-app-specific-password"

# Verify secrets
supabase secrets list
```

**How to Generate Zoho App-Specific Password:**
1. Log into Zoho Mail at mail.zoho.com
2. Go to My Account → Security → App Passwords
3. Generate a new app-specific password for "Guitar Brain SMTP"
4. Use this password (not your main Zoho password) for ZOHO_SMTP_PASSWORD

**Email Function Location:**
- File: `supabase/functions/send-welcome-email/index.ts`
- Trigger: Database webhook on `email_subscribers` table INSERT
- Config: `supabase/config.toml` → `[functions.send-welcome-email]`

**Migration Notes:**
- Previously used Resend API (npm:resend@2.0.0)
- Migrated to Zoho SMTP on March 17, 2026
- Resend API key (RESEND_API_KEY) is no longer needed

---

## Supabase Edge Functions

### Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy send-welcome-email

# Deploy with specific Supabase project
supabase functions deploy --project-ref idsufbsfywgmcrhldqxq
```

### Local Development

```bash
# Start Supabase local stack
supabase start

# Serve function locally for testing
supabase functions serve send-welcome-email
```

---

## Database Webhooks

The `send-welcome-email` function is triggered by a database webhook:
- Table: `email_subscribers`
- Event: INSERT
- Webhook URL: `https://idsufbsfywgmcrhldqxq.supabase.co/functions/v1/send-welcome-email`

Webhook configuration is in Supabase Dashboard → Database → Webhooks.

---

## Project Structure

```
supabase/
├── functions/           # Supabase Edge Functions
│   ├── send-welcome-email/    # Email welcome function (Zoho SMTP)
│   ├── create-checkout-session/
│   ├── stripe-webhook/
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
- Denomailer for SMTP (send-welcome-email only)

# SMS Sender

SMS sender app with Twilio + Supabase + React.

## Setup

1. **Supabase**: Create project, run `schema.sql`
2. **Twilio**: Get Account SID, Auth Token, Phone Number
3. **Install**: `npm install`
4. **Configure**: Add env vars to Vercel
5. **Deploy**: `vercel`

## Environment Variables

Add these in Vercel dashboard:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

## Local Development

```bash
npm install
cp .env.example .env
# Fill in .env
npm run dev
```

## Deploy to Vercel

```bash
vercel
```

Or connect GitHub repo to Vercel.

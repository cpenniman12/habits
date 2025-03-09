# Habits - Development Guide

This document contains specific instructions for setting up and working with the development environment for the Habits application.

## Getting Started

1. Clone the repository:
```
git clone https://github.com/cpenniman12/habits.git
cd habits
```

2. Switch to the development branch:
```
git checkout development
```

3. Install dependencies:
```
npm install
```

4. Create a local environment file:
```
cp .env.local.example .env
```

5. Configure your `.env` file with your development credentials.

6. Start the development server:
```
npm run dev
```

## Development Features

The development branch includes several features to make local development easier:

### Debug Logging

We use the `debug` package for detailed logging. To see logs:

```
# On Linux/Mac
DEBUG=habits:* npm run dev

# On Windows
set DEBUG=habits:* & npm run dev

# Or use the script
npm run debug
```

### Test Endpoints

The development environment includes additional testing endpoints:

- `/test-email`: Sends a test email to verify email configuration

### Mail Testing

For testing emails locally:

1. Use a development SendGrid API key
2. If you need to test links in emails:
   - Install ngrok: `npm install -g ngrok`
   - Start your app: `npm run dev`
   - In another terminal, run: `ngrok http 3000`
   - Update your `.env` file's `PUBLIC_APP_URL` with the ngrok URL (e.g., https://1234-your-ngrok-url.ngrok.io)

### Scheduled Tasks

By default, cron jobs are disabled in development to avoid unwanted emails. To enable them for testing:

```
# Add to your .env file
ENABLE_CRON=true
```

## Working with Branches

### Development Workflow

1. Make changes in the development branch
2. Test thoroughly in your local environment
3. When ready for production, merge to main branch:

```
git checkout main
git merge development
git push origin main
```

4. Render will automatically deploy changes from the main branch

### Creating Feature Branches

For larger features, create branch from development:

```
git checkout development
git pull
git checkout -b feature/your-feature-name
```

## Testing

There are no automated tests yet, but manual testing should be done for:

1. Creating new challenges
2. Accepting challenges
3. Daily check-ins
4. Streak counting
5. Email delivery

## Common Issues

### Email Links Not Working Locally

If email links don't work when testing locally, ensure your `PUBLIC_APP_URL` is properly set. For local testing with working links, you'll need to use a tool like ngrok.

### Supabase Connection Issues

If you have trouble connecting to Supabase, verify:
1. Your Supabase URL and key are correct in `.env`
2. Your IP is allowed in Supabase's security settings
3. The tables exist in your Supabase project

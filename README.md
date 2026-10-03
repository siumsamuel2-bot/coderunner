# Coderunner

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Overview

Coderunner is an AI app-building speedrun platform where developers race through identical prompts to build apps. The platform tracks verified completion times and ranks them on a global leaderboard.

## Features Implemented (Phase 2)

- **Chapters Page**: List all available challenges with filtering and search
- **Challenge Detail Page**: View challenge description and submit solutions
- **Run Submission API**: API endpoint for submitting solution URLs
- **Verification Integration**: API endpoint to trigger verification harness
- **Leaderboard Page**: View top runs for each challenge
- **User Authentication**: Auth.js integration for user sessions
- **Dashboard**: Personal dashboard showing user's runs and statistics
- **Verification Webhook**: Endpoint to receive verification results from harness

## Challenges Available

1. Calculator - Build a working calculator app
2. Todo app with auth - Build a todo app with user login and CRUD operations
3. PDF analyzer - Build a tool that extracts text and metadata from PDFs
4. Landing page that converts - Build a marketing landing page
5. Chatbot - Build a simple chatbot UI

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup

This project uses Prisma with SQLite. To set up the database:

```bash
npx prisma migrate dev
npx prisma db seed
```

## API Routes

- `POST /api/runs` - Submit a new run
- `GET /api/runs` - Get runs (with optional filtering)
- `POST /api/verify` - Trigger verification for a run
- `POST /api/verification-webhook` - Receive verification results from harness
- `POST /api/auth/[...nextauth]` - Authentication endpoints

## Next Steps

To complete the MVP, the following would need to be implemented:

1. Background worker process to handle verification harness execution
2. Solution deployment mechanism (for local development testing)
3. Enhanced verification result handling
4. Real-time updates using WebSockets or server-sent events
5. Improved UI/UX for the verification process
6. Admin panel for managing challenges and users
import { Webhook } from 'svix';
import { prisma } from '@/lib/prisma';

// Clerk user sync webhook (SPE-123). Keeps the Prisma User table in step with
// Clerk identities. Auth: svix signature via CLERK_WEBHOOK_SECRET (configured
// in the Clerk dashboard -> Webhooks -> Signing secret).

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET is not configured');
    return Response.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const payload = await request.text();
  const wh = new Webhook(secret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent;
  } catch (error) {
    console.error('[clerk-webhook] signature verification failed:', error);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const { type, data } = event;
  const email =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      ?.email_address?.toLowerCase() ??
    data.email_addresses?.[0]?.email_address?.toLowerCase() ??
    null;
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(' ') || email?.split('@')[0] || null;

  try {
    switch (type) {
      case 'user.created':
      case 'user.updated': {
        await prisma.user.upsert({
          where: { clerkId: data.id },
          update: {
            email,
            name,
            image: data.image_url || null,
            emailVerified: email ? new Date() : null,
          },
          create: {
            clerkId: data.id,
            email,
            name,
            image: data.image_url || null,
            emailVerified: email ? new Date() : null,
          },
        });
        break;
      }
      case 'user.deleted': {
        if (data.id) {
          await prisma.user.deleteMany({ where: { clerkId: data.id } });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`[clerk-webhook] failed to process ${type}:`, error);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }

  return Response.json({ received: true }, { status: 200 });
}

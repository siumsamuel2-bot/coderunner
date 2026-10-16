import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.warn(
    "CLERK_WEBHOOK_SECRET not configured - Clerk webhook endpoint disabled"
  );
}

export async function POST(request: Request) {
  try {
    const secret = WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 }
      );
    }

    const payload = await request.json();
    const headersList = await headers();
    const svixId = headersList.get("svix-id");
    const svixTimestamp = headersList.get("svix-timestamp");
    const svixSignature = headersList.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const wh = new Webhook(secret);
    let evt: { type: string; data: Record<string, unknown> };
    try {
      evt = wh.verify(JSON.stringify(payload), {
        "svix-id": svixId!,
        "svix-timestamp": svixTimestamp!,
        "svix-signature": svixSignature!,
      }) as unknown as { type: string; data: Record<string, unknown> };
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const { type, data } = evt;

    switch (type) {
      case "user.created": {
        const clerkUser = data as {
          id: string;
          email_addresses: Array<{
            email_address: string;
            primary: boolean;
          }>;
          first_name: string | null;
          last_name: string | null;
          image_url: string | null;
          public_metadata: Record<string, unknown>;
        };

        const primaryEmail = clerkUser.email_addresses.find((e) => e.primary);
        if (!primaryEmail) {
          console.error("User created without primary email:", clerkUser.id);
          return NextResponse.json(
            { error: "No primary email" },
            { status: 400 }
          );
        }

        await prisma.user.upsert({
          where: { clerkId: clerkUser.id },
          create: {
            clerkId: clerkUser.id,
            email: primaryEmail.email_address.toLowerCase(),
            name:
              [clerkUser.first_name, clerkUser.last_name]
                .filter(Boolean)
                .join(" ") || primaryEmail.email_address.split("@")[0],
            image: clerkUser.image_url,
            emailVerified: new Date(),
          },
          update: {
            email: primaryEmail.email_address.toLowerCase(),
            name:
              [clerkUser.first_name, clerkUser.last_name]
                .filter(Boolean)
                .join(" ") || primaryEmail.email_address.split("@")[0],
            image: clerkUser.image_url,
          },
        });
        break;
      }

      case "user.updated": {
        const clerkUser = data as {
          id: string;
          email_addresses: Array<{
            email_address: string;
            primary: boolean;
          }>;
          first_name: string | null;
          last_name: string | null;
          image_url: string | null;
        };

        const primaryEmail = clerkUser.email_addresses.find((e) => e.primary);
        if (!primaryEmail) {
          console.error("User updated without primary email:", clerkUser.id);
          return NextResponse.json(
            { error: "No primary email" },
            { status: 400 }
          );
        }

        await prisma.user.update({
          where: { clerkId: clerkUser.id },
          data: {
            email: primaryEmail.email_address.toLowerCase(),
            name:
              [clerkUser.first_name, clerkUser.last_name]
                .filter(Boolean)
                .join(" ") || primaryEmail.email_address.split("@")[0],
            image: clerkUser.image_url,
          },
        });
        break;
      }

      case "user.deleted": {
        const clerkUser = data as { id: string };
        await prisma.user.delete({
          where: { clerkId: clerkUser.id },
        });
        break;
      }

      default:
        console.log(`Unhandled Clerk webhook type: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
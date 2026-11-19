import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const CATEGORIES = ['general', 'bug', 'challenge-idea', 'praise'] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, message, email, page } = body ?? {};

    if (typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }
    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'message is too long (max 5000 chars)' },
        { status: 400 }
      );
    }
    const safeCategory = CATEGORIES.includes(category) ? category : 'general';
    if (
      email !== undefined &&
      email !== null &&
      email !== '' &&
      (typeof email !== 'string' || email.length > 320)
    ) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        category: safeCategory,
        message: message.trim(),
        email: email?.trim() || null,
        page: typeof page === 'string' ? page.slice(0, 500) : null,
      },
    });

    return NextResponse.json({ id: feedback.id }, { status: 201 });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

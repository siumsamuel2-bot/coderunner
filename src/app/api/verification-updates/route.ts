
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      { error: "runId query parameter is required" },
      { status: 400 }
    );
  }

  // Verify the run exists and belongs to the user
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return NextResponse.json(
      { error: "Run not found" },
      { status: 404 }
    );
  }

  if (run.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection established message
      controller.enqueue(
        'data: ' + JSON.stringify({ type: 'connected', runId }) + '\n\n'
      );

      // Poll for changes to the run
      let lastStatus = run.status;
      let lastUpdatedAt = run.updatedAt;

      while (true) {
        try {
          // Check for updates
          const currentRun = await prisma.run.findUnique({
            where: { id: runId },
            select: {
              id: true,
              status: true,
              updatedAt: true,
              elapsedMs: true,
              endedAt: true,
            },
          });

          if (currentRun) {
            // Check if status or updatedAt has changed
            if (
              currentRun.status !== lastStatus ||
              currentRun.updatedAt > lastUpdatedAt
            ) {
              // Send update
              controller.enqueue(
                'data: ' + JSON.stringify({
                  type: 'update',
                  run: {
                    id: currentRun.id,
                    status: currentRun.status,
                    elapsedMs: currentRun.elapsedMs,
                    endedAt: currentRun.endedAt,
                    updatedAt: currentRun.updatedAt,
                  }
                }) + '\n\n'
              );

              lastStatus = currentRun.status;
              lastUpdatedAt = currentRun.updatedAt;
            }
          }

          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error('Error in SSE stream:', error);
          controller.enqueue(
            'data: ' + JSON.stringify({ type: 'error', message: 'Internal server error' }) + '\n\n'
          );
          break;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

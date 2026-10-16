
import { NextResponse } from "next/server";
import { processVerificationJobs } from "@/lib/verification/queue";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? "";
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const job = await processVerificationJobs();
    if (!job) {
      return NextResponse.json({ message: "No pending verification jobs" });
    }
    return NextResponse.json({ message: `Processed verification job ${job.id}` });
  } catch (error) {
    console.error("Verification cron job failed:", error);
    return NextResponse.json(
      { error: "Verification job processing failed" },
      { status: 500 }
    );
  }
}

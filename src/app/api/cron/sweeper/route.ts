import { NextResponse } from "next/server";
import {
  PaperclipConfigError,
  runScopeCheck,
  sweepStaleLocks,
} from "@/lib/paperclip";

/**
 * App-level fallback sweeper for stale execution-run locks (SPE-100).
 *
 * POST /api/cron/sweeper                    — run a sweep
 * POST /api/cron/sweeper?check_scope=true   — verify executionRunId can be cleared
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Feature flags:
 *  - SWEEPER_ENABLED=true  — master switch; anything else skips the sweep
 *  - SWEEPER_SHADOW=true   — log-only mode (DEFAULT). Mutations require
 *                            SWEEPER_SHADOW=false explicitly after shadow logs
 *                            have been reviewed (board rollout condition).
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[sweeper] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const checkScope = searchParams.get("check_scope") === "true";
  const enabled = process.env.SWEEPER_ENABLED === "true";
  // Shadow mode is the default; mutations require an explicit opt-out.
  const shadow = process.env.SWEEPER_SHADOW !== "false";

  if (!enabled) {
    return NextResponse.json(
      { skipped: true, reason: "SWEEPER_ENABLED is not true" },
      { status: 200 }
    );
  }

  try {
    if (checkScope) {
      const result = await runScopeCheck();
      console.log("[sweeper] scope check:", result.detail);
      return NextResponse.json({ scopeCheck: result }, { status: 200 });
    }

    const result = await sweepStaleLocks({ shadow });
    console.log(
      `[sweeper] sweep complete: checked=${result.checkedIssues} ` +
        `stale=${result.stale.length} released=${result.released.length} ` +
        `errors=${result.errors.length} shadow=${shadow}`
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof PaperclipConfigError) {
      console.error("[sweeper] misconfigured:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("[sweeper] sweep failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

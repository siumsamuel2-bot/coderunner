/**
 * Paperclip control-plane client + stale execution-lock sweeper (SPE-100).
 *
 * Board-approved temporary fallback that releases stale executionRunId locks
 * at the application level until the platform fix (SPE-89) ships.
 *
 * Thresholds (board conditions):
 *  - queued for more than 2h, OR
 *  - running for more than 24h, OR
 *  - stale heartbeat (agent heartbeat older than 5 min).
 *
 * NOTE on threshold fidelity: the public Paperclip API does not expose a runs
 * endpoint (probed: /api/runs*, /api/agents/{id}/runs, /api/companies/{id}/runs
 * all 404). Staleness is therefore derived from fields that ARE exposed:
 *  - "running > 24h"  -> issue.executionLockedAt older than 24h
 *                        (executionLockedAt is set when the run takes the lock,
 *                         so it is a lower bound on run start time);
 *  - "stale heartbeat" -> agent.lastHeartbeatAt older than 5 min;
 *  - "queued > 2h"    -> executionLockedAt older than 2h AND the agent has not
 *                        heartbeated at all since the lock was taken
 *                        (lastHeartbeatAt < executionLockedAt), i.e. the queued
 *                        run never actually started on the agent.
 */

const PAPERCLIP_API_URL = () => process.env.PAPERCLIP_API_URL ?? "";
const PAPERCLIP_API_KEY = () => process.env.PAPERCLIP_API_KEY ?? "";
const PAPERCLIP_COMPANY_ID = () => process.env.PAPERCLIP_COMPANY_ID ?? "";

export const SWEEPER_QUEUED_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h
export const SWEEPER_RUNNING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h
export const SWEEPER_HEARTBEAT_THRESHOLD_MS = 5 * 60 * 1000; // 5min

/** Issue statuses that can carry an executionRunId lock worth sweeping. */
const LOCKED_ISSUE_STATUSES = ["in_progress", "todo", "blocked", "in_review"];

export interface PaperclipIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  assigneeAgentId: string | null;
  executionRunId: string | null;
  executionLockedAt: string | null;
  updatedAt: string;
}

export interface PaperclipAgent {
  id: string;
  name: string;
  status: string;
  lastHeartbeatAt: string | null;
}

export type StaleReason =
  | "queued_over_2h"
  | "running_over_24h"
  | "stale_heartbeat_over_5m";

export interface StaleFinding {
  issue: PaperclipIssue;
  reasons: StaleReason[];
}

export interface SweepResult {
  shadow: boolean;
  checkedIssues: number;
  stale: StaleFinding[];
  released: { issueId: string; identifier: string; ok: boolean; status: number }[];
  errors: string[];
}

export class PaperclipConfigError extends Error {}

function requireConfig(): { baseUrl: string; apiKey: string; companyId: string } {
  const baseUrl = PAPERCLIP_API_URL();
  const apiKey = PAPERCLIP_API_KEY();
  const companyId = PAPERCLIP_COMPANY_ID();
  const missing: string[] = [];
  if (!baseUrl) missing.push("PAPERCLIP_API_URL");
  if (!apiKey) missing.push("PAPERCLIP_API_KEY");
  if (!companyId) missing.push("PAPERCLIP_COMPANY_ID");
  if (missing.length > 0) {
    throw new PaperclipConfigError(
      `Missing required env vars for sweeper: ${missing.join(", ")}`
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, companyId };
}

async function paperclipFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ status: number; data: T }> {
  const { baseUrl, apiKey } = requireConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data: data as T };
}

/** Fetch all company issues that currently hold an executionRunId lock. */
export async function listLockedIssues(): Promise<PaperclipIssue[]> {
  const { companyId } = requireConfig();
  const { status, data } = await paperclipFetch<PaperclipIssue[]>(
    `/api/companies/${companyId}/issues?status=${LOCKED_ISSUE_STATUSES.join(",")}`
  );
  if (status !== 200 || !Array.isArray(data)) {
    throw new Error(`Failed to list issues (HTTP ${status})`);
  }
  return data.filter(
    (i) => typeof i.executionRunId === "string" && i.executionRunId.length > 0
  );
}

export async function getAgent(agentId: string): Promise<PaperclipAgent> {
  const { status, data } = await paperclipFetch<PaperclipAgent>(
    `/api/agents/${agentId}`
  );
  if (status !== 200) {
    throw new Error(`Failed to fetch agent ${agentId} (HTTP ${status})`);
  }
  return data;
}

/**
 * Clear the executionRunId lock on an issue via the existing issue endpoint.
 * This is the mutation the sweeper performs once shadow mode is verified.
 */
export async function releaseExecutionLock(
  issueId: string
): Promise<{ ok: boolean; status: number }> {
  const { status } = await paperclipFetch(`/api/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify({ executionRunId: null }),
  });
  return { ok: status >= 200 && status < 300, status };
}

/** Evaluate board-approved staleness thresholds against an issue + its agent. */
export function evaluateStaleness(
  issue: PaperclipIssue,
  agent: PaperclipAgent | null,
  now: Date
): StaleReason[] {
  const reasons: StaleReason[] = [];
  const lockedAt = issue.executionLockedAt
    ? new Date(issue.executionLockedAt)
    : null;
  const heartbeatAt =
    agent?.lastHeartbeatAt != null ? new Date(agent.lastHeartbeatAt) : null;
  const nowMs = now.getTime();

  if (lockedAt && nowMs - lockedAt.getTime() > SWEEPER_RUNNING_THRESHOLD_MS) {
    // Lock held > 24h: run has been "running" past the running threshold.
    reasons.push("running_over_24h");
  }
  if (heartbeatAt && nowMs - heartbeatAt.getTime() > SWEEPER_HEARTBEAT_THRESHOLD_MS) {
    reasons.push("stale_heartbeat_over_5m");
  }
  if (
    lockedAt &&
    nowMs - lockedAt.getTime() > SWEEPER_QUEUED_THRESHOLD_MS &&
    // Queued proxy: the agent has not heartbeated since the lock was taken,
    // meaning the queued run never started executing on the agent.
    (heartbeatAt == null || heartbeatAt.getTime() < lockedAt.getTime())
  ) {
    reasons.push("queued_over_2h");
  }
  return reasons;
}

const log = (...args: unknown[]) => console.log("[sweeper]", ...args);
const logError = (...args: unknown[]) => console.error("[sweeper]", ...args);

/**
 * Sweep for stale executionRunId locks. In shadow mode every release action is
 * logged but never executed.
 */
export async function sweepStaleLocks(options: {
  shadow: boolean;
}): Promise<SweepResult> {
  const result: SweepResult = {
    shadow: options.shadow,
    checkedIssues: 0,
    stale: [],
    released: [],
    errors: [],
  };

  const issues = await listLockedIssues();
  result.checkedIssues = issues.length;
  log(
    `sweeping ${issues.length} locked issue(s) (shadow=${options.shadow})`
  );

  const agentCache = new Map<string, PaperclipAgent | null>();
  const now = new Date();

  for (const issue of issues) {
    let agent: PaperclipAgent | null = null;
    if (issue.assigneeAgentId) {
      if (!agentCache.has(issue.assigneeAgentId)) {
        try {
          agentCache.set(issue.assigneeAgentId, await getAgent(issue.assigneeAgentId));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`agent lookup failed for ${issue.assigneeAgentId}: ${msg}`);
          logError(`agent lookup failed for ${issue.assigneeAgentId}: ${msg}`);
          agentCache.set(issue.assigneeAgentId, null);
        }
      }
      agent = agentCache.get(issue.assigneeAgentId) ?? null;
    }

    const reasons = evaluateStaleness(issue, agent, now);
    if (reasons.length === 0) continue;

    result.stale.push({ issue, reasons });
    const staleMsg = `stale lock on ${issue.identifier} (${issue.id}): ${reasons.join(", ")} — ` +
      `lockedAt=${issue.executionLockedAt} agentLastHeartbeat=${agent?.lastHeartbeatAt ?? "unknown"}`;

    if (options.shadow) {
      log(`[shadow] would release ${staleMsg}`);
      continue;
    }

    log(`releasing ${staleMsg}`);
    try {
      const res = await releaseExecutionLock(issue.id);
      result.released.push({
        issueId: issue.id,
        identifier: issue.identifier,
        ok: res.ok,
        status: res.status,
      });
      if (res.ok) {
        log(`released lock on ${issue.identifier}`);
      } else {
        result.errors.push(`release failed for ${issue.identifier}: HTTP ${res.status}`);
        logError(`release failed for ${issue.identifier}: HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`release error for ${issue.identifier}: ${msg}`);
      logError(`release error for ${issue.identifier}: ${msg}`);
    }
  }

  return result;
}

export interface ScopeCheckResult {
  canClearLock: boolean | "unverified_no_stale_candidate";
  detail: string;
  verifiedIssue?: { id: string; identifier: string; httpStatus: number };
}

/**
 * Board condition 3: before enabling mutations, prove the sweeper can clear
 * executionRunId through the existing PATCH /api/issues/{id} endpoint.
 *
 * If a genuinely stale lock exists, the scope check performs the real release
 * on the first stale candidate (which is the intended mutation anyway). If no
 * stale candidate exists, it reports the capability as unverified rather than
 * touching a healthy lock.
 */
export async function runScopeCheck(): Promise<ScopeCheckResult> {
  const issues = await listLockedIssues();
  const now = new Date();
  const agentCache = new Map<string, PaperclipAgent | null>();

  for (const issue of issues) {
    let agent: PaperclipAgent | null = null;
    if (issue.assigneeAgentId) {
      if (!agentCache.has(issue.assigneeAgentId)) {
        try {
          agentCache.set(issue.assigneeAgentId, await getAgent(issue.assigneeAgentId));
        } catch {
          agentCache.set(issue.assigneeAgentId, null);
        }
      }
      agent = agentCache.get(issue.assigneeAgentId) ?? null;
    }

    const reasons = evaluateStaleness(issue, agent, now);
    if (reasons.length === 0) continue;

    log(
      `[scope-check] attempting real release on stale candidate ${issue.identifier} ` +
        `(${issue.id}), reasons: ${reasons.join(", ")}`
    );
    const res = await releaseExecutionLock(issue.id);
    if (res.ok) {
      log(`[scope-check] PATCH executionRunId=null accepted for ${issue.identifier}`);
      return {
        canClearLock: true,
        detail:
          "PATCH /api/issues/{issueId} with executionRunId: null accepted; " +
          `cleared stale lock on ${issue.identifier} (reasons: ${reasons.join(", ")}).`,
        verifiedIssue: { id: issue.id, identifier: issue.identifier, httpStatus: res.status },
      };
    }
    return {
      canClearLock: false,
      detail:
        `PATCH /api/issues/{issueId} with executionRunId: null returned HTTP ${res.status} ` +
        `for stale issue ${issue.identifier}. Sweeper cannot clear the lock via this endpoint.`,
      verifiedIssue: { id: issue.id, identifier: issue.identifier, httpStatus: res.status },
    };
  }

  return {
    canClearLock: "unverified_no_stale_candidate",
    detail:
      "No stale lock currently exists to verify against; refusing to mutate a " +
      "healthy lock. Re-run ?check_scope=true when a stale candidate appears.",
  };
}

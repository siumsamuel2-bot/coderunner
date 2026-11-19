import { useEffect, useState } from 'react';

interface RunStatusUpdate {
  id: string;
  status: string;
  elapsedMs: number | null;
  endedAt: Date | null;
  updatedAt: Date;
  failureReason: string | null;
  verificationStatus: string | null;
}

/**
 * Hook to subscribe to verification updates for a specific run using Server-Sent Events
 */
export function useVerificationUpdates(runId: string | null) {
  const [runStatus, setRunStatus] = useState<RunStatusUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalSeen, setTerminalSeen] = useState(false);

  // Derived: we are "loading" while a run is tracked but no status/error yet.
  const loading = runId !== null && runStatus === null && error === null;

  useEffect(() => {
    if (!runId) return;

    const eventSource = new EventSource(
      '/api/verification-updates?runId=' + encodeURIComponent(runId)
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update' && data.run) {
          const { status } = data.run;
          const isTerminal = status === 'verified' || status === 'failed';

          // Once a terminal state is seen, ignore non-terminal updates
          // to prevent flipping back to 'Verifying...' after 'Failed'.
          if (terminalSeen && !isTerminal) return;

          if (isTerminal) setTerminalSeen(true);

          setRunStatus({
            id: data.run.id,
            status: data.run.status,
            elapsedMs: data.run.elapsedMs ?? null,
            endedAt: data.run.endedAt ? new Date(data.run.endedAt) : null,
            updatedAt: new Date(data.run.updatedAt),
            failureReason: data.run.failureReason ?? null,
            verificationStatus: data.run.verificationStatus ?? null,
          });
        }
        if (data.type === 'error') {
          setError(data.message);
        }
      } catch (parseError) {
        console.error('Error parsing SSE data:', parseError, event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setError('Connection error');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [runId, terminalSeen]);

  return { runStatus, loading, error };
}

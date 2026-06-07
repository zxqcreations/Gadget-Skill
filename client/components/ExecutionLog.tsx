import React, { useEffect, useRef, useState } from 'react';
import { fetchExecution, fetchExecutionLog } from '../lib/api';

interface Props {
  executionId: string;
  autoConnect?: boolean;
}

export default function ExecutionLog({ executionId, autoConnect = false }: Props) {
  const [lines, setLines] = useState<{ text: string; stream: 'stdout' | 'stderr' | 'info' }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (!autoConnect || !executionId) return;

    let cancelled = false;

    async function loadLog() {
      try {
        // First, check execution status
        const execRes = await fetchExecution(executionId);
        if (!execRes.success || !execRes.data) return;

        const exec = execRes.data;
        setStatus(exec.status);

        // Fetch the full log
        const logRes = await fetchExecutionLog(executionId);
        if (!cancelled && logRes.success && logRes.data) {
          const logText = logRes.data;
          if (logText) {
            const parsed = parseLogLines(logText);
            setLines(parsed);
          }
        }

        setLoading(false);

        // If still running, poll for updates
        if (exec.status === 'running') {
          pollRef.current = setInterval(async () => {
            if (cancelled) return;
            const updated = await fetchExecution(executionId);
            if (updated.success && updated.data) {
              setStatus(updated.data.status);
              if (updated.data.status !== 'running') {
                // Final log fetch
                const finalLog = await fetchExecutionLog(executionId);
                if (finalLog.success && finalLog.data) {
                  setLines(parseLogLines(finalLog.data));
                }
                if (pollRef.current) clearInterval(pollRef.current);
              } else {
                // Refresh log
                const log = await fetchExecutionLog(executionId);
                if (log.success && log.data) {
                  setLines(parseLogLines(log.data));
                }
              }
            }
          }, 1000);
        }
      } catch (err) {
        if (!cancelled) {
          setLines([{ text: `[Error loading log: ${err instanceof Error ? err.message : String(err)}]`, stream: 'stderr' }]);
          setLoading(false);
        }
      }
    }

    loadLog();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [executionId, autoConnect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (loading && lines.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: 'var(--space-sm)' }}>
        Loading execution log...
      </div>
    );
  }

  if (lines.length === 0 && status) {
    return (
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: 'var(--space-sm)' }}>
        Execution {status} — no output.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Execution Log
        {status && (
          <span className={status === 'success' ? 'text-success' : status === 'running' ? 'text-warning' : 'text-danger'}>
            — {status}
          </span>
        )}
      </div>
      <div className="log-viewer" style={{ maxHeight: '300px' }}>
        {lines.map((line, i) => (
          <div key={i} className={`log-line-${line.stream}`}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/** Parse raw log text into structured lines */
function parseLogLines(raw: string): { text: string; stream: 'stdout' | 'stderr' | 'info' }[] {
  const result: { text: string; stream: 'stdout' | 'stderr' | 'info' }[] = [];
  const rawLines = raw.split('\n');

  for (const line of rawLines) {
    if (line.startsWith('[stdout] ')) {
      result.push({ text: line.slice(9), stream: 'stdout' });
    } else if (line.startsWith('[stderr] ')) {
      result.push({ text: line.slice(9), stream: 'stderr' });
    } else if (line.startsWith('[info] ')) {
      result.push({ text: line.slice(7), stream: 'info' });
    } else if (line.startsWith('[error] ')) {
      result.push({ text: line.slice(8), stream: 'stderr' });
    } else if (line.trim()) {
      result.push({ text: line, stream: 'stdout' });
    }
  }

  return result;
}

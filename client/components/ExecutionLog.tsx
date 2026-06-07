import React, { useEffect, useRef, useState } from 'react';

interface Props {
  executionId: string;
  autoConnect?: boolean;
}

export default function ExecutionLog({ executionId, autoConnect = false }: Props) {
  const [lines, setLines] = useState<{ text: string; stream: 'stdout' | 'stderr' | 'info' }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Connect directly to backend (avoid Vite HMR WebSocket proxy conflict)
    const backendPort = 3000;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${backendPort}/ws?executionId=${executionId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLines((prev) => [...prev, { text: data.line, stream: data.stream }]);
        } else if (data.type === 'completed') {
          setStatus(data.status);
          ws.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      setLines((prev) => [...prev, { text: '[WebSocket connection error]', stream: 'stderr' }]);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [executionId, autoConnect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (lines.length === 0 && !status) return null;

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-xs)' }}>
        Execution Log {status && `— ${status}`}
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

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { ToolManifest, ExecutionRecord, ExecutionStatus } from '../../shared/types';
import { store } from '../db/store';
import { eventBus } from '../events/EventBus';
import { config } from '../config';

const EXEC_COLLECTION = 'executions';

interface RunningProcess {
  executionId: string;
  process: ChildProcess;
  startTime: number;
}

export class ProcessManager {
  private running: Map<string, RunningProcess> = new Map();

  /**
   * Execute a tool with given parameters
   */
  async execute(
    toolId: string,
    manifest: ToolManifest,
    params: Record<string, unknown>
  ): Promise<ExecutionRecord> {
    const executionId = uuid();
    const startedAt = new Date().toISOString();
    const logFileName = `${executionId}.log`;
    const logPath = path.join(config.dataDir, 'logs', logFileName);

    // Ensure log directory exists
    const fs = await import('fs');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });

    const record: ExecutionRecord = {
      id: executionId,
      toolId,
      workflowId: null,
      status: 'running',
      inputParams: params,
      output: null,
      logPath,
      startedAt,
      finishedAt: null,
      durationMs: null,
    };

    store.insert(EXEC_COLLECTION, record);
    eventBus.emit('execution:started', { executionId, toolId });

    if (manifest.mode === 'cli') {
      return this.executeCLI(record, manifest, params, logPath);
    } else if (manifest.mode === 'http') {
      return this.executeHTTP(record, manifest, params, logPath);
    } else {
      // web or composite - not directly executable, just record
      return this.finishExecution(record, 'failed', 'Direct execution not supported for web/composite mode');
    }
  }

  private async executeCLI(
    record: ExecutionRecord,
    manifest: ToolManifest,
    params: Record<string, unknown>,
    logPath: string
  ): Promise<ExecutionRecord> {
    const fs = await import('fs');
    const toolDir = config.toolsDir;
    const toolPath = path.join(toolDir, manifest.id);
    const entryPath = path.join(toolPath, manifest.runtime.entry);

    if (!fs.existsSync(entryPath)) {
      return this.finishExecution(record, 'failed', `Entry file not found: ${manifest.runtime.entry}`);
    }

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    // Build command based on runtime type
    let command: string;
    let args: string[];

    switch (manifest.runtime.type) {
      case 'python':
        command = 'python';
        args = [entryPath];
        break;
      case 'node':
        command = 'node';
        args = [entryPath];
        break;
      case 'shell':
        command = 'bash';
        args = [entryPath];
        break;
      case 'binary':
        command = entryPath;
        args = [];
        break;
      default:
        command = manifest.runtime.entry.split(' ')[0];
        args = manifest.runtime.entry.split(' ').slice(1);
    }

    // Add extra CLI args from runtime config
    if (manifest.runtime.args) {
      args.push(...manifest.runtime.args);
    }

    // Convert params to CLI arguments
    for (const input of manifest.inputs) {
      const value = params[input.key];
      if (value !== undefined && value !== null) {
        if (input.type === 'boolean') {
          if (value) args.push(`--${input.key}`);
        } else {
          args.push(`--${input.key}`, String(value));
        }
      }
    }

    const timeoutMs = manifest.runtime.timeout || 30000;
    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      ...manifest.runtime.env,
    };

    return new Promise((resolve) => {
      try {
        const proc = spawn(command, args, {
          cwd: toolPath,
          env,
          shell: manifest.runtime.type === 'shell',
        });

        this.running.set(record.id, {
          executionId: record.id,
          process: proc,
          startTime: Date.now(),
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          stdout += text;
          logStream.write(`[stdout] ${text}`);
          eventBus.emit('execution:log', {
            executionId: record.id,
            line: text.trimEnd(),
            stream: 'stdout',
          });
        });

        proc.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          logStream.write(`[stderr] ${text}`);
          eventBus.emit('execution:log', {
            executionId: record.id,
            line: text.trimEnd(),
            stream: 'stderr',
          });
        });

        const timer = setTimeout(() => {
          proc.kill();
          this.running.delete(record.id);
          logStream.end();
          resolve(this.finishExecution(record, 'timeout', stdout || stderr));
        }, timeoutMs);

        proc.on('close', (code) => {
          clearTimeout(timer);
          this.running.delete(record.id);
          logStream.end();

          const status: ExecutionStatus = code === 0 ? 'success' : 'failed';
          const output = code === 0 ? stdout : `${stdout}\n${stderr}`.trim();
          resolve(this.finishExecution(record, status, output));
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          this.running.delete(record.id);
          logStream.end();
          resolve(this.finishExecution(record, 'failed', err.message));
        });
      } catch (err: unknown) {
        logStream.end();
        const message = err instanceof Error ? err.message : String(err);
        resolve(this.finishExecution(record, 'failed', message));
      }
    });
  }

  private async executeHTTP(
    record: ExecutionRecord,
    manifest: ToolManifest,
    params: Record<string, unknown>,
    logPath: string
  ): Promise<ExecutionRecord> {
    const fs = await import('fs');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    // For HTTP mode, the tool is expected to be a running HTTP server.
    // We proxy the request to it.
    const port = manifest.runtime.port || 3001;
    const url = `http://localhost:${port}${manifest.runtime.entry}`;

    try {
      logStream.write(`[info] HTTP request to ${url}\n`);
      logStream.write(`[info] params: ${JSON.stringify(params)}\n`);

      // Dynamic import for fetch
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(manifest.runtime.timeout || 30000),
      });

      const body = await response.text();
      logStream.write(`[info] Response (${response.status}): ${body}\n`);
      logStream.end();

      const status: ExecutionStatus = response.ok ? 'success' : 'failed';
      return this.finishExecution(record, status, body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logStream.write(`[error] ${message}\n`);
      logStream.end();
      return this.finishExecution(record, 'failed', message);
    }
  }

  /**
   * Cancel a running execution
   */
  cancel(executionId: string): boolean {
    const running = this.running.get(executionId);
    if (!running) return false;
    running.process.kill();
    this.running.delete(executionId);
    this.finishExecution(
      { id: executionId } as ExecutionRecord,
      'cancelled',
      'Cancelled by user'
    );
    return true;
  }

  /**
   * Get execution status
   */
  getStatus(executionId: string): ExecutionRecord | undefined {
    return store.findById<ExecutionRecord>(EXEC_COLLECTION, executionId);
  }

  /**
   * List recent executions
   */
  listRecent(limit: number = 20): ExecutionRecord[] {
    const all = store.findAll<ExecutionRecord>(EXEC_COLLECTION);
    return all
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  /**
   * Get execution stats
   */
  getStats(): { total: number; success: number; failed: number; running: number } {
    const all = store.findAll<ExecutionRecord>(EXEC_COLLECTION);
    return {
      total: all.length,
      success: all.filter((e) => e.status === 'success').length,
      failed: all.filter((e) => e.status === 'failed' || e.status === 'timeout').length,
      running: this.running.size,
    };
  }

  private finishExecution(
    record: ExecutionRecord,
    status: ExecutionStatus,
    output: string
  ): ExecutionRecord {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(record.startedAt).getTime();

    const updated: ExecutionRecord = {
      ...record,
      status,
      output,
      finishedAt,
      durationMs,
    };

    store.update<ExecutionRecord>(EXEC_COLLECTION, record.id, updated);
    eventBus.emit('execution:completed', { executionId: record.id, status });
    return updated;
  }

  get runningCount(): number {
    return this.running.size;
  }
}

export const processManager = new ProcessManager();

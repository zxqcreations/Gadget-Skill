import type { ApiResponse, ToolRecord, UIConfig, ExecutionRecord, WorkflowRecord, WorkflowGraph } from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// ---- Tools ----

export async function fetchTools(params?: {
  category?: string;
  mode?: string;
  search?: string;
}): Promise<ApiResponse<ToolRecord[]>> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.mode) searchParams.set('mode', params.mode);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();
  return request(`/tools${qs ? `?${qs}` : ''}`);
}

export async function fetchTool(id: string): Promise<ApiResponse<ToolRecord>> {
  return request(`/tools/${id}`);
}

export async function fetchToolUI(id: string): Promise<ApiResponse<UIConfig>> {
  return request(`/tools/${id}/ui`);
}

export async function fetchCategories(): Promise<ApiResponse<string[]>> {
  return request('/tools/categories');
}

export async function registerTool(manifest: unknown, files?: { name: string; content: string }[]): Promise<ApiResponse<ToolRecord>> {
  return request('/tools', {
    method: 'POST',
    body: JSON.stringify({ manifest, files }),
  });
}

export async function scanTools(): Promise<ApiResponse<{ found: number; registered: number; updated: number; errors: string[] }>> {
  return request('/tools/scan', { method: 'POST' });
}

export async function uninstallTool(id: string, removeFiles = false): Promise<ApiResponse<{ id: string }>> {
  return request(`/tools/${id}?removeFiles=${removeFiles}`, { method: 'DELETE' });
}

// ---- Execution ----

export async function executeTool(toolId: string, params: Record<string, unknown>): Promise<ApiResponse<ExecutionRecord>> {
  return request(`/execute/${toolId}`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchExecution(execId: string): Promise<ApiResponse<ExecutionRecord>> {
  return request(`/execute/${execId}`);
}

export async function fetchExecutionLog(execId: string): Promise<ApiResponse<string>> {
  return request(`/execute/${execId}/log`);
}

export async function cancelExecution(execId: string): Promise<ApiResponse<{ id: string }>> {
  return request(`/execute/${execId}/cancel`, { method: 'POST' });
}

export async function fetchExecutions(limit = 20): Promise<ApiResponse<{ recent: ExecutionRecord[]; stats: { total: number; success: number; failed: number; running: number } }>> {
  return request(`/execute?limit=${limit}`);
}

// ---- Workflows ----

export async function fetchWorkflows(): Promise<ApiResponse<WorkflowRecord[]>> {
  return request('/workflows');
}

export async function fetchWorkflow(id: string): Promise<ApiResponse<WorkflowRecord>> {
  return request(`/workflows/${id}`);
}

export async function createWorkflow(data: { name: string; description: string; graph: WorkflowGraph }): Promise<ApiResponse<WorkflowRecord>> {
  return request('/workflows', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateWorkflow(id: string, data: { name?: string; description?: string; graph?: WorkflowGraph }): Promise<ApiResponse<WorkflowRecord>> {
  return request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteWorkflow(id: string): Promise<ApiResponse<{ id: string }>> {
  return request(`/workflows/${id}`, { method: 'DELETE' });
}

export async function validateWorkflow(graph: WorkflowGraph): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> {
  return request('/workflows/validate', { method: 'POST', body: JSON.stringify({ graph }) });
}

export async function runWorkflow(id: string): Promise<ApiResponse<{ workflowId: string; nodeResults: Map<string, { status: string; output: string | null }> }>> {
  return request(`/workflows/${id}/run`, { method: 'POST' });
}

// ---- Stats ----

export async function fetchStats(): Promise<ApiResponse<{
  tools: number;
  workflows: number;
  executions: number;
  successRate: number;
}>> {
  return request('/stats');
}

// ---- Config ----

export async function fetchConfig(): Promise<ApiResponse<Record<string, unknown>>> {
  return request('/config');
}

export async function updateConfig(data: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
  return request('/config', { method: 'PUT', body: JSON.stringify(data) });
}

// ---- Files ----

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

export async function fetchFileList(dir?: string): Promise<ApiResponse<{ path: string; entries: FileEntry[] }>> {
  const qs = dir ? `?dir=${encodeURIComponent(dir)}` : '';
  return request(`/files/list${qs}`);
}

export async function uploadFiles(files: FileList | File[], dir?: string): Promise<ApiResponse<{ uploaded: { name: string; size: number; path: string }[] }>> {
  const formData = new FormData();
  for (const file of Array.from(files)) {
    formData.append('files', file);
  }
  const qs = dir ? `?dir=${encodeURIComponent(dir)}` : '';
  const res = await fetch(`/api/files/upload${qs}`, { method: 'POST', body: formData });
  return res.json();
}

export function getFileDownloadUrl(filePath: string): string {
  return `/api/files/download?path=${encodeURIComponent(filePath)}`;
}

export async function deleteFile(filePath: string): Promise<ApiResponse<{ path: string }>> {
  return request(`/files/delete?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
}

export async function createDirectory(dir: string): Promise<ApiResponse<{ path: string }>> {
  return request('/files/mkdir', { method: 'POST', body: JSON.stringify({ dir }) });
}

export async function readFileContent(filePath: string): Promise<ApiResponse<{ path: string; content: string; size: number }>> {
  return request(`/files/read?path=${encodeURIComponent(filePath)}`);
}

export async function writeFileContent(filePath: string, content: string): Promise<ApiResponse<{ path: string }>> {
  return request('/files/write', { method: 'POST', body: JSON.stringify({ path: filePath, content }) });
}

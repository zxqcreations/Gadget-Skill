# GadgetServer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local web application for registering, managing, executing, and composing tools generated during Claude usage.

**Architecture:** Modular monolith — Express + React SPA in a single project. Internal modules (Registry, Executor, Workflow, Bridge) communicate via EventBus. SQLite for metadata, filesystem for tool code.

**Tech Stack:** Node.js + TypeScript, Express, React + Vite, better-sqlite3, ws (WebSocket), ReactFlow (DAG editor)

---

## Phase 1: Project Scaffold

### Task 1.1: Initialize project

**Files:** Create: `package.json`, `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`

- [ ] Init npm, install deps, configure TypeScript

### Task 1.2: Create directory structure

**Files:** Create all dirs: `server/`, `client/`, `tools/`, `data/`, plus all subdirectories

---

## Phase 2: Backend Core

### Task 2.1: Config + DB init

**Files:** Create: `server/config.ts`, `server/db/sqlite.ts`, `server/db/migrations/001_init.sql`

### Task 2.2: Tool Registry

**Files:** Create: `server/registry/ToolSchema.ts`, `server/registry/ToolRegistry.ts`

### Task 2.3: UI Generator

**Files:** Create: `server/registry/UIGenerator.ts`

### Task 2.4: Scanner

**Files:** Create: `server/registry/Scanner.ts`

### Task 2.5: API Routes (Tools)

**Files:** Create: `server/api/toolRoutes.ts`

### Task 2.6: Tool Executor

**Files:** Create: `server/executor/ProcessManager.ts`, `server/executor/Sandbox.ts`, `server/executor/AdapterBase.ts`

### Task 2.7: Execute API + WebSocket

**Files:** Create: `server/api/executeRoutes.ts`, `server/events/EventBus.ts`

### Task 2.8: Server entry point

**Files:** Create: `server/index.ts`

---

## Phase 3: Workflow Engine

### Task 3.1: Workflow Engine + Pipeline

**Files:** Create: `server/workflow/WorkflowSchema.ts`, `server/workflow/WorkflowEngine.ts`, `server/workflow/Pipeline.ts`

### Task 3.2: Workflow API Routes

**Files:** Create: `server/api/workflowRoutes.ts`

---

## Phase 4: Frontend SPA

### Task 4.1: Frontend foundation

**Files:** Create: `client/index.html`, `client/main.tsx`, `client/App.tsx`, `client/lib/types.ts`, `client/lib/api.ts`, `client/styles/global.css`

### Task 4.2: Dashboard page

**Files:** Create: `client/pages/Dashboard.tsx`

### Task 4.3: ToolList page

**Files:** Create: `client/pages/ToolList.tsx`, `client/components/ToolCard.tsx`

### Task 4.4: ToolDetail page + dynamic form

**Files:** Create: `client/pages/ToolDetail.tsx`, `client/components/ToolForm.tsx`

### Task 4.5: WorkflowEditor page

**Files:** Create: `client/pages/WorkflowEditor.tsx`, `client/components/DAGCanvas.tsx`

### Task 4.6: Settings page + ExecutionLog component

**Files:** Create: `client/pages/Settings.tsx`, `client/components/ExecutionLog.tsx`

### Task 4.7: Custom hooks

**Files:** Create: `client/hooks/useTools.ts`, `client/hooks/useExecute.ts`, `client/hooks/useWorkflow.ts`

---

## Phase 5: Claude Integration

### Task 5.1: Claude Query API

**Files:** Create: `server/api/claudeRoutes.ts`, `server/bridge/ClaudeQuery.ts`

### Task 5.2: MCP Server

**Files:** Create: `server/mcp/McpServer.ts`, `server/mcp/tools/`, `server/mcp/resources/`, `mcp-entry.js`

### Task 5.3: Claude Skill

**Files:** Create: `skill/SKILL.md`, `skill/gadget-cli.js`

---

## Phase 6: Polish

### Task 6.1: Windows service setup

**Files:** Create: `scripts/install-service.js`, `scripts/uninstall-service.js`

### Task 6.2: README + docs

**Files:** Create: `README.md`

### Task 6.3: Git setup + push

Setup git, connect to GitHub remote, commit and push

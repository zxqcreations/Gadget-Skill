# GadgetServer 使用指南

> 如何将 Claude 生成的小工具注册到 GadgetServer，自动生成前端 UI 和后端 API

---

## 目录

1. [快速开始](#1-快速开始)
2. [工具注册（三种方式）](#2-工具注册三种方式)
3. [Manifest 编写指南](#3-manifest-编写指南)
4. [输入类型 → UI 控件对照](#4-输入类型--ui-控件对照)
5. [工作流：串联多个工具](#5-工作流串联多个工具)
6. [Claude 集成（Skill + MCP）](#6-claude-集成skill--mcp)
7. [常用命令速查](#7-常用命令速查)
8. [目录结构](#8-目录结构)

---

## 1. 快速开始

```bash
# 克隆项目
git clone https://github.com/zxqcreations/Gadget-Skill.git
cd Gadget-Skill

# 安装依赖
npm install

# 启动（同时启动后端 :3000 和前端 :5173）
npm run dev
```

打开浏览器：
- **前端界面**：http://localhost:5173 （开发模式，有热更新）
- **后端 API**：http://localhost:3000 （生产模式下前端也走这个端口）
- **生产模式**：`npm run build && npm start` → http://localhost:3000

---

## 2. 工具注册（三种方式）

### 方式一：在 Claude 中一键注册 ⭐ 推荐

**前提**：GadgetServer 在后台运行，且 Skill 已安装。

**安装 Skill**（一次性）：
```bash
# 将 skill 目录链接到 Claude Code 的 skills 目录
# Windows (PowerShell):
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\gadget" -Target "D:\ENV\claude\GadgetServer\skill"

# macOS / Linux:
ln -s /path/to/Gadget-Skill/skill ~/.claude/skills/gadget
```

**使用流程**：

1. 在 Claude Code 中让 Claude 帮你写一个工具（脚本、网页、API 等）
2. 代码生成完毕后，输入：
   ```
   /gadget register
   ```
3. Claude 会自动：
   - 分析代码（语言、模式、参数、输入输出）
   - 生成完整的 `manifest.json`
   - 将代码和 manifest 写入 `tools/<tool-id>/` 目录
   - 调用 API 注册到系统
   - 告诉你注册结果和前端访问地址

4. 打开前端 → 工具详情页 → 自动生成的操作用 UI 已经在等你

**其他 Claude 命令**：

| 命令 | 功能 |
|------|------|
| `/gadget list` | 列出所有已注册工具 |
| `/gadget docs <id>` | 查看工具完整文档 |
| `/gadget search <kw>` | 搜索工具 |
| `/gadget run <id>` | 执行工具 |
| `/gadget workflow` | 进入工作流构建模式 |
| `/gadget open` | 打开前端页面 |

---

### 方式二：前端页面手动注册

打开 http://localhost:3000 → **Tools** → 点击右上角 **"+ Register Tool"**

填写表单：

| 字段 | 说明 | 示例 |
|------|------|------|
| Tool ID | 唯一标识符（kebab-case） | `img-compressor` |
| Display Name | 显示名称 | `Image Compressor` |
| Mode | 运行模式 | `CLI` / `HTTP` / `Web` |
| File Extension | 代码语言 | `.py` / `.js` / `.sh` |
| Entry File | 主入口文件名 | `compress.py` |
| Description | 一句话描述 | `批量压缩图片，支持 WebP/PNG/JPG` |
| Input Format | 输入数据格式 | `file[]`（多文件） |
| Output Format | 输出数据格式 | `file[]`（多文件） |
| Source Code | 粘贴代码（可选） | 可以直接粘贴脚本内容 |

**注册后**，编辑 `tools/<your-tool-id>/manifest.json`，手动添加 `inputs` 数组来定义工具的参数——前端会根据这些定义自动生成操作表单。

---

### 方式三：直接创建文件

适合批量注册或编程生成：

```
tools/
└── my-tool/
    ├── manifest.json    ← 工具元数据（必需）
    └── main.py          ← 工具代码
```

创建好之后：
- **自动发现**：重启 `npm run dev`，服务启动时自动扫描
- **手动触发**：前端 Tools 页面点击 **"🔍 Scan"** 按钮

---

## 3. Manifest 编写指南

`manifest.json` 是工具的核心描述文件，驱动前端 UI 生成和工作流串联。

### 完整模板

```json
{
  "id": "img-compressor",
  "name": "Image Compressor",
  "version": "1.0.0",
  "description": "批量压缩图片，支持 WebP/PNG/JPG 格式",
  "category": "media",
  "tags": ["image", "compress", "batch"],
  "mode": "cli",

  "runtime": {
    "type": "python",
    "entry": "compress.py",
    "timeout": 30000,
    "env": { "PYTHONUNBUFFERED": "1" }
  },

  "inputs": [
    {
      "key": "files",
      "label": "图片文件",
      "type": "file[]",
      "required": true,
      "accept": ".png,.jpg,.webp",
      "help": "支持 PNG/JPG/WebP 格式"
    },
    {
      "key": "quality",
      "label": "压缩质量",
      "type": "range",
      "default": 80,
      "min": 1,
      "max": 100
    }
  ],

  "outputs": [
    { "type": "file", "label": "压缩后的图片", "mime": "image/*" }
  ],

  "ui": {
    "icon": "image",
    "color": "#22c55e",
    "layout": "form"
  },

  "adapter": {
    "input":  { "format": "file[]" },
    "output": { "format": "file[]" }
  }
}
```

### 字段说明

#### 基础字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `id` | ✅ | 唯一标识符，kebab-case，如 `img-compressor` |
| `name` | ✅ | 显示名称，如 `Image Compressor` |
| `version` | | 版本号，如 `1.0.0` |
| `description` | | 一句话描述工具功能 |
| `category` | | 分类：`media` `data` `text` `network` `ai` `dev` `system` |
| `tags` | | 标签数组，用于搜索 |
| `mode` | ✅ | `cli` / `http` / `web` / `composite` |

#### `runtime` — 运行时配置

| 字段 | 说明 |
|------|------|
| `type` | `python` / `node` / `shell` / `binary` / `custom` |
| `entry` | 主入口文件名（相对于工具目录） |
| `timeout` | 超时时间（毫秒），默认 30000 |
| `env` | 环境变量键值对 |
| `port` | HTTP 模式下的端口号（可选） |

#### `inputs` — 输入参数（驱动 UI 生成）

每个 input 对象：

| 字段 | 必需 | 说明 |
|------|------|------|
| `key` | ✅ | 参数名，传递给 CLI 的 `--key` |
| `label` | ✅ | 前端显示的标签 |
| `type` | ✅ | 输入类型（见下方对照表） |
| `required` | | 是否必填 |
| `default` | | 默认值 |
| `placeholder` | | 占位文字 |
| `help` | | 帮助提示 |
| `options` | | select 类型的选项 `[{label, value}]` |
| `min/max/step` | | range 类型的范围 |
| `accept` | | file 类型的文件类型过滤 |
| `showIf` | | 条件显示 `{key, value}` |

#### `adapter` — 适配器签名（工作流串联用）

| 字段 | 说明 |
|------|------|
| `input.format` | 输入数据格式：`text` `file` `file[]` `json` `url` `binary` |
| `output.format` | 输出数据格式：同上 |

**串联规则**：工具 A 的 `output.format` 必须等于工具 B 的 `input.format`，两个工具才能串联。

---

## 4. 输入类型 → UI 控件对照

你在 manifest 中定义 `inputs[].type` 为以下值，前端自动渲染对应控件：

| type | 前端控件 | 适用场景 |
|------|---------|---------|
| `string` | 文本输入框 | 名称、ID、任意文本 |
| `text` | 多行文本框 | 描述、内容、长文本 |
| `number` | 数字输入 | 数量、大小、阈值 |
| `range` | 滑块 | 质量、级别、百分比 |
| `boolean` | 开关/复选框 | 启用/禁用、标志位 |
| `select` | 下拉选择 | 固定选项（需提供 `options`） |
| `file` | 单文件选择 | 选择单个文件 |
| `file[]` | 多文件选择 | 批量文件处理 |
| `folder` | 目录路径输入 | 指定工作目录 |
| `url` | URL 输入框 | 网址、API 地址 |
| `json` | JSON 编辑器 | 结构化数据输入 |
| `secret` | 密码输入框 | API Key、Token |
| `color` | 颜色选择器 | 颜色值 |

---

## 5. 工作流：串联多个工具

### 原理

每个工具通过 `adapter.input.format` 和 `adapter.output.format` 声明自己的数据接口。两个工具能串联当且仅当：

```
上游工具.output.format === 下游工具.input.format
```

### 创建方式

**A. Claude 中创建**（推荐）：
```
/gadget workflow
```
Claude 会列出所有工具的适配器签名，帮你找到可串联的链条，自动创建工作流。

**B. 前端创建**：
打开 http://localhost:3000 → **Workflows** → **"+ New Workflow"**
- 左侧选工具，右侧排顺序
- 系统自动校验适配器兼容性
- 创建后点 **▶ Run** 执行

**C. API 创建**：
```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "图片下载→压缩→上传",
    "description": "自动处理图片管道",
    "graph": {
      "nodes": [
        {"id": "n0", "toolId": "downloader"},
        {"id": "n1", "toolId": "img-compressor"},
        {"id": "n2", "toolId": "cdn-uploader"}
      ],
      "edges": [
        {"id": "e1", "source": "n0", "target": "n1"},
        {"id": "e2", "source": "n1", "target": "n2"}
      ]
    }
  }'
```

---

## 6. Claude 集成（Skill + MCP）

### 安装 Skill

```bash
# Windows (PowerShell 管理员)
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\.claude\skills\gadget" `
  -Target "D:\ENV\claude\GadgetServer\skill"

# macOS / Linux
ln -s $(pwd)/skill ~/.claude/skills/gadget
```

安装后重启 Claude Code，即可使用 `/gadget` 命令。

### 配置 MCP Server（可选）

在 Claude Code 的 MCP 配置中添加（`.claude/mcp.json` 或 Claude Desktop 配置）：

```json
{
  "mcpServers": {
    "gadget-server": {
      "command": "node",
      "args": ["D:/ENV/claude/GadgetServer/mcp-entry.js"],
      "env": {
        "GADGET_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

配置后 Claude 可以直接调用以下 MCP Tools：
- `gadget_list_tools` — 列出工具
- `gadget_get_docs` — 查文档
- `gadget_find_compatible` — 找兼容工具链
- `gadget_create_workflow` — 创建工作流

---

## 7. 常用命令速查

### 启动与开发

```bash
npm run dev          # 开发模式（后端热重载 + 前端热更新）
npm run build        # 生产构建
npm start            # 生产模式运行
npm run dev:server   # 仅启动后端
npm run dev:client   # 仅启动前端
```

### API 端点

**工具管理**：
```bash
curl http://localhost:3000/api/tools                # 列出工具
curl http://localhost:3000/api/tools/img-compressor  # 工具详情
curl http://localhost:3000/api/tools/img-compressor/ui  # UI 配置
curl -X POST http://localhost:3000/api/tools/scan   # 扫描工具目录
```

**执行工具**：
```bash
curl -X POST http://localhost:3000/api/execute/img-compressor \
  -H "Content-Type: application/json" \
  -d '{"files": ["a.png"], "quality": 80}'

curl http://localhost:3000/api/execute/<exec-id>      # 查看状态
curl http://localhost:3000/api/execute/<exec-id>/log  # 查看日志
```

**Claude 查询**：
```bash
curl http://localhost:3000/api/claude/tools                       # 工具摘要
curl http://localhost:3000/api/claude/tools/img-compressor/docs   # 完整文档
curl -X POST http://localhost:3000/api/claude/search -H "Content-Type: application/json" -d '{"query":"图片"}'
curl -X POST http://localhost:3000/api/claude/compatible -H "Content-Type: application/json" -d '{"from":"img-compressor"}'
```

### 系统

```bash
curl http://localhost:3000/api/health    # 健康检查
curl http://localhost:3000/api/stats     # 统计数据
curl http://localhost:3000/api/config    # 查看配置
```

---

## 8. 目录结构

```
gadget-server/
├── server/                # 后端 Express API
│   ├── index.ts           #   入口，HTTP + WebSocket 服务
│   ├── config.ts          #   配置管理
│   ├── registry/          #   工具注册中心
│   │   ├── ToolRegistry.ts    #   增删改查
│   │   ├── UIGenerator.ts     #   Manifest → UI 配置
│   │   └── Scanner.ts         #   文件系统扫描
│   ├── executor/          #   工具执行器
│   │   └── ProcessManager.ts  #   subprocess 管理
│   ├── workflow/          #   工作流引擎
│   │   └── WorkflowEngine.ts  #   DAG + 拓扑排序
│   └── api/               #   REST 路由
│       ├── toolRoutes.ts
│       ├── executeRoutes.ts
│       ├── workflowRoutes.ts
│       └── claudeRoutes.ts
│
├── client/                # 前端 React SPA
│   ├── pages/
│   │   ├── Dashboard.tsx      #   概览
│   │   ├── ToolList.tsx       #   工具列表 + 注册
│   │   ├── ToolDetail.tsx     #   工具详情 + 执行
│   │   ├── WorkflowEditor.tsx #   工作流编辑器
│   │   └── Settings.tsx       #   系统设置
│   └── components/
│       ├── ToolForm.tsx       #   动态表单生成器
│       └── ExecutionLog.tsx   #   执行日志查看器
│
├── shared/                # 前后端共享类型
│   └── types.ts
│
├── tools/                 # 用户工具存储目录
│   ├── hello-world/       #   示例工具
│   └── <your-tool>/       #   你的工具
│       ├── manifest.json
│       └── <code files>
│
├── skill/                 # Claude Skill 定义
│   ├── SKILL.md           #   /gadget 命令实现
│   └── gadget-cli.js      #   命令行辅助工具
│
├── mcp-entry.js           # MCP Server 入口
├── data/                  # 运行时数据（自动创建）
│   ├── tools.json         #   工具元数据存储
│   ├── workflows.json     #   工作流存储
│   ├── executions.json    #   执行历史
│   ├── config.json        #   配置文件
│   └── logs/              #   执行日志
│
└── docs/                  # 设计文档
    └── superpowers/
        ├── specs/         #   设计规约
        └── plans/         #   实施计划
```

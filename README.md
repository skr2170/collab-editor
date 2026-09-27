# 协同编辑器 · Collaborative Editor

一个基于 **Yjs CRDT** 与 **WebSocket** 的轻量级实时协同文本编辑器。支持多人同时编辑、编辑锁、远程光标、在线用户列表、断线自动重连。

> 从零手写 WebSocket 同步起步，逐步演进到 CRDT 方案，过程中解决了一系列真实工程问题（模块多实例、依赖版本冲突、contenteditable 空内容陷阱等）。

---

🔗 **在线 Demo**：https://collab-editor-production-8325.up.railway.app

## ✨ 功能特性

| 功能 | 说明 |
|---|---|
| **实时文本同步** | 基于 Yjs CRDT，多人并发输入不冲突，无字符丢失 |
| **编辑锁** | 先点击者获得编辑权，失焦 3 秒自动释放，断线自动释放 |
| **远程光标** | 广播他人光标位置，带彩色标签，实时更新 |
| **在线用户列表** | 显示当前房间所有在线用户，各带唯一颜色 |
| **断线重连** | WebSocket 断开后自动重连，指数退避 |
| **状态指示** | 连接状态、同步状态、文档版本实时显示 |
| **乐观更新** | 本地输入即时反馈，无需等待服务器确认 |

---

## 🛠 技术栈

- **前端**：原生 JavaScript (ES Module) + HTML + CSS
- **协同引擎**：[Yjs](https://github.com/yjs/yjs) 13.x（CRDT 实现）
- **传输层**：[y-websocket](https://github.com/yjs/y-websocket) 3.x（WebSocket + Awareness 协议）
- **服务端**：Node.js + [@y/websocket-server](https://github.com/yjs/y-websocket-server)
- **依赖管理**：npm（含 `overrides` 强制版本统一）

---

## 🏗 架构

```
┌─────────────┐         WebSocket          ┌──────────────────┐
│  Browser A  │◄──────────────────────────►│                  │
│  (Y.Doc A)  │                            │                  │
└─────────────┘                            │   Node Server    │
                                           │                  │
┌─────────────┐         WebSocket          │  ┌────────────┐  │
│  Browser B  │◄──────────────────────────►│  │  Y.Doc S   │  │
│  (Y.Doc B)  │                            │  │ (权威副本) │  │
└─────────────┘                            │  └────────────┘  │
                                           │                  │
                                           │  Awareness 广播  │
                                           │  (光标/锁/用户)  │
                                           └──────────────────┘
```

**同步模型**：每个客户端持有一份完整的 `Y.Doc`。本地修改通过 CRDT 算法生成增量更新（delta update），通过 WebSocket 发送到服务端，服务端广播给同房间其他客户端。所有副本最终收敛到同一状态。

**Awareness 协议**：独立于文档的临时状态通道，用于广播光标、用户信息、编辑锁等非持久化数据，断开连接时自动清理。

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8.3（`overrides` 字段需要）

### 安装 & 启动

```bash
# 1. 安装依赖
npm install

# 2. 启动服务端
npm start

# 3. 打开两个浏览器窗口访问
#    http://localhost:3000
```

**测试协同**：两个窗口打开同一地址，一个点击编辑器获取编辑权，另一个会变只读并实时看到对方的输入和光标位置。

---

## 📁 项目结构

```
collab-editor/
├── index.html      # 前端页面：编辑器 UI + Yjs 绑定 + 锁/光标逻辑
├── server.mjs      # 服务端：HTTP 静态服务 + WebSocket 端点挂载
├── package.json    # 依赖声明 + overrides 版本锁定
└── README.md
```

**整个项目只有 3 个源文件**，不依赖任何前端框架或打包工具，直接跑起来就能用。

---

## 🔍 核心技术点

### 1. CRDT vs OT

协同编辑的两大流派：

| | OT（Operational Transformation） | CRDT（Conflict-free Replicated Data Type） |
|---|---|---|
| 中心化 | 依赖服务器维护全局顺序 | 去中心化，副本可独立合并 |
| 冲突处理 | 变换操作的位置索引 | 每个字符有唯一 ID，按 ID 排序 |
| 离线编辑 | 支持较弱 | 天然支持 |
| 实现难度 | 变换函数边界情况多 | 数据结构和墓碑管理复杂 |
| 本项目选型 | 早期尝试，后放弃 | **最终方案** |

选 Yjs 的原因：生态成熟、服务端开箱即用、Awareness 协议免费提供光标和锁的能力。

### 2. 为什么需要 importmap + `?external=yjs`

客户端通过 esm.sh 加载 `y-websocket` 时，默认会把它依赖的 `yjs` 一起打包。这样浏览器里存在**两份 Yjs 模块实例**，`Y.Doc` 的 `instanceof` 判断会失败，数据永远同步不了。

解决方案：在 importmap 里让 `yjs` 指向唯一 URL，并给 `y-websocket` 加 `?external=yjs` 参数，告诉 esm.sh "不要打包 yjs，保留 import 语句交给浏览器解析"。

```html
<script type="importmap">
{
  "imports": {
    "yjs": "https://esm.sh/yjs@13.6.32",
    "y-websocket": "https://esm.sh/y-websocket@3?external=yjs"
  }
}
</script>
```

### 3. 为什么服务端需要 `overrides`

`@y/websocket-server` 内部会声明自己的 `yjs` 依赖，如果和根目录的 `yjs` 版本不一致，会出现两个 Yjs 实例，服务端处理数据时报 `store.getClock is not a function`。

用 `package.json` 的 `overrides` 强制统一：

```json
"overrides": {
  "yjs": "^13.6.20"
}
```

### 4. 编辑锁的 Awareness 实现

不需要额外的 WebSocket 消息类型，直接把锁状态写入 Awareness：

```js
awareness.setLocalStateField('lock', true);   // 抢锁
awareness.setLocalStateField('lock', null);   // 释放
```

其他客户端通过 `awareness.on('change')` 感知锁状态变化。失焦延迟 3 秒释放，避免用户点一下别处就丢掉编辑权。

### 5. 本地输入的 diff 策略

不直接 `yText.delete(0, len)` 再 `insert` 整段新文本，因为那样会让 CRDT 认为整个文档被替换，导致所有远程光标位置失效。

只删除变化的中间段、只插入新增的部分，其他字符的 ID 保持不变，光标才能稳定跟随。

---

## 🐛 踩坑记录

| 问题 | 原因 | 解决 |
|---|---|---|
| 输入一个字符返回两个 | 服务器广播回显给发送者，客户端未识别自己的操作 | 用 `clientId + seq` 识别并出队（早期原生 WS 版本） |
| 删除内容同步不出去 | `contenteditable` 删空时残留 `<br>` / `&nbsp;` | 换成 `<textarea>`，`value` 永远是纯文本 |
| `Yjs was already imported` | 客户端加载了两份 Yjs | importmap + `?external=yjs` |
| `store.getClock is not a function` | 服务端 yjs 版本不一致 | `package.json` 的 `overrides` 强制统一 |
| `@y/websocket-server@0.1.5` 崩溃 | 该版本已转向 Yjs 14 | 锁定 `0.1.1`（兼容 Yjs 13） |

---

## 🗺 未来规划

- [ ] **文档持久化**：把 `Y.encodeStateAsUpdate(ydoc)` 存到 Redis / SQLite，重启不丢内容
- [ ] **多房间**：从 URL 参数读房间名，支持多个独立文档
- [ ] **Block 结构**：从单文本升级到块级文档模型（类似 Notion）
- [ ] **编辑器内可视化光标**：当前光标显示在编辑器下方，未来换成 `contenteditable` + 自绘叠加层
- [ ] **历史版本 / Snapshot**：定时存档，支持回滚
- [ ] **用户自定义昵称**：当前昵称是从 clientId 生成的，可开放用户输入

---

## 📄 License

MIT

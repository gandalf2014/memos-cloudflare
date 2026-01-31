# Memos Cloudflare

一个可以在 Cloudflare Workers 上部署的 Memos 克隆项目，支持 D1 数据库持久化存储。

## 功能特性

- ✅ 创建、编辑、删除 memos
- ✅ 行内编辑：点击编辑按钮后直接修改内容
- ✅ 瀑布流布局：响应式 3 列设计
- ✅ 图标按钮：简洁美观的 UI
- ✅ 实时同步（每3秒自动刷新）
- ✅ D1 数据库持久化存储

## 快速部署

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
# 创建 D1 数据库
npm run db:create

# 执行数据库迁移（本地测试）
npm run db:push

# 执行数据库迁移（远程）
npm run db:push:remote
```

### 3. 配置数据库 ID

创建数据库后，将返回的 `database_id` 更新到 `wrangler.toml` 中：

```toml
[[d1_databases]]
binding = "DB"
database_name = "memos"
database_id = "your-database-id-here"
```

### 4. 本地开发

```bash
npm run dev
```

### 5. 部署到 Cloudflare Workers

```bash
npm run deploy
```

## API 接口

- `GET /api/memos` - 获取所有 memos
- `POST /api/memos` - 创建新 memo
- `PUT /api/memos/:id` - 更新 memo
- `DELETE /api/memos/:id` - 删除 memo

## 数据库 Schema

```sql
CREATE TABLE memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## License

MIT

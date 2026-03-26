# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memos clone deployable on Cloudflare Workers with D1 database. A notes application with calendar view, tags, search, and password-protected access.

## Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Local development server
npm run deploy       # Deploy to Cloudflare Workers
npm run db:push      # Push schema to local D1 database
npm run db:push:remote  # Push schema to remote D1 database
```

## Architecture

- **Platform**: Cloudflare Workers with D1 SQLite database
- **Backend**: Server-side rendered HTML with vanilla JavaScript client
- **Database**: D1 (SQLite) with tables for memos, tags, and memo_tags junction

### Database Schema

- `memos`: id, content, created_at, updated_at, deleted_at (soft delete)
- `tags`: id, name (unique), created_at
- `memo_tags`: memo_id, tag_id (junction table)

### File Structure

```
src/
  index.js        # Main entry, router, and request handler
  handlers/
    auth.js       # Password verification endpoint
    memos.js      # CRUD operations for memos
    tags.js       # CRUD operations for tags
    html.js       # Frontend HTML/CSS/JS (server-rendered)
  utils/
    response.js   # CORS and JSON response utilities
    validation.js # Input validation helpers
```

### API Routes

- `POST /api/auth/verify` - Verify password, returns token
- `GET /api/memos` - List memos (supports date, search, tag, pagination)
- `POST /api/memos` - Create memo
- `PUT /api/memos/:id` - Update memo
- `DELETE /api/memos/:id` - Soft delete memo
- `GET /api/tags` - List tags with memo counts
- `POST /api/tags` - Create tag
- `DELETE /api/tags/:id` - Delete tag

### Configuration

- Password stored in `wrangler.toml` under `[vars] AUTH_PASSWORD`
- D1 database binding configured in `wrangler.toml`
- Default password: `gandalf`

## Development Notes

- The frontend is a single-page app embedded in `src/handlers/html.js` - not a separate build
- All client-side code is minified into a single JavaScript block in the HTML
- Soft deletes preserve data but hide from queries using `WHERE deleted_at IS NULL`
- Frontend auto-refreshes every 30 seconds via `setInterval(loadMemos, 30000)`
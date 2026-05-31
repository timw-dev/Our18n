# Our18n

> Local-first Translation Workspace for Translators and Developers.

Our18n is an offline-first translation management tool designed to help translators, developers, and localization teams work with i18n files efficiently without requiring a backend or cloud service.

All project data is stored locally in your browser using IndexedDB (Dexie.js).

---

# Current Status

Version: **v0.2.0-beta**

Deployment: Vercel

Architecture: Local-first

Storage: IndexedDB (Dexie.js)

Backend: None

---

# Why Our18n?

Most translation tools are either:

- Too developer-oriented
- Too expensive
- Require cloud services
- Lack proper version control

Our18n focuses on:

- Local-first workflow
- Fast editing experience
- Importing existing i18n projects
- Version snapshots
- Conflict resolution
- Offline capability

---

# Features

## Project Management

- Multiple local projects
- Project switching
- Project isolation

## Smart Import

Supports:

- JSON translation files
- JavaScript translation files

Examples:

```txt
locales/
├── en/
├── vi/
├── ko/
```

Nested namespaces:

```txt
auth/login.json
dashboard/home.json
common.json
```

Automatic:

- Language detection
- Namespace detection
- Merge existing languages

## Translation Workspace

- Dynamic language columns
- Edit all languages
- Search
- Filters
- Change tracking

## Conflict Resolution

Git-style import workflow:

Import
→ Preview
→ Conflict Detection
→ Resolve
→ Apply

Supported actions:

- Keep Local
- Use Incoming
- Skip

## Version Control

- Create Snapshot
- Version History
- Compare Versions
- Rollback
- Delete Snapshot

## Compare View

Dedicated compare page:

```txt
/compare
```

Supports:

- Added changes
- Removed changes
- Modified changes

## Export

Export current working copy as ZIP.

Structure example:

```txt
en/common.json
vi/common.json
ko/common.json

en/auth/login.json
vi/auth/login.json
ko/auth/login.json
```

---

# Technology Stack

Framework

- Next.js
- React
- TypeScript

UI

- Tailwind CSS
- Shadcn UI
- Radix UI
- Lucide Icons

Data

- Dexie.js
- IndexedDB

Table

- TanStack Table

State

- Zustand

Export

- JSZip

Notifications

- Sonner

---

# Roadmap

## v0.3.x

Planned:

- Better Version Manager
- Snapshot Cleanup Policy
- Backup / Restore Project Package
- Project Dashboard

## v0.4.x

Planned:

- Google Login
- Supabase Integration
- Remote Projects

## v0.5.x

Planned:

- Team Workspace
- Cloud Sync
- Shared Projects

---

# Release Notes

## v0.1.0-beta

Initial Local-first MVP

### Added

- Project Management
- Translation Table
- JSON Import
- Export Foundation
- Dexie Database
- Dynamic Language Columns
- Search & Filtering

### Infrastructure

- Vercel Deployment
- PWA Foundation
- Public Repository

---

## v0.2.0-beta

Local-first Versioned Workspace

### Smart Import v2

- Nested locales support
- JSON import improvements
- JavaScript translation file support
- Automatic language detection
- Automatic namespace detection

### Conflict Resolution

- Import Preview
- Conflict Detection
- Git-style Merge Workflow
- Selective Apply

### Version Control

- Snapshot System
- Version History
- Rollback Support
- Snapshot Cleanup

### Compare

- Dedicated Compare Page
- Diff Engine
- Version Comparison

### Export

- ZIP Export
- Nested Namespace Reconstruction
- Export Current Workspace

---

# Philosophy

Our18n follows a Local-first Architecture.

Current workflow:

Import
→ Edit
→ Resolve Conflicts
→ Snapshot
→ Compare
→ Export

Cloud synchronization will be introduced later without sacrificing the local-first experience.

Dexie remains the primary working copy even after future cloud integration.

---

# License

MIT

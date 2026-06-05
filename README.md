# Our18n

> Local-first Translation Workspace for Translators and Developers.

Our18n is an offline-first translation management tool designed to help translators, developers, and localization teams work with i18n files efficiently without requiring a backend or cloud service.

All project data is stored locally in your browser using IndexedDB (Dexie.js).

---

# Current Status

Version: **v0.3.0-beta**

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
- Advanced Spreadsheet-like Editing Experience
- Importing existing i18n projects
- Version snapshots
- Conflict resolution
- Offline capability

---

# Core Features

## Project Management

- Multiple local projects
- Project switching
- Project isolation
- Local-only workspace

## Smart Import v2

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
- Language merging
- Nested locale support

## Translation Workspace

- Dynamic language columns
- Edit all languages
- Search
- Namespace filters
- Change tracking
- Missing translation tracking

## Conflict Resolution

Git-style import workflow:

```txt
Import
→ Preview
→ Conflict Detection
→ Resolve
→ Apply
```

Supported actions:

- Keep Local
- Use Incoming
- Skip

## Snapshot Version Control

- Create Snapshot
- Version History
- Rollback
- Delete Snapshot
- Version Metadata
- Change Tracking

## Compare View

Dedicated compare page:

```txt
/compare
```

Supports:

- Added changes
- Removed changes
- Modified changes
- Version-to-version comparison

## Export

Export current workspace as ZIP.

Example output:

```txt
en/common.json
vi/common.json
ko/common.json

en/auth/login.json
vi/auth/login.json
ko/auth/login.json
```

---

# Spreadsheet Editing Experience (v0.3.0)

Our18n now behaves much closer to Excel and Google Sheets.

## Keyboard Navigation

- Arrow key navigation
- Tab / Shift + Tab navigation
- Enter to edit
- Direct typing to replace content
- Spreadsheet-style cell focus

## Multi-cell Copy & Paste

Supports:

- Excel
- Google Sheets
- LibreOffice
- Our18n

Examples:

Single-column paste

```txt
Xin chào
Tạm biệt
Cảm ơn
```

Multi-column paste

```txt
Hello    Xin chào
Logout   Đăng xuất
```

Matrix-based TSV import supported.

## Undo / Redo

Supported shortcuts:

```txt
Ctrl + Z
Ctrl + Y
Ctrl + Shift + Z
```

Tracked operations:

- Edit
- Delete
- Paste
- Batch updates

## TranslationCell Upgrade

Translation cells now support:

- Multi-line editing
- Auto-growing textarea
- Better readability
- Long text handling
- Reduced overflow issues

## Selection Improvements

- Spreadsheet range selection
- Shift + Click support
- Cleaner visual highlighting
- Native browser text-selection suppression

## Clipboard System

Centralized clipboard handling:

- Global copy/paste
- Hidden focus shield
- Reliable browser compatibility

---

# Technology Stack

## Framework

- Next.js
- React
- TypeScript

## UI

- Tailwind CSS
- Shadcn UI
- Radix UI
- Lucide Icons

## Data

- Dexie.js
- IndexedDB

## Table Engine

- TanStack Table

## State

- Zustand

## Export

- JSZip

## Notifications

- Sonner

---

# Architecture

## Local-first Philosophy

Current workflow:

```txt
Import
→ Edit
→ Resolve Conflicts
→ Snapshot
→ Compare
→ Export
```

No backend required.

No cloud dependency required.

All project data remains on the user's machine.

## Database Structure

### projects

Project metadata.

### namespaces

File-level organization.

Examples:

```txt
common.json
auth/login.json
dashboard/home.json
```

### translationRows

Current working copy.

Tracks:

- values
- originalValues
- changeStatus

### versions

Snapshot history.

Stores:

- version metadata
- timestamps
- snapshot state

---

# Release Notes

## v0.3.0-beta

Spreadsheet Workspace Upgrade

### Added

- Spreadsheet navigation
- Multi-cell copy
- Multi-cell paste
- Undo / Redo
- Spreadsheet selection model
- Improved TranslationCell UX
- Auto-growing textarea
- Clipboard infrastructure
- Missing value handling
- Performance improvements

### Improved

- Large translation workflow
- Excel compatibility
- Google Sheets compatibility
- Editing experience
- Focus management

---

## v0.2.0-beta

Local-first Versioned Workspace

### Added

- Smart Import v2
- Nested locales support
- JavaScript translation file support
- Automatic language detection
- Conflict Resolution Workflow
- Snapshot System
- Version History
- Rollback
- Compare Page
- ZIP Export

---

## v0.1.0-beta

Initial Local-first MVP

### Added

- Project Management
- Translation Table
- JSON Import
- Dexie Database
- Dynamic Language Columns
- Search & Filtering
- Export Foundation

---

# Roadmap

## v0.4.x

Planned:

- Project Package Backup (.our18n)
- Restore Project Package
- Snapshot Retention Policy
- Workspace Dashboard
- Translation Analytics

## v0.5.x

Planned:

- Google Login
- Supabase Integration
- Remote Projects

## v0.6.x

Planned:

- Team Workspace
- Shared Projects
- Manual Sync
- Cross-device Conflict Resolution

## v1.0

Target Vision:

- Local-first Translation Workspace
- Spreadsheet Editing Experience
- Snapshot Version Control
- Team Collaboration
- Cloud Synchronization

---

# License

MIT

# Focus Todo New Tab

A minimal, translucent Chrome extension that replaces the new tab page with a focus timer, a todo board, and lightweight time tracking — so every time you open a tab you land back in your work, not on a search bar.

The whole app lives behind a single new tab. There is no account, no server, no sync; everything is stored in `chrome.storage.local` with a `localStorage` fallback for the dev preview.

## What it does

- **Live clock and date hero.** A large monospace clock with the day/date underneath, framed by a customizable background.
- **Focus timer with breaks.** Start a 15 / 30 / 60 / 120 minute focus session. While focusing, you can take a short or long break — the focus countdown pauses and a separate break countdown takes over. When the break ends, the focus session automatically resumes (handled in the service worker, so it works even if the tab is closed).
- **Wall alarm.** A simple daily alarm with Chrome notifications, scheduled via `chrome.alarms`.
- **Todos with statuses and subtodos.** Each todo has four states — _Open_, _Busy_, _On hold_, _Done_ — picked inline from a colored status chip. Todos can have nested subtodos with their own statuses. Editing a title or status happens in a dedicated dialog with a live preview.
- **Auto-archive.** When a todo and all its subtodos are marked _Done_, an archive button appears. Archived todos are kept separately so the active list stays clean.
- **Time tracking.** When you start a focus session, the app offers to also start a labeled time-tracking entry. Sessions are stored as discrete entries with label, optional note, and duration.
- **Metrics calendar.** A monthly heat-calendar showing completed focus blocks, finished todos, finished subtodos, and tracked time per day. Click a day for a detailed breakdown.
- **Custom backgrounds.** Three built-in gradients (Alpine Dawn, Deep Glacier, Warm Dusk) plus the ability to upload your own photos. Multiple uploaded photos rotate randomly each new tab.

## Stack

- [Vue 3](https://vuejs.org/) with `<script setup>` and TypeScript
- [Vite](https://vitejs.dev/) for the dev server and production build
- [PrimeVue 4](https://primevue.org/) (Aura theme) for dialogs, inputs and select buttons
- [@lucide/vue](https://lucide.dev/) for icons
- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/) Chrome extension with a service worker (`public/background.js`) for alarm scheduling and notifications

## Installation (load as an unpacked extension)

```bash
npm install
npm run build
```

Then, in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the generated `dist/` folder
4. Open a new tab — you should see the focus dashboard instead of the default Chrome new tab

The extension takes over `chrome_url_overrides.newtab` (see `public/manifest.json`), so every new tab routes here.

## Development

```bash
npm run dev      # Vite dev server at http://localhost:5173 (no extension features)
npm run build    # type-check (vue-tsc) and produce a production dist/ bundle
npm run preview  # preview the built bundle
```

In `npm run dev`, the app falls back to `localStorage` because there is no `chrome.*` API. To exercise the alarm / notification / storage paths you need to load the built `dist/` as an unpacked extension.

## Project layout

```
public/
  manifest.json     Chrome MV3 manifest
  background.js     Service worker: alarms, break-to-focus transitions, focus-block log
  favicon.svg
  icons.svg

src/
  App.vue                       Top-level layout, view switching, timer + todo orchestration
  main.ts                       App bootstrap + PrimeVue config
  style.css                     Global styles, glass tokens, layout
  todos.ts                      Todo / Subtodo types, status helpers, legacy-data migration
  chromeAlarms.ts               Timer + wall-alarm state and chrome.alarms wrappers
  appSettings.ts                Background selection, uploaded images
  archivedTodos.ts              Storage for completed/archived todos
  breakRecords.ts               Persisted break sessions for metrics
  completedActions.ts           Persisted todo/subtodo completions for metrics
  focusMetrics.ts               Focus block aggregation by date
  timeTracking.ts               Time-entry storage, active-session state
  utils/
    backgroundImage.ts          Client-side image compression for custom backgrounds
    duration.ts                 Duration formatting
    sounds.ts                   Beep / schoolbell audio playback
  components/
    CountdownClock.vue          Hero + compact countdown renderer
    MetricsCalendar.vue         Monthly calendar with per-day detail
    MinimalConfirmDialog.vue    Shared confirm dialog
    TaskEditDialog.vue          Edit a todo or subtodo (title + status, live preview)
    TaskStatusBadge.vue         Inline status chip with popover picker
    TimeTracking.vue            Time-tracking panel + history
    TimeTrackingStartDialog.vue Prompt to label a session before the timer starts
    TodoCard.vue                Single todo card with subtodos
```

## Data storage

All persisted data uses `chrome.storage.local` when available, with a `localStorage` fallback for the dev preview. Nothing leaves the browser.

| Key                     | Stored where        | What it is                                                  |
| ----------------------- | ------------------- | ----------------------------------------------------------- |
| `focus-new-tab.todos`   | `localStorage`      | Active todos + subtodos (per-device)                        |
| `archivedTodos`         | `chrome.storage`    | Todos archived after full completion                        |
| `timer`                 | `chrome.storage`    | Current focus/break timer state (read by the service worker) |
| `focusBlocks`           | `chrome.storage`    | Completed focus blocks for the metrics calendar              |
| `breakRecords`          | `chrome.storage`    | Completed break sessions                                    |
| `completedActions`      | `chrome.storage`    | Todo / subtodo completion events                            |
| `timeEntries`           | `chrome.storage`    | Time-tracking history                                       |
| `timeTrackingSession`   | `chrome.storage`    | Currently-running time-tracking entry, if any               |
| `appSettings`           | `chrome.storage`    | Background selection + uploaded images                      |
| `wallAlarm`             | `chrome.storage`    | Daily alarm time + enabled flag                             |

Legacy todo records (older versions used `done: boolean`) are migrated to the new four-state `status` field on read; nothing needs to be done manually.

## Permissions

Declared in `public/manifest.json`:

- **`alarms`** — schedule focus / break completion and the daily wall alarm so the timer keeps running with the tab closed.
- **`notifications`** — fire a notification when a timer or wall alarm finishes.
- **`storage`** — persist todos, timer state, metrics, and settings across sessions.
- **`chrome_url_overrides.newtab`** — replace the default new tab with this UI.

No host permissions, no network access, no analytics.

## Privacy

All data is stored locally on the device. The extension does not make any network requests and has no remote backend.

## License

Personal project; no license declared yet. Add one (MIT is a sensible default) before sharing.

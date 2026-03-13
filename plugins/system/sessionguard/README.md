# Session Guard (Joomla System Plugin)

Warns logged-in users before their Joomla session expires and optionally renews the session via AJAX to prevent unexpected logout. Works in **Joomla 4 / 5 / 6**.

## Features

- **Automatic session countdown** using Joomla’s configured Session Lifetime.
- **Warning UI** (choose one):
  - Modal
  - Toast
  - Banner
- **Frontend vs Backend support** with automatic context detection.
- **Extend Session** button (AJAX) using Joomla token validation.
- **Auto-renew** (optional) a few seconds before expiry.
- **Cross-tab sync** (optional) so warning shows only once per context.
- **Multi-language ready** via Joomla language files.

## Compatibility

- **Joomla 4.x / 5.x / 6.x**
- PHP syntax is compatible across these versions.

## Install

### Option A: Install from ZIP (recommended)

1. In Joomla Administrator go to **System → Install → Extensions** (or **Extensions → Manage → Install** depending on Joomla version).
2. Upload the package zip: `plg_system_sessionguard.zip`
3. Go to **System → Manage → Plugins**
4. Enable **“System - Session Guard”**

### Option B: Manual install (dev)

- Plugin files go to:
  - `plugins/system/sessionguard/`
- Media files must exist in Joomla’s main media directory (created by the installer):
  - `media/plg_system_sessionguard/css/sessionguard.css`
  - `media/plg_system_sessionguard/js/sessionguard.js`

## Configuration

Open the plugin settings in **Plugins → System - Session Guard**.

- **Enable on Frontend**: Show warnings on site pages.
- **Enable on Backend**: Show warnings in administrator pages.
- **Warning Time (minutes)**: How long before expiry to show the warning.
- **Warning Style**: modal / toast / banner.
- **Custom Warning Message**: Optional override.
- **Enable Auto-Renew**: Automatically renew session.
- **Auto-Renew Threshold (seconds)**: How many seconds before expiry to renew.
- **Cross-Tab Sync**: Sync warning between tabs (per context).

## How it works (high level)

- On each HTML page load (for logged-in users), the plugin injects:
  - `window.SessionGuard` config (expiry timestamp, warning threshold, UI, messages)
  - CSS + JS assets
- JS runs a countdown in the browser and shows a warning at the configured threshold.
- Clicking **Extend Session** calls `com_ajax` using a Joomla token and resets the expiry.

## AJAX endpoint

The JS renews via:

`index.php?option=com_ajax&plugin=sessionguard&group=system&format=raw&{token}=1`

## Troubleshooting

### No CSS/JS requests in Network tab

- Confirm the plugin is **Enabled**
- Confirm you are **logged in**
- Confirm media files exist:
  - `media/plg_system_sessionguard/css/sessionguard.css`
  - `media/plg_system_sessionguard/js/sessionguard.js`

### Warning appears in one context but not the other

- Check plugin params:
  - **Enable on Frontend**
  - **Enable on Backend**

### Auto-renew renews session but warning stays visible

- Update to the latest version of this plugin; auto-renew clears any visible warning UI after renewal.

## License

GNU General Public License version 2 or later (GPL-2.0-or-later).


# Joomla Session Guard (System Plugin)

Warn logged-in users before their Joomla session expires and optionally renew the session via AJAX to prevent unexpected logout.

Works in **Joomla 4 / 5 / 6**.

## Features

- **Automatic session countdown** using Joomla’s configured Session Lifetime.
- **Session expiry warning** before logout (configurable, default 1 minute).
- **Extend Session** button (AJAX renewal) with Joomla token validation.
- **Auto-renew** (optional) a few seconds before expiry.
- **Cross-tab sync** (optional) so warning shows only once (separately for frontend vs backend).
- **Frontend / Backend handling** with automatic context detection.
- **Customizable UI**: modal, toast, or banner.
- **Multi-language ready** via Joomla language files.

## Install

1. Download the installable package:
   - `plugins/system/plg_system_sessionguard.zip`
2. In Joomla Administrator go to **System → Install → Extensions** (or **Extensions → Manage → Install**).
3. Upload the zip and install.
4. Go to **System → Manage → Plugins** and enable **“System - Session Guard”**.

This repository **includes the installable ZIP** at `plugins/system/plg_system_sessionguard.zip` so you can install it directly without building.

## Configure

Open **Plugins → System - Session Guard**:

- Enable on Frontend / Backend
- Warning time (minutes)
- UI type (modal/toast/banner)
- Auto-renew + threshold seconds
- Cross-tab sync
- Custom warning message

## Development notes

- Plugin code: `plugins/system/sessionguard/`
- Media deployed by Joomla installer: `media/plg_system_sessionguard/`
- AJAX endpoint (called by JS):
  - `index.php?option=com_ajax&plugin=sessionguard&group=system&format=raw&{token}=1`

## License

See `LICENSE`.

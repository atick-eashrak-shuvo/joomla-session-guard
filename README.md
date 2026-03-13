# Joomla Session Guard (System Plugin)

> A Joomla **system plugin** that warns users before their session expires and optionally renews the session — with support for **Joomla 4 / 5 / 6**.

---

## ✨ Overview

Unexpected logouts are painful, especially while editing content in the administrator panel.

**Joomla Session Guard** displays a warning before the session ends and lets the user extend the session without reloading the page. It can also auto-renew in the background (optional) to prevent disruption.

---

## 🚀 Features

### Session Countdown + Warning

- Reads Joomla’s configured **Session Lifetime** automatically
- Starts a countdown in the browser
- Shows a warning **X minutes before expiry** (configurable)
- Uses Joomla language strings (multi-language ready)

### Extend Session (AJAX)

- “Extend Session” button renews the session via `com_ajax`
- CSRF-safe with Joomla token validation
- Resets countdown immediately after renewal

### Auto-Renew (Optional)

- Can renew automatically a few seconds before expiry (configurable)
- On successful auto-renew, any visible warning UI is removed

### Cross-Tab Support (Optional)

- Syncs countdown across multiple tabs
- Warning shows only once
- **Frontend and backend are isolated** (no cross-context leakage)

### UI / UX

- Warning styles:
  - Modal
  - Toast
  - Banner
- Frontend vs backend behavior handled automatically

---

## ✅ Compatibility

- **Joomla**: 4.x, 5.x, 6.x
- Works in both **Site** and **Administrator**

---

## 📦 Installation

1. Download the installable ZIP (included in this repository):
   - `plg_system_sessionguard.zip`
2. In Joomla Administrator go to **System → Install → Extensions** (or **Extensions → Manage → Install** depending on version)
3. Upload the ZIP file and install
4. Go to **System → Manage → Plugins**
5. Enable **“System - Session Guard”**

---

## ⚙️ Configuration

Open **Plugins → System - Session Guard**:

- Enable on Frontend / Backend
- Warning time (minutes)
- UI type (modal / toast / banner)
- Auto-renew + threshold seconds
- Cross-tab sync
- Custom warning message

---

## 🧑‍💻 Development

- Plugin code: `plugins/system/sessionguard/`
- Media deployed by Joomla installer: `media/plg_system_sessionguard/`
- AJAX endpoint (called by JS):
  - `index.php?option=com_ajax&plugin=sessionguard&group=system&format=raw&{token}=1`

---

## 📜 License

See `LICENSE` (or `LICENSE.txt`).

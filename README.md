# Budget tracker — installable app (works offline)

An app you install on your phone (and computer). All data is kept **on the device**, so it works without
connection; when online it **syncs with your Google Sheet** (backup + use on several devices).
Default language: English (FR button to switch).

## Folder content

| Folder / file | What it is |
|---|---|
| `app/` | The app: `index.html`, `manifest.webmanifest`, `sw.js` (offline cache), icons, `bg.svg` (background) — published on GitHub Pages |
| `apps-script/Code.gs`, `apps-script/appsscript.json` | The Google Sheet side (sync API) |

The old files at the top of this folder (`Code.gs`, `Index.html`, `appsscript.json`) are from the previous version and can be deleted.

## Installation (once, ~15 minutes)

### 1. Google Sheet + sync API
1. Create a new **Google Sheet** (e.g. `Budget tracker – data`), then **Extensions › Apps Script**.
2. Paste `apps-script/Code.gs` into `Code.gs`. In **Project settings ⚙**, tick *Show "appsscript.json"* and paste `apps-script/appsscript.json`.
3. In the editor, select the function **`setup`** and click **Run** (accept the permissions for your own account).
   The **execution log** shows *Your access code: …* → copy it. (The tabs Accounts, Categories, Goals, Ledger, Settings are created.)
4. **Deploy › New deployment › Web app** — Execute as: **Me**, Who has access: **Anyone** → **Deploy** → copy the **Web app URL** (ends with `/exec`).
   "Anyone" is needed so the app can reach it; every request without your access code is refused.

### 2. Publish the app (GitHub Pages)
1. Create a GitHub repository (e.g. `budget`) and push the **content of `app/`** to it.
2. Repository **Settings › Pages** › Source: *Deploy from a branch* › `main` / `root` → Save.
3. After a minute the app is at `https://<your-account>.github.io/budget/`.
   The page contains no data: your data stays on your devices and in your Sheet.

### 3. Install on the phone
1. Open the GitHub Pages address in **Chrome** › menu **⋮ › Install app** (or *Add to home screen*).
2. Open the installed app › **⚙ Settings › Google Sheet sync** › paste the **Web app URL** and the **access code** › **Connect**.
   If the Sheet is empty, what is on the phone is sent to it; otherwise the Sheet's data is loaded.
3. Repeat on the computer if you want (same URL and code).

## Offline and sync

- Entries are saved on the device immediately, connection or not.
- The cloud icon at the top shows the state: **☁✓** synced · **⏳ n** n changes waiting · **📴** offline · **⚠️** problem (tap it for details) · **📱** not connected to a Sheet.
- Pending changes are sent automatically when the connection comes back (or *Sync now* in Settings).
- When opening the app online, pending changes are sent first, then the Sheet's data is loaded (the Sheet is the reference if you use several devices).
- **Backup**: Settings › *Export (JSON file)* saves everything to a file; *Import* restores it.

## Updating the app later
Replace the files in the GitHub repository. In `sw.js`, change `VERSION` (e.g. `budget-v2`) so phones download the new version;
it is used the next time the app is opened. If `Code.gs` changes: paste it, then **Deploy › Manage deployments › ✏ › New version** (URL unchanged).

## Background image
The default image is an illustration (`bg.svg`). Settings › *Background image* › *Choose a photo* uses your own photo (kept on that device).

## How it works

**Budgets and goals are envelopes.** Money that comes in is put in envelopes; expenses take money out. **To assign** = money in your wallets not yet in an envelope.

Default salary splits — Salary 1: rent 920 000, JIRAMA 250 000, SecretarIA 94 000, SecretarIAroo 94 000, Netflix 20 000, fuel 60 000, God's work 62 000 ·
Salary 2: food 920 000, home maintenance 100 000, laundry 60 000, transport 50 000, God's work 394 000, Land 380 000, Health 190 000, Urgency 190 000.
Goal targets: Urgency 5 000 000 · Health 1 000 000 · Land 50 000 000 · January vacation 2 000 000 · July vacation 5 000 000 · Ohanna 2028 fees 1 250 000 · Car repair 2 000 000.
Everything can be changed in ⚙ Settings.

| Entry | Effect |
|---|---|
| **Salary 1 / 2** | Each month the home screen asks whether it is available. *Yes* → amount and wallet → **for the first salary of the month: Leftover budget** (what is left in each budget, tick the ones to move: keep / share equally between savings goals / one budget or goal / To assign) → each line confirmed one by one with its default amount → summary. A salary cannot be recorded twice for the same month. |
| **Additional income** | *Default split*: ≤ 200 000 Ar shared equally between the goals not yet reached; above, 70 % shared equally between goals and 30 % equally between Aroo, Ohanna and Cece personal use; rounding remainders to Land. Or *Into one budget / goal*. |
| **Saving** | From *To assign* (or a budget) into goals, by need: (target − saved) ÷ months left. |
| **Expense** | Keypad (12 000 + 3 000 works), tap a category = saved. 🚨 Urgency and 🩺 Health can be spent directly. Tapping a budget block on Home opens an expense for it. |
| **Transfer** | Between wallets, optional fee (recorded as an expense). To **🛒 Household pocket** = counted directly as *Food & groceries* spent. |
| **Savings transfer** (advanced) | Goal → goal or goal → budget. |
| **Reassign** (advanced) | Between budgets, or from *To assign*. |

A reached goal keeps its money and gets nothing new; a goal whose deadline has passed stops receiving. July vacation is yearly.

**Budget bars**: spent / budget this month; the black tick = today's pace (budget × today ÷ days in month). Green under the tick, orange above, red = budget exceeded.
**Goals tab**: a coloured block per goal with *Use* and *Transfer*. **Reports**: spending from budgets (amber) vs savings (blue).
**History**: 3 days side by side on a phone, 5 on a computer (◀ ▶); each entry shows from → to.
Any entry can be deleted from History (tap *Delete* twice).

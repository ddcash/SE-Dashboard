# SE-Dashboard

## Description
SE-Dashboard is a local-first bookmark and link manager built to run entirely in the browser. It is designed for personal use, with all data stored on your device in a directory you choose. It works without a server or account by using the browser's File System Access API to read and write files directly in a selected directory.

## Features
- **Local-First & Private:** No online sync, cloud storage, login, or account required. All bookmark data remains in the directory you choose.
- **Bookmark & Category Management:** Create and edit categories with custom icons and colors. Add bookmarks with title, URL, description, and tags. Change bookmark icons using built-in Lucide icons, favicon fetch, custom image URLs, or uploaded local images.
- **Freeform Canvas Layout:** Cards are placed in a scrollable canvas layout. Drag bookmark cards to reposition them freely.
- **Search & Filtering:** Search titles, URLs, descriptions, and tags with fuzzy match. Filter categories with clickable pills. Use the command palette (`Ctrl+K` / `Cmd+K`).
- **Appearance & Theme:** Global theme settings with dark/solid black defaults. Adjust global card opacity and customize individual cards.
- **Hidden Items & Visibility:** Hide/unhide individual bookmarks or categories without deleting data.
- **Import / Export:** Import from HTML (Netscape-style), JSON, and CSV. Export the bookmark database to JSON.
- **Automatic Backups & External Change Detection:** Creates timestamped backups (up to 20 by default). Detects external edits to the master data file and reloads automatically.
- **Universal Link Support:** Supports standard web links (`https://`), local files and folders (`file:///`), and app-specific schemes (e.g., `vscode://`, `obsidian://`).
- **Robust Security:** Implements XSS sanitization for URLs and safely handles user inputs using data attributes.

## Installation
Since SE-Dashboard runs entirely in the browser, there is no traditional installation required.
1. Clone or download this repository to your local machine.
2. The core application is located in the `bookmark-manager/` folder.

## How to setup/configure
1. **Choose a Directory:** Create an empty folder on your computer where you want to store your bookmark data.
2. **Browser Requirements:** Open `bookmark-manager/index.html` in a browser that supports the File System Access API (such as Google Chrome or Microsoft Edge). *Note: It is not guaranteed to work in browsers that do not implement this API.*
3. **Connect Directory:** Click "Connect Directory" in the application and select the folder you created.
4. The app will automatically initialize and create the following structure inside your folder:
   - `master_bookmarks.json` — Main bookmark data.
   - `local_settings.json` — UI layout and hidden item settings.
   - `backups/` — Timestamped snapshots of your bookmark data.
   - `assets/` — Uploaded image/icon assets.

## How to use
- **Adding Items:** Start by creating a category, then add bookmarks to it.
- **Customizing Layout:** Drag and drop cards to arrange your dashboard visually. The positions are automatically saved.
- **Command Palette:** Press `Ctrl+K` (or `Cmd+K` on Mac) to open the command palette. From here, you can search, change themes, toggle hidden items, and safely update the shared `master_bookmarks.json` file via the master editor.
- **Restoring Sessions:** When you reopen the app, it can resume the last directory if browser permissions are still granted. If the browser cannot restore the saved directory handle, reconnect by selecting the same folder again.
- **Development & Testing:** The repository includes testing scripts (`test.js`, `test-ui.js`, `test_xss.js`) to ensure functionality and security. To run Playwright UI tests, ensure dependencies are installed (`pnpm i playwright` & `npx playwright install chromium`) and run `node test.js` or `node test-ui.js`. Run `node test_xss.js` to verify URL sanitization.

## Disclaimers
This project is intended as a personal local bookmark dashboard. Ensure you regularly backup your chosen data directory, although the application does create automatic snapshots in the `backups/` folder.

## License
There is no license file included in this repository.

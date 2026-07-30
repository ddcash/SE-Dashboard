# SE-Dashboard

## Description

SE-Dashboard is a highly optimized, local-first bookmark and link manager designed to run entirely in the browser. It operates securely without a server or account by utilizing the browser's native File System Access API to seamlessly read and write files directly to a directory of your choice.

## Features

### 📌 Bookmark & Category Management
- **Create & Edit:** Manage categories with custom colors and Lucide icons. Add bookmarks with a title, URL, description, and descriptive tags.
- **Icon Customization:** Set bookmark icons using built-in Lucide icons, automatic favicon fetching, custom web URLs, or directly uploaded local image assets.
- **Move & Organize:** Seamlessly move bookmarks between categories directly from the editor.
- **Icon Visibility:** Toggle the visibility of icons for a cleaner, minimalist aesthetic.

### 🖼️ Freeform Canvas Layout & Groups
- **Scrollable Canvas:** Cards are placed on an expansive, freeform scrollable canvas layout.
- **Visual Groups:** Visually organize cards by creating resizable **Groups**. You can freely drag and drop bookmark cards around the canvas or directly in and out of groups.
- **Layout Persistence:** Card and group coordinates are securely saved in `local_settings.json` and persist across all your sessions.
- **Auto-Arrange:** Reset the layout to its default grid arrangement instantly via the command palette.

### 🔍 Search & Filtering
- **High-Performance Fuzzy Match:** Search across titles, URLs, descriptions, and tags with a highly optimized string-matching algorithm.
- **Actionable Empty States:** If a search yields no results, clear empty states feature helpful Call-to-Action (CTA) buttons to quickly clear filters or create new items.
- **Category Filters:** Filter your view instantly by clicking category pills.
- **Preserved Layouts:** When clearing search filters, your custom freeform canvas layout is perfectly preserved.

### 🎨 Appearance & Theme
- **Dynamic Backgrounds:** Choose between a solid dark theme, gradient backgrounds, or custom uploaded image backgrounds.
- **Opacity Control:** Adjust global card opacity or override opacity for individual bookmark cards.
- **Asset Gallery Previews:** Visually preview uploaded images and custom icons in a built-in gallery view before applying them.

### 👁️ Hidden Items & Visibility
- **Hide Items:** Hide individual bookmarks or entire categories without permanently deleting your data.
- **Toggle Visibility:** Easily reveal hidden items from the command palette at any time.

### 🔄 Import / Export
- **Import Engine:** Import your existing bookmarks from standard Netscape HTML exports, JSON files, or CSV formats.
- **Export Data:** Export your current bookmark database as a standard JSON file.

### 🌐 Master File Editing & Publishing
- **Master Editor:** Safely update the shared `master_bookmarks.json` file from within the app using the visual Master Editor or raw JSON editor.
- **Publish to Master:** Publish entire personal categories directly to the shared master file directly from the category editor.
- **Remote Integration:** Support for accessing the master file via a remote URL, with updates integrated via HTTP PUT requests.

### ⚡ Performance & Security (Recent Updates)
- **Optimized Rendering:** Highly optimized DOM rendering and event loop bindings (including rapid group injections), ensuring maximum framerates and a smooth experience even on massive dashboards.
- **XSS Protection:** Robust security protocols against Cross-Site Scripting (XSS) vulnerabilities via strict data-attribute handling for inline event handlers.
- **Protocol Obfuscation Filters:** Active prevention against malicious URL protocol obfuscation (e.g., `javascript:`, `data:`).
- **Text Formatting Fixes:** Addressed UI text formatting issues on image backgrounds and edge cases related to layout persistence.

## Installation

Because SE-Dashboard is a local-first application built with vanilla web technologies, there is no traditional installation required!

1. Clone or download this repository to your local machine.
2. Navigate to the `bookmark-manager/` folder.
3. Open `index.html` directly in your modern web browser.

## How to setup/configure

1. **Choose a Data Directory:** Create a new, empty folder anywhere on your computer (e.g., `Documents/BookmarksData`). This is where your data will live safely.
2. **Browser Requirements:** Open `bookmark-manager/index.html` in a modern browser that supports the File System Access API (such as Google Chrome, Microsoft Edge, or Opera).
3. **Connect Directory:** Click the **"Connect Directory"** button on the application's welcome screen and select the folder you created in step 1.
4. **Initialization:** The app will automatically initialize and create the following underlying file structure inside your chosen folder:
   - `master_bookmarks.json` — The main file containing your bookmark data.
   - `local_settings.json` — Stores your UI layout, themes, and hidden item configurations.
   - `backups/` — Automatically generated timestamped snapshots of your bookmark data.
   - `assets/` — Stores uploaded image backgrounds and local icon assets.

## How to use

- **Navigating the Command Palette:** The core of the app! Press `Ctrl+K` (or `Cmd+K` on Mac) to open the interactive Command Palette. From here, you can search for items, change themes, toggle hidden elements, create groups, or edit the master file.
- **Adding Items:** Start by creating a category from the Command Palette, then click the add button to insert bookmarks into it.
- **Arranging the Dashboard:** Create **Groups** from the command palette. Drag and drop cards freely around the canvas or directly into groups to visually arrange your workspace.
- **Publishing Categories:** Open the Category Editor and click **"Publish to Master"** to easily share a personal category directly with the shared master file.
- **Customizing Appearance:** Open **Settings** from the command palette to upload background images, configure custom colors, and access the Asset Gallery.
- **Restoring Sessions:** When reopening the application, it will attempt to resume the last used directory. If browser permissions have expired, simply click to reconnect the same folder.
- **Development & Testing:** Testing scripts (`test.js`, `test-ui.js`, `test_xss.js`) are included. Run Playwright UI tests with `node test.js` or `node test-ui.js` after installing dependencies (`pnpm i playwright` & `npx playwright install chromium`).

## Disclaimers

This project is intended as a personal local bookmark dashboard. While the application does create automatic snapshots in the `backups/` folder, please ensure you regularly backup your chosen data directory to a secondary location to prevent accidental data loss.

## License

There is no formal license file included in this repository.

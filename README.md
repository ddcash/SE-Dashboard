# SE-Dashboard

![Dashboard Overview](assets/dashboard_overview.png)

## Description

SE-Dashboard is a local-first bookmark and link manager built to run entirely in the browser. It is designed for personal use, with all data stored on your device in a directory you choose. It works without a server or account by using the browser's File System Access API to read and write files directly in a selected directory. It's a completely private, serverless solution.

## Features

### Bookmark & Category Management
- **Create & Edit:** Create and edit categories with custom icons and colors.
- **Bookmarks:** Add bookmarks to categories with title, URL, description, and tags.
- **Custom Icons:** Change bookmark icons using built-in Lucide icons, favicon fetch from website hosts, custom image URLs, or uploaded local images.
- **Organization:** Move bookmarks between categories from the editor.
- **Hide Icon Setting:** Toggle the visibility of icons for a cleaner look.

### Freeform Canvas Layout & Groups
![Canvas and Groups](assets/canvas_groups.png)
- **Canvas Layout:** Cards are placed in a scrollable canvas layout.
- **Groups:** Create resizable **Groups** to visually organize cards on the canvas.
- **Drag & Drop:** Drag bookmark cards to reposition them freely, or drag them in and out of groups.
- **Layout Reset:** Reset layout from the command palette to restore the default arrangement for top-level items.
- **Layout Persistence:** Positions (including group assignments) are securely saved in `local_settings.json` and persist across sessions.

### Search & Filtering
![Search UI](assets/search_ui.png)
- **Fuzzy Search:** Search titles, URLs, descriptions, and tags with fuzzy match.
- **Actionable Empty States:** Clear and actionable empty states when search yields no results featuring Call-to-Action (CTA) buttons to quickly create new items or clear filters.
- **Category Filters:** Filter categories with clickable pills.
- **Preserve Layout:** Preserve your current card layout when search is cleared.
- **Command Palette:** Use keyboard shortcut `Ctrl+K` / `Cmd+K` to open the command palette.
- **Hidden Items:** Toggle hidden items on or off.

### Appearance & Theme
![Theme Options](assets/theme_settings.png)
- **Themes:** Dark theme defaults to a solid black background.
- **Backgrounds:** Choose between solid color, gradient, or image backgrounds. Background images scale to fit without cropping.
- **Opacity Control:** Adjust global card opacity for the dashboard and override opacity for individual cards when editing a bookmark.
- **Customization:** Customize accent colors, font scale, and category badge visibility.
- **Asset Gallery Previews:** Preview uploaded images and custom icons in a built-in gallery view.

### Hidden Items & Visibility
- **Hide Items:** Hide individual bookmarks or categories without deleting data.
- **Reveal:** Reveal hidden items at any time via the command palette.
- **Separation:** Hidden visibility is stored separately from the main bookmark data in `local_settings.json`.

### Import / Export
- **Import:** Import bookmarks from Netscape-style bookmark HTML exports, JSON files, and CSV files.
- **Export:** Export the current bookmark database as JSON.

### Local Asset Uploads
- **Custom Assets:** Upload custom image files for bookmark icons or backgrounds.
- **Storage:** Uploaded assets are stored inside the app directory's `assets/` folder.
- **Rendering:** Local images are rendered using browser object URLs for optimal performance.

### Backups & External Change Detection
- **Automatic Backups:** Creates timestamped backups in `backups/`. Keeps up to 20 backup files by default.
- **Change Detection:** Detects external edits to `master_bookmarks.json` and reloads automatically.

### Master File Editing & Publishing
![Master Editor](assets/master_editor.png)
- **Master Editor:** The shared `master_bookmarks.json` file can be updated from within the app using the master editor.
- **Publish to Master:** Publish entire personal categories directly to the shared master file from the category editor.
- **Command Palette Access:** Open the command palette with `Ctrl+K` / `Cmd+K` and select **Edit Master Bookmarks**.
- **Dual Mode Editor:** The master editor supports both a visual category/bookmark editor and a raw JSON editor.
- **Remote URLs:** The master file can be accessed from a remote URL. Edits and updates to the master file via HTTP PUT are seamlessly integrated.

### Performance & Security
- **Optimized Rendering:** Highly optimized DOM rendering (including group injections) and efficient native event loop bindings, ensuring maximum framerates even on large dashboards.
- **Search Optimization:** Enhanced search filtering performance with optimized string matching algorithms.
- **XSS Protection:** Robust protection against XSS vulnerabilities via strict data-attribute handling for inline events, and URL protocol obfuscation filters.

## Installation

Since SE-Dashboard runs entirely in the browser, there is no traditional installation required.

1. Clone or download this repository to your local machine.
2. The core application is located in the `bookmark-manager/` folder.
3. No dependencies like `npm` or `yarn` are needed for the core app. Just open the HTML file.

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

- **Adding Items:** Start by creating a category (via Command Palette or UI), then add bookmarks to it.
- **Customizing Layout & Groups:** Create groups from the command palette (`Ctrl+K` -> "New Group") to visually containerize bookmarks. Drag and drop cards around the canvas or into groups to arrange your dashboard visually. The positions are automatically saved and persistent across sessions.
- **Publishing:** From the Category Editor, you can easily "Publish to Master" to share an entire personal category directly with the shared master file.
- **Using Assets:** Upload images for custom icons or backgrounds, and preview them via the asset gallery preview in the settings or card editor.
- **Command Palette:** Press `Ctrl+K` (or `Cmd+K` on Mac) to open the command palette. From here, you can search, change themes, toggle hidden items, hide icons, create groups, and safely update the shared `master_bookmarks.json` file via the master editor.
- **Restoring Sessions:** When you reopen the app, it can resume the last directory if browser permissions are still granted. If the browser cannot restore the saved directory handle, simply reconnect by selecting the same folder again.
- **Development & Testing:** The repository includes testing scripts (`test.js`, `test-ui.js`, `test_xss.js`) to ensure functionality and security. To run Playwright UI tests, ensure dependencies are installed (`pnpm i playwright` & `npx playwright install chromium`) and run `node test.js` or `node test-ui.js`. Run `node test_xss.js` to verify URL sanitization.

### File Structure

```
SE-Dashboard/
  README.md
  Ideas and Enhancements.md
  bookmark-manager/
    index.html
    app.js
    config.js
    styles.css
    vendors.js
  DOCS/
    bookmark_manager_plan.md
    GRAPH_REPORT.md
```

## Disclaimers

This project is intended as a personal local bookmark dashboard. Ensure you regularly backup your chosen data directory, although the application does create automatic snapshots in the `backups/` folder. It relies heavily on modern browser APIs which may not be fully supported in all environments (like Firefox or Safari).

## License

The project is intended as a personal local bookmark dashboard. There is no formal license file included in this repository. Use it freely for personal productivity.

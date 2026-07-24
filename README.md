# SE-Dashboard

## Description
SE-Dashboard is a local-first bookmark and link manager built to run entirely in the browser. It is designed for personal use, with all data stored on your device in a directory you choose. It works seamlessly without a server or account by using the browser's native File System Access API to read and write files directly in your selected local directory.

## Features

### Bookmark & Category Management
- **Extensive Metadata:** Add bookmarks to categories with titles, URLs, descriptions, and searchable tags.
- **Visual Customization:** Create and edit categories with custom icons and accent colors.
- **Flexible Iconography:** Change bookmark icons using built-in Lucide icons, favicon fetching from website hosts, custom image URLs, or uploaded local images.
- **Card Styling:** Customize individual cards with background colors, border styles, and text color configurations to fit your aesthetic.
- **Hide Icon Setting:** Toggle the visibility of icons for a cleaner, minimalist look.
- **Seamless Organization:** Move bookmarks smoothly between categories using the built-in editor.

### Freeform Canvas Layout & Grouping
- **Interactive Canvas:** Cards are placed in a freeform, scrollable canvas layout that you can freely pan and interact with.
- **Draggable Cards:** Drag bookmark cards to reposition them freely anywhere on the canvas.
- **Visual Groups:** Create resizable, dashed-border Groups to visually containerize and organize your cards. Cards can be dragged in and out of groups at will.
- **Layout Persistence:** All positions (including absolute coordinates and group assignments) are securely saved in `local_settings.json` and persist across sessions.
- **Layout Reset:** Reset the layout from the command palette to restore the default grid arrangement at any time.

### Search & Filtering
- **Fuzzy Search:** Rapidly search across titles, URLs, descriptions, and tags using fuzzy string matching for optimized performance.
- **Empty States & CTAs:** Clear and actionable empty states appear when a search yields no results, complete with Call-to-Action (CTA) buttons to quickly create new items or clear your current filters.
- **Category Filtering:** Filter by categories using clickable, color-coded pills.
- **Layout Preservation:** Your custom card layout is preserved when search is cleared.

### Appearance & Theme
- **Dark Mode Default:** A premium dark theme default with glassmorphic elements.
- **Background Customization:** Choose between a solid color, gradient, or full image background for the dashboard.
- **Asset Gallery Previews:** Uploaded custom images and icons can be easily viewed in a built-in gallery preview component.
- **Global & Local Opacity:** Adjust global card opacity for the dashboard, or override opacity for individual cards when editing a bookmark.
- **Fine-Tuned Typography & UI:** Customize accent colors, font scales, category badge visibility, and text formatting on custom backgrounds.

### Master File Editing & Publishing
- **Master Data Sharing:** Share the `master_bookmarks.json` file across instances or users. The file can even be accessed and updated securely from remote URLs via seamless HTTP PUT integration.
- **Built-in Editor:** The Master File can be updated from within the app using a specialized master editor supporting both a visual UI and a raw JSON mode.
- **Publish to Master:** Need to share a specific set of links? Publish entire personal categories directly to the shared master file directly from the category editor.

### Import / Export & Local Assets
- **Rich Imports:** Import bookmarks from standard Netscape-style HTML exports (Chrome/Safari), JSON files, and CSV files, efficiently handling and merging categories.
- **Data Export:** Export your current entire bookmark database reliably as JSON.
- **Local Asset Management:** Upload custom image files for bookmark icons or full background imagery. Uploaded assets are stored directly inside the app directory's `assets/` folder and rendered securely using browser object URLs.

### Security, Performance, and Integrity
- **Optimized Rendering:** Highly optimized DOM rendering using efficient native event loop bindings, ensuring maximum framerates—even with large datasets and complex group injections.
- **XSS & Protocol Protection:** Robust protection against XSS vulnerabilities via strict data-attribute handling for inline events, and URL protocol obfuscation filters to safely handle complex schema configurations (e.g., `file://`, custom app schemes).
- **Accessible Forms:** Adherence to web accessibility standards featuring explicit label associations and ARIA-compliant empty state live regions.
- **Automatic Backups:** Creates automatic, timestamped backup snapshots inside the `backups/` folder (keeping up to 20 defaults).
- **External Change Detection:** Actively detects external edits to the `master_bookmarks.json` file and automatically reloads the dashboard to prevent data desynchronization.

## Installation

Since SE-Dashboard runs entirely in the browser using standard web APIs, there is no traditional installation, server, or backend setup required.

1. Clone or download this repository directly to your local machine.
2. The core application logic and interface are located entirely within the `bookmark-manager/` folder.

## How to setup/configure

1. **Choose a Workspace:** Create an empty folder anywhere on your computer (e.g., `Documents/MyBookmarks`) where you want to store your dashboard's data and assets.
2. **Browser Requirements:** Open the `bookmark-manager/index.html` file in a modern browser that supports the **File System Access API** (such as Google Chrome, Microsoft Edge, or other Chromium-based browsers). *Note: Firefox and Safari currently have limited or no support for this API.*
3. **Connect Directory:** On the dashboard's welcome screen, click "Connect Directory" and select the empty folder you just created.
4. **Initialization:** The app will request permissions and automatically initialize the required structure inside your folder:
   - `master_bookmarks.json` — The main data store for all bookmark metadata.
   - `local_settings.json` — Your local UI, session, and hidden item preferences.
   - `backups/` — A folder for timestamped database snapshots.
   - `assets/` — A folder for storing your uploaded images and custom icons.

## How to use

- **Adding Data:** Start by creating a category using the "New Category" button or command palette, then add new bookmarks to it.
- **Customizing Layouts:**
  - Open the command palette to create **Groups**.
  - Drag and drop cards anywhere around the canvas or directly inside groups to visually containerize your links.
  - Positions are automatically saved and persistent when you reopen the app.
- **Publishing & Sharing:** From the Category Editor, you can easily "Publish to Master" to push your personal links to a shared or remote `master_bookmarks.json` file.
- **Command Palette:** Press `Ctrl+K` (or `Cmd+K` on macOS) to instantly open the powerful command palette. From here, you can:
  - Create New Categories or Groups
  - Search your bookmarks
  - Toggle hidden items and icon visibility
  - Access global settings or change your background
  - Safely edit the master data
- **Session Restoring:** When reopening `index.html`, the application can seamlessly resume the last used directory if your browser permissions are still granted. If they expire, simply reconnect by selecting the same folder again.
- **Development & Testing:** The repository includes rigorous testing scripts (`test.js`, `test-ui.js`, `test_xss.js`) to ensure UI integrity, security, and rendering correctness. To run Playwright UI tests, ensure dependencies are installed (`pnpm i playwright` & `npx playwright install chromium`) and run `node test.js` or `node test-ui.js`. Run `node test_xss.js` to verify URL sanitization.

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

This project is intended strictly as a personal local bookmark dashboard. While the application automatically creates redundant snapshots in the `backups/` folder, you should ensure you regularly back up your chosen data directory using your preferred file backup tools to avoid unintended data loss.

## License

The project is intended as a personal local bookmark dashboard. There is no official license file included in this repository.

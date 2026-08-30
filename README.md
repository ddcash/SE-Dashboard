# SE-Dashboard

## Description

SE-Dashboard is a highly customizable, local-first bookmark and link manager built to run entirely in your web browser. Designed primarily for personal use, it ensures your data remains completely under your control by storing all files directly on your device in a directory of your choosing. By leveraging the modern browser File System Access API, it operates without requiring a backend server, user accounts, or cloud synchronization.

## Features

### 📌 Bookmark & Category Management
- **Categorization**: Create and edit categories with custom icons and distinct color coding.
- **Rich Bookmarks**: Add detailed bookmarks with titles, URLs, custom descriptions, and searchable tags.
- **Icon Customization**: Change bookmark icons using built-in Lucide icons, automatically fetched website favicons, custom image URLs, or upload your own local images.
- **Drag & Drop Reordering**: Seamlessly move bookmarks between categories directly from the editor.
- **Hide Icon Setting**: Toggle the visibility of icons for a cleaner, text-focused look.

### 🎨 Freeform Canvas Layout & Groups
- **Scrollable Canvas**: Cards are placed in a freeform, scrollable canvas layout rather than a rigid grid.
- **Visual Grouping**: Create resizable **Groups** to visually organize cards on the canvas. Drag bookmark cards to reposition them freely, or drag them in and out of groups.
- **Layout Persistence**: Card positions, including group assignments, are securely saved in your `local_settings.json` and persist across sessions.
- **Reset Layout**: Easily reset the layout from the command palette to restore the default, organized arrangement.

### 🔍 Search & Filtering
- **Fuzzy Search**: Quickly find what you need by searching across titles, URLs, descriptions, and tags using fuzzy matching.
- **Smart Empty States**: Clear and actionable empty states appear when a search yields no results, featuring helpful Call-to-Action (CTA) buttons to quickly create new items or clear filters.
- **Category Filters**: Filter by specific categories using convenient clickable pills.
- **Non-Destructive**: Preserve your meticulous card layout even when a search is cleared.
- **Quick Access**: Use keyboard shortcut `Ctrl+K` / `Cmd+K` to open the command palette anywhere.
- **Hidden Items Toggle**: Easily toggle hidden items on or off from the palette.

### 🎭 Appearance & Theme
- **Dark Mode Default**: Features a sleek dark theme defaulting to a solid black background.
- **Custom Backgrounds**: Choose between solid colors, gradients, or custom image backgrounds.
- **Opacity Controls**: Adjust global card opacity for the entire dashboard, or override opacity for individual cards when editing a specific bookmark.
- **Fine-Tuning**: Customize accent colors, font scales, and category badge visibility to match your style.
- **Asset Gallery Previews**: Preview uploaded images and custom icons in a built-in gallery view before applying them.

### 🔐 Hidden Items & Visibility
- **Privacy Control**: Hide individual bookmarks or entire categories without permanently deleting their data.
- **Toggle Visibility**: Reveal hidden items at any time via the command palette.
- **Isolated Storage**: Hidden visibility state is stored separately from the main bookmark data in your local settings.

### 📥 Import / Export
- **Broad Compatibility**: Import bookmarks from standard Netscape-style HTML exports (Chrome/Firefox/Safari), JSON files, and CSV files.
- **Easy Backup**: Export your current bookmark database as a standard JSON file at any time.

### 🖼️ Local Asset Uploads
- **Custom Icons & Backgrounds**: Upload custom image files directly from your computer to use as bookmark icons or dashboard backgrounds.
- **Local Storage**: Uploaded assets are safely stored inside your app directory's `assets/` folder.
- **Object URLs**: Local images are rendered securely using browser object URLs.

### 🛡️ Backups & External Change Detection
- **Automatic Snapshots**: Creates timestamped backup files automatically in the `backups/` folder.
- **Retention Limit**: Keeps up to 20 recent backup files by default to prevent storage bloat.
- **Hot Reloading**: Automatically detects external edits made to `master_bookmarks.json` and reloads the dashboard to reflect changes instantly.

### 📝 Master File Editing & Publishing
- **In-App Editor**: The shared `master_bookmarks.json` file can be updated directly from within the app using the dedicated master editor.
- **Publish to Master**: Share your curated lists by publishing entire personal categories directly to the shared master file from the category editor.
- **Dual Editor Modes**: The master editor supports both a visual category/bookmark editor for easy changes and a raw JSON editor for power users.
- **Remote URLs**: The master file can be accessed from a remote URL. Edits and updates to the master file via HTTP PUT are seamlessly integrated.

### ⚡ Performance & Security Improvements
- **Optimized Rendering**: Highly optimized DOM rendering (including group injections) and efficient native event loop bindings ensure maximum framerates, even on large, complex dashboards.
- **Fast Search**: Enhanced search filtering performance with optimized string matching algorithms.
- **Strict Security**: Robust protection against Cross-Site Scripting (XSS) vulnerabilities via strict data-attribute handling for inline events, and URL protocol obfuscation filters to prevent execution of malicious `javascript:` or `data:` links.

## Installation

Since SE-Dashboard runs entirely within your web browser, there is no traditional software installation required.

1. Clone or download this repository to your local machine.
2. The core application is located inside the `bookmark-manager/` folder.

## How to setup/configure

1. **Choose a Directory:** Create an empty folder on your computer where you want to store your bookmark data and assets (e.g., `MyDashboardData`).
2. **Browser Requirements:** Open `bookmark-manager/index.html` in a modern browser that fully supports the File System Access API (such as Google Chrome, Microsoft Edge, or other Chromium-based browsers). *Note: The application is not guaranteed to work in browsers that do not implement this API (like Firefox or older Safari).*
3. **Connect Directory:** Click the "Connect Directory" button in the application and select the empty folder you just created.
4. **Initialization:** The app will automatically initialize and create the necessary file structure inside your chosen folder:
   - `master_bookmarks.json` — Your main bookmark and category data.
   - `local_settings.json` — Your UI layout, theme, and hidden item settings.
   - `backups/` — Directory containing timestamped snapshots of your bookmark data.
   - `assets/` — Directory containing your uploaded image and icon assets.

## How to use

- **Adding Items:** Start by creating a new category, then add individual bookmarks to it.
- **Customizing Layout & Groups:** Open the command palette to create Groups to visually containerize your bookmarks. Drag and drop cards anywhere around the canvas or into groups to arrange your dashboard visually. Your custom positions are automatically saved and persistent across sessions.
- **Publishing:** From the Category Editor, use the "Publish to Master" feature to share an entire personal category directly to the shared master file.
- **Using Assets:** Upload images for custom icons or background wallpapers, and preview them via the built-in asset gallery preview before applying.
- **Command Palette:** Press `Ctrl+K` (or `Cmd+K` on Mac) to open the powerful command palette. From here, you can search, change themes, toggle hidden items, toggle icon visibility, and safely update the shared `master_bookmarks.json` file via the master editor.
- **Restoring Sessions:** When you reopen the app, it will attempt to resume using your last directory if browser permissions are still granted. If the browser cannot restore the saved directory handle, simply reconnect by selecting the same folder again.
- **Development & Testing:** The repository includes comprehensive testing scripts (`test.js`, `test-ui.js`, `test_xss.js`) to ensure functionality and security. To run Playwright UI tests, ensure dependencies are installed (`pnpm i playwright` & `npx playwright install chromium`) and run `node test.js` or `node test-ui.js`. Run `node test_xss.js` to verify URL sanitization.

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

This project is intended strictly as a personal, local bookmark dashboard. While the application does create automatic snapshot backups in the `backups/` folder, you should always ensure you regularly and independently backup your chosen data directory to prevent data loss.

## License

This project is intended as a personal local bookmark dashboard. There is no official open-source license file included in this repository. All rights reserved by the original author unless otherwise specified.

# SE-Dashboard

## Description

SE-Dashboard is a local-first bookmark and link manager built to run entirely in the browser. It is designed for personal use, with all data stored securely on your device in a directory of your choosing. Operating completely without a backend server or required accounts, it leverages the browser's native File System Access API to seamlessly read and write files directly in your selected folder. This ensures maximum privacy, complete ownership of your data, and high-performance offline capabilities.

## Features

### Bookmark & Category Management
- **Extensive Organization**: Create and edit categories with custom icons and unique colors.
- **Rich Bookmarks**: Add detailed bookmarks with title, URL, description, and searchable tags.
- **Versatile Icons**: Customize bookmark icons using the built-in Lucide library, automatically fetched website favicons, external image URLs, or directly uploaded local image assets.
- **Easy Reallocation**: Move bookmarks between categories instantly via the editor.
- **Hide Icon Setting**: Toggle the visibility of icons for a cleaner, minimalist aesthetic.
- **Dynamic Empty States**: Clear and actionable empty state screens with contextual Call-to-Action (CTA) buttons (like "Clear Search" or "Create Category") guide you out of dead ends.

### Freeform Canvas Layout & Groups
- **Draggable Canvas**: Cards are placed in a fluid, scrollable canvas layout that allows you to drag bookmark cards to reposition them freely.
- **Smart Grouping**: Create visually distinct, resizable **Groups** from the command palette to organize related cards on the canvas. Drag cards smoothly in and out of groups.
- **Layout Persistence**: Bookmark positions, group structures, and layout wrapping are securely saved in `local_settings.json`, ensuring your exact workspace layout persists across all sessions.
- **Layout Reset**: Easily reset the top-level layout from the command palette to restore a default grid arrangement while preserving intra-group positions.

### Command Palette & Search
- **Universal Palette**: Use the keyboard shortcut `Ctrl+K` (or `Cmd+K` on Mac) to open a powerful command palette.
- **Quick Actions**: Instantly execute actions like "New Category", "New Group", "Edit Category", "Change Background", or "Edit Master Bookmarks".
- **Fuzzy Search**: Search rapidly across titles, URLs, descriptions, and tags. The optimized string matching algorithm ensures zero lag even with thousands of items.
- **Filter Tags**: Filter your dashboard effortlessly with clickable category pills.
- **Search Context**: Preserve your meticulously arranged card layout perfectly when search or filters are cleared.

### Master File Editing & Publishing
- **Collaborative Sharing**: The shared `master_bookmarks.json` file can be updated directly from within the app using the integrated Master Editor.
- **Publish to Master**: Conveniently publish entire personal categories directly to the shared master file directly from the Category Editor.
- **Dual Editing Modes**: The master editor supports both a visual category/bookmark interface and a raw JSON editor for power users.
- **Remote URLs**: The master file can seamlessly be accessed from a remote URL. Edits and updates to the master file via HTTP PUT are natively integrated, allowing cloud-like synchronization while remaining local-first.

### Appearance & Theming
- **Dark Mode**: Comes with a beautifully crafted dark theme defaulting to a solid dark canvas.
- **Custom Backgrounds**: Choose between elegant solid colors, CSS gradients, or upload your own image backgrounds.
- **Opacity Controls**: Adjust global card opacity for a glassmorphic effect, and even override opacity for individual cards.
- **Personalized Accents**: Customize accent colors, adjust font scale, and toggle category badge visibility.
- **Asset Gallery Previews**: Browse and preview uploaded images and custom icons in the built-in gallery view.
- **Visibility Toggles**: Hide individual bookmarks or whole categories without deleting underlying data, and reveal them at any time.

### Import & Export
- **Flexible Importing**: Import bookmarks from standard Netscape-style HTML exports (Chrome/Safari), structured JSON files, or CSV lists.
- **Data Deduplication**: Import logic intelligently integrates new categories and links while preventing duplicate entries.
- **JSON Export**: Export your entire current bookmark database at any time as a portable JSON file.

### Local Asset Uploads
- **Direct Attachments**: Upload custom image files for bookmark icons, category thumbnails, or app backgrounds.
- **Organized Storage**: Uploaded assets are securely stored inside your connected directory's `assets/` folder.
- **Performant Rendering**: Local images are rendered instantly using optimized browser object URLs.

### Backups & Data Integrity
- **Automatic Snapshots**: The app creates automatic, timestamped backup files in the `backups/` folder every time significant changes occur.
- **Rolling History**: Keeps a rolling history of up to 20 backup files by default to prevent storage bloat.
- **External Change Detection**: Actively detects external edits to `master_bookmarks.json` and prompts to reload the dashboard automatically.

### Performance & Security Highlights
- **Highly Optimized Rendering**: Reconstructs DOM elements dynamically using advanced, efficient HTML string concatenation and native event loop bindings, ensuring maximum framerates—even during high-frequency dragging or search filtering on massive dashboards.
- **Advanced XSS Protection**: Strict sanitization protocols and localized dataset attributes prevent Cross-Site Scripting (XSS) vulnerabilities, fully neutralizing risks from interpolated inline event handlers or imported malicious JSON.
- **Protocol Obfuscation Filters**: Blocks unsafe URI schemes (e.g., `javascript:`, `data:`, `vbscript:`) while safely allowing custom app deep links and standard web protocols.

## How to setup/configure

1. **Choose a Directory:** Create an empty folder anywhere on your computer where you want to securely store your bookmark data and assets.
2. **Browser Requirements:** Open `bookmark-manager/index.html` in a modern browser that fully supports the **File System Access API** (such as Google Chrome, Microsoft Edge, or Chromium-based equivalents). *Note: The app is not guaranteed to function properly in browsers like Firefox or Safari that limit or do not implement this API.*
3. **Connect Directory:** Click the **"Connect Directory"** button on the application's launch screen and select the folder you just created.
4. **Initialization:** The app will automatically initialize and scaffold the following structure inside your chosen folder:
   - `master_bookmarks.json` — Your main bookmark data and category structures.
   - `local_settings.json` — Your UI layout positions, group structures, and hidden item settings.
   - `backups/` — Folder containing automatic timestamped snapshots of your bookmark data.
   - `assets/` — Folder containing any custom uploaded image/icon assets.

## How to use

- **Adding Items:** Start by creating a Category via the command palette or UI buttons, then add bookmarks into it.
- **Customizing Layout & Groups:** Press `Ctrl+K` to open the command palette and select **New Group** to create a visual container. Drag and drop cards anywhere around the freeform canvas, or drag them directly into groups to snap them into place. Your positions are automatically saved.
- **Publishing:** From the Category Editor, you can click "Publish to Master" to easily share an entire personal category directly with the shared master file.
- **Using Assets:** Upload images for custom icons or backgrounds during item creation, and preview them via the asset gallery preview.
- **Command Palette (`Ctrl+K` / `Cmd+K`):** Use this powerful shortcut to quickly access actions: search, edit categories, create groups, change backgrounds, toggle visibility settings, or safely open the **Master Editor** to update `master_bookmarks.json`.
- **Restoring Sessions:** When you reopen the `index.html` file later, the app can often resume the last connected directory if browser permissions are still granted. If the browser requires re-authentication, simply click the connect button and select the same folder again.
- **Development & Testing:**
  - To verify functionality and security, Playwright tests are included (`test.js` and `test-ui.js`).
  - Run `pnpm i playwright && npx playwright install chromium` first.
  - Run `node test-ui.js` to execute UI and XSS verification scripts locally.

## Installation

Since SE-Dashboard runs entirely natively within your browser, there is no traditional installation required.

1. **Clone or Download** this repository to your local machine (e.g., as a `.zip` file and extract it).
2. The core application files are located in the `bookmark-manager/` folder.
3. Open `bookmark-manager/index.html` in your browser.

## Disclaimers

This project is intended strictly as a personal, local-first bookmark dashboard. While the application does create automatic snapshots in the `backups/` folder, you should ensure you regularly back up your chosen data directory using your standard system backup tools (e.g., Time Machine, OneDrive, or manual copies) to prevent accidental data loss.

## License

This project is intended for personal use as a local bookmark dashboard. There is no official license file included in this repository; use and modify it at your own risk for personal productivity.

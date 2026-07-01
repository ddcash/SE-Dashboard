# SE-Dashboard

SE-Dashboard is a local-first bookmark and link manager built to run entirely in the browser. It is designed for personal use, with all data stored on your device in a directory you choose.

## Overview

The application is located in the `bookmark-manager/` folder. It works without a server or account by using the browser's File System Access API to read and write files directly in a selected directory.

Key capabilities:
- Organize bookmarks into categories
- Custom icons, tags, and descriptions
- Drag cards freely across a canvas
- Search and filter bookmarks with fuzzy matching
- Preserve card positions after searching and clearing results
- Hide / unhide bookmarks and categories
- Global theme settings with dark/solid black defaults
- Adjustable card opacity globally and per card
- Import from HTML, JSON, and CSV
- Export the bookmark database to JSON
- Automatic backup snapshots
- Local asset uploads for custom images/icons
- Resume the previous directory session using IndexedDB

## Quick Start

1. Open `bookmark-manager/index.html` in a supported browser.
2. Choose a directory to use as the app data folder.
3. The app creates and loads these files inside the folder:
   - `master_bookmarks.json` — main bookmark data, edited through the command palette
   - `local_settings.json` — UI layout and hidden item settings
   - `backups/` — timestamped snapshots of your bookmark data
   - `assets/` — uploaded image/icon assets
4. Start by creating a category, then add bookmarks.

## Browser Requirements

This app requires a browser with the File System Access API, such as:
- Google Chrome
- Microsoft Edge

It is not guaranteed to work in browsers that do not implement this API.

## Features

### Bookmark & Category Management
- Create and edit categories with custom icons and colors
- Add bookmarks to categories with title, URL, description, and tags
- Change bookmark icons using:
  - built-in Lucide icons
  - favicon fetch from website hosts
  - custom image URL
  - uploaded local image
- Move bookmarks between categories from the editor

### Freeform Canvas Layout
- Cards are placed in a scrollable canvas layout
- Drag bookmark cards to reposition them freely
- Reset layout from the command palette to restore the default arrangement
- Positions are saved in `local_settings.json`

### Search & Filtering
- Search titles, URLs, descriptions, and tags with fuzzy match
- Filter categories with clickable pills
- Preserve your current card layout when search is cleared
- Use keyboard shortcut `Ctrl+K` / `Cmd+K` to open the command palette
- Toggle hidden items on or off

### Appearance & Theme
- Dark theme defaults to a solid black background
- Choose between solid color, gradient, or image backgrounds
- Adjust global card opacity for the dashboard
- Override opacity for individual cards when editing a bookmark
- Customize accent colors, font scale, and category badge visibility

### Hidden Items & Visibility
- Hide individual bookmarks or categories without deleting data
- Reveal hidden items at any time
- Hidden visibility is stored separately from the main bookmark data

### Import / Export
- Import bookmarks from:
  - Netscape-style bookmark HTML exports
  - JSON files containing categories/bookmarks or arrays of items
  - CSV files with headers like `url`, `title`, `category`, `tags`, `description`
- Export the current bookmark database as JSON

### Local Asset Uploads
- Upload custom image files for bookmark icons or backgrounds
- Uploaded assets are stored inside the app directory's `assets/` folder
- Local images are rendered using browser object URLs

### Backups & External Change Detection
- Creates timestamped backups in `backups/`
- Keeps up to 20 backup files by default
- Detects external edits to `master_bookmarks.json` and reloads automatically

### Private & Local-Only
- No online sync or cloud storage
- No login or account required
- All bookmark data remains in the directory you choose

### Master File Editing
- The shared `master_bookmarks.json` file can be updated from within the app using the master editor.
- The editor is intentionally not exposed as a dashboard button to avoid accidental master data changes.
- Open the command palette with `Ctrl+K` / `Cmd+K` and select **Edit Master Bookmarks**.
- The master editor supports both a visual category/bookmark editor and a raw JSON editor.
- Enter a detailed commit message and save changes to keep a local commit history.

## File Structure

```
SE-Dashboard/
  README.md
  bookmark-manager/
    index.html
    app.js
    config.js
    styles.css
    vendors.js
  DOCS/
    bookmark_manager_plan.md
```

### Data files created by the app

- `master_bookmarks.json`
  - Stores categories, bookmarks, click counts, custom styles, and icon settings
- `local_settings.json`
  - Stores layout positions, hidden bookmarks/categories, and theme options
- `backups/`
  - Contains automatic timestamped JSON backups
- `assets/`
  - Contains uploaded images used as bookmark icons/backgrounds

## Usage Notes

- When you reopen the app, it can resume the last directory if browser permissions are still granted.
- If the browser cannot restore the saved directory handle, reconnect by selecting the same folder again.
- Bookmark cards support any URL scheme, including `https://`, `file:///`, and custom app protocols like `vscode://`.
- The app saves changes automatically whenever bookmarks or layout settings are modified.

## Development & Customization

If you want to modify the app:
- `bookmark-manager/index.html` is the entry point
- `bookmark-manager/app.js` contains the application logic
- `bookmark-manager/config.js` defines default data, colors, and backup settings
- `bookmark-manager/styles.css` contains the UI styles

## Recommended Workflow

1. Open `bookmark-manager/index.html` in Chrome or Edge
2. Click **Connect Directory** and choose a folder
3. Create categories and add bookmarks
4. Use **Import** to migrate bookmarks from another system
5. Use **Export** to save the current database
6. To update the shared `master_bookmarks.json` safely, open the command palette with `Ctrl+K` / `Cmd+K` and select "Edit Master Bookmarks"
7. Drag cards to arrange your dashboard visually

## Troubleshooting

- If the app shows an error about directory access, make sure the browser supports File System Access API.
- If drag or pointer behavior feels inconsistent, use a modern Chromium-based browser.
- If imported bookmarks do not appear, verify the file format and headers in CSV/JSON.

## License

The project is intended as a personal local bookmark dashboard. There is no license file included in this repository.

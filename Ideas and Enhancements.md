# Ideas and Enhancements

### B. Drag & Drop Directory Scanning
Enable dropping a folder from the local computer filesystem directly onto the webpage. The app scans the directory contents recursively and automatically adds all files (PDFs, images, documents) as `file://` bookmark cards.

### C. Expandable Markdown Notes (Knowledge Card)
Turn bookmark cards into mini-wikis. Clicking a card can open a slide-over panel displaying a rich text editor supporting Markdown, checklist items, and internal wiki-style links.

### D. Single-File Build Bundler (Self-Contained)
Write a build script (e.g., using `vite-plugin-singlefile`) that bundles all CSS, JS, SVGs, and libraries directly into one single `.html` file. This lets the user carry around a single self-contained application file.

### E. Quick-Add Bookmarklet
Provide a simple javascript-based "Add Bookmark" bookmarklet that users can drag to their browser's bookmark bar. Clicking it on any web page automatically copies a correctly structured JSON snippet to their clipboard or pre-populates a "Quick Add" box when they open the dashboard.

## Potential Enhancements & Future Features

Consider adding these advanced features to further elevate the user experience and customizability:

### A. Vercel/Linear Style Command Palette (`Ctrl + K` or `Cmd + K`)
Allow power users to navigate the app, switch themes, search bookmarks, filter tags, and execute quick actions purely from the keyboard.
* *Example prompt:* `Implement a keyboard-accessible search palette that overlays the dashboard when Cmd/Ctrl + K is pressed, allowing instant navigation, tag toggling, and page configuration.`

### B. Drag & Drop Directory Scanning
Enable dropping a folder from the local computer filesystem directly onto the webpage. The app scans the directory contents recursively and automatically adds all files (PDFs, images, documents) as `file://` bookmark cards.

### C. Expandable Markdown Notes (Knowledge Card)
Turn bookmark cards into mini-wikis. Clicking a card can open a slide-over panel displaying a rich text editor supporting Markdown, checklist items, and internal wiki-style links.

### D. Single-File Build Bundler (Self-Contained)
Write a build script (e.g., using `vite-plugin-singlefile`) that bundles all CSS, JS, SVGs, and libraries directly into one single `.html` file. This lets the user carry around a single self-contained application file.

### E. Quick-Add Bookmarklet
Provide a simple javascript-based "Add Bookmark" bookmarklet that users can drag to their browser's bookmark bar. Clicking it on any web page automatically copies a correctly structured JSON snippet to their clipboard or pre-populates a "Quick Add" box when they open the dashboard.

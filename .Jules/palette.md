## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.
## 2026-10-19 - Command Palette Empty State
**Learning:** When users search in the command palette and receive zero results, displaying unstyled text without clear actions or iconography can break the visual immersion of the app and feel unpolished.
**Action:** Always utilize the `.empty-state` container pattern along with a relevant icon (e.g. `SearchX`) and muted text to maintain a consistent and pleasant user experience for empty states across the application.

## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2026-07-28 - Dynamic Empty States and Screen Readers
**Learning:** In a single-page app where empty state messages (like "No results found") are injected dynamically via JavaScript `innerHTML` instead of a page reload, screen readers will not announce them by default. This leaves visually impaired users unaware that an action (like searching or filtering) resulted in an empty state.
**Action:** Always add the `aria-live="polite"` attribute to dynamic empty state containers (e.g., `.empty-state`, `.palette-empty`) so screen readers automatically announce their contents when they appear on the screen.

## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2026-08-01 - Empty States & Screen Reader Announcements
**Learning:** Empty states (like no search results or an empty category) are visually clear but can be completely invisible to screen reader users if they appear dynamically without an announcement, leading to confusion about why the screen seems blank.
**Action:** Always add `aria-live="polite"` to dynamic empty state containers and ensure there is an empty state for every possible "no items" scenario (e.g., categories exist but no bookmarks) to prevent "dead ends".

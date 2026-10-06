## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2026-10-06 - Palette Empty State Enhancements
**Learning:** Adding interactive, clickable call-to-actions within empty states improves the user journey, but care must be taken to retain keyboard focus gracefully when such UI changes result in DOM updates or element removals.
**Action:** When introducing actionable empty state buttons (like "Clear Search"), ensure focus is programmatically shifted back to a logical interactive element (e.g., the search input field) to preserve accessibility for keyboard users after the action executes.

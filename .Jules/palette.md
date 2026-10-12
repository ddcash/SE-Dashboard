## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.
## 2024-05-24 - Modal Form Label Associations
**Learning:** Even internal tooling interfaces or advanced settings modals like the Master Editor or Settings need proper explicit label associations via `id` and `for` attributes. Relying on visual proximity or implicit associations creates major barriers for users relying on screen readers or needing larger clickable target areas.
**Action:** Always verify that every `<label>` element has a corresponding `for` attribute that strictly matches the `id` of its target input, particularly when generating forms dynamically via template literals.

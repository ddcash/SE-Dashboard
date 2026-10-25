## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.
## 2024-05-24 - Context for Dynamic Dismissible Elements
**Learning:** Screen readers need context when dismissing items in a dynamic list. A simple "×" button inside a tag bubble is read as "times button" and doesn't explain what it removes unless an aria-label explicitly associates the action with the item's name. Similarly, icon-only buttons like "New Category" need aria-labels.
**Action:** Always add an `aria-label` like "Remove tag [tag name]" to dynamic dismiss buttons, and explicitly associate labels with their inputs using the `for` attribute. Add `aria-label` to all icon-only buttons.

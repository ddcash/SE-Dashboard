## $(date +%Y-%m-%d) - Fixed Accessibility Issues
**Learning:** Found widespread accessibility issues where labels were unassociated with inputs, icon-only buttons lacked aria-labels, and buttons lacked the `type="button"` attribute, potentially causing form submission bugs.
**Action:** Always ensure that every `<label>` has a `for` attribute tying it to its corresponding input's `id`, add `aria-label` or `title` to all icon-only interactive elements, and declare `type="button"` on non-submit buttons within forms or standalone to ensure predictable behavior.

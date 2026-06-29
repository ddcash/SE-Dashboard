## 2024-05-24 - [O(n) Array Scans in Render Loops]
**Learning:** During rendering and filtering, the app iterated over every category and bookmark, calling `isHidden(type, id)` which used `Array.includes()`. This caused $O(N \times M)$ overhead (where N is items, M is hidden items).
**Action:** When a check is performed inside a tight loop over many items, precompute a `Set` from the array before the loop begins to change the check complexity from $O(M)$ to $O(1)$.

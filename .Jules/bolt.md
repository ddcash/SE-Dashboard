
## 2025-07-08 - Direct HTML concatenation instead of array allocation
**Learning:** In a vanilla JS app rebuilding the DOM frequently (e.g., keystroke search rendering), allocating an intermediate array and calling `.map().join('')` just to concatenate HTML strings introduces significant overhead (memory allocation, array iterations) compared to directly aggregating a string. This can slow down UI updates dramatically for large lists.
**Action:** When generating aggregate HTML strings in tight render loops, use direct string concatenation (`html += ...`) instead of populating an intermediate array and calling `.map().join('')` to avoid unnecessary GC pauses and CPU thrashing.

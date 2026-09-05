**Remove all captions from the gallery section**

**1. `index-gallery.js`** — remove the caption logic:
- Drop `caption` from the `galleryItems` mapping (no more reading `.gallery-caption` from cards).
- In `openGalleryLightbox`, remove the caption lookups/sets (`galleryLightboxCaption` element, `caption.textContent = ...`). Important: the function currently early-returns if the caption element is missing, so the element removal and JS change go together.
- Update the guard to only require `lightbox`, `image`, and `item`.

**2. `index.html`** — delete the lightbox caption line:
- `<div class="gallery-lightbox-caption" id="galleryLightboxCaption"></div>` (index.html:3207).

**3. `index.css`** — no change strictly needed since no card contains a caption element and the lightbox caption div will be gone. Leaving the unused `.gallery-caption` / `.gallery-lightbox-caption` rules is harmless, but I can remove them too if you want a fully clean sweep — default is to leave them (zero visual risk either way).

Result: gallery cards show only photos, and clicking a photo opens it fullscreen with no text underneath — navigation arrows and close button keep working. No verification pass unless you ask for one.
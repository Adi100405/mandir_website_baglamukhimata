const galleryItems = Array.from(document.querySelectorAll('.gallery-masonry .gallery-card')).map(function (card) {
  const image = card.querySelector('img');
  const caption = card.querySelector('.gallery-caption');

  return {
    src: image ? image.getAttribute('src') || '' : '',
    alt: image ? image.getAttribute('alt') || 'Temple gallery image' : 'Temple gallery image',
    caption: caption ? caption.textContent.trim() : ''
  };
}).filter(function (item) {
  return !!item.src;
});

let currentGalleryIndex = 0;

function openGalleryLightbox(index) {
  if (!galleryItems.length) return;

  currentGalleryIndex = index;
  const lightbox = document.getElementById('galleryLightbox');
  const image = document.getElementById('galleryLightboxImage');
  const caption = document.getElementById('galleryLightboxCaption');
  const item = galleryItems[currentGalleryIndex];

  if (!lightbox || !image || !caption || !item) return;

  image.src = item.src;
  image.alt = item.alt;
  caption.textContent = item.caption || item.alt || '';
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeGalleryLightbox() {
  const lightbox = document.getElementById('galleryLightbox');
  if (!lightbox) return;
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

function changeGalleryImage(step) {
  if (!galleryItems.length) return;
  currentGalleryIndex = (currentGalleryIndex + step + galleryItems.length) % galleryItems.length;
  openGalleryLightbox(currentGalleryIndex);
}

function handleGalleryLightboxBackdrop(event) {
  if (event.target.id === 'galleryLightbox') {
    closeGalleryLightbox();
  }
}

document.addEventListener('keydown', function (event) {
  const lightbox = document.getElementById('galleryLightbox');
  if (!lightbox || !lightbox.classList.contains('active')) return;
  if (event.key === 'Escape') closeGalleryLightbox();
  if (event.key === 'ArrowRight') changeGalleryImage(1);
  if (event.key === 'ArrowLeft') changeGalleryImage(-1);
});

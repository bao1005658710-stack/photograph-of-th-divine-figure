const grid = document.querySelector('#photoGrid');
const photoCount = document.querySelector('#photoCount');
const reservedPhotos = new Set([
  'photos/微信图片_20261114145832_64_2.jpg',
  'photos/微信图片_20261114145837_69_2.jpg',
  'photos/微信图片_20261114145753_60_2.jpg',
  'photos/微信图片_20261114145754_61_2.jpg'
]);

const photoSizes = {
  'photos/微信图片_20261114145746_54_2.jpg': [1280, 1707],
  'photos/微信图片_20261114145747_55_2.jpg': [1080, 1440],
  'photos/微信图片_20261114145747_56_2.jpg': [1080, 1202],
  'photos/微信图片_20261114145748_57_2.jpg': [810, 1080],
  'photos/微信图片_20261114145752_59_2.jpg': [828, 1792],
  'photos/微信图片_20261114145754_62_2.jpg': [1280, 720],
  'photos/微信图片_20261114145836_68_2.jpg': [1260, 840],
  'photos/微信图片_20261114145835_67_2.jpg': [1080, 1440],
  'photos/微信图片_20261114145834_66_2.jpg': [958, 2082],
  'photos/微信图片_20261114145757_63_2.jpg': [1706, 1279],
  'photos/微信图片_20261114145833_65_2.jpg': [375, 899]
};

function makePhoto(photo) {
  const image = document.createElement('img');
  image.className = 'gallery-photo';
  image.src = photo.src;
  image.alt = photo.alt || '个人生活照片';
  image.setAttribute('loading', 'lazy');
  image.setAttribute('decoding', 'async');
  const [width, height] = photoSizes[photo.src] || [1200, 1200];
  image.width = width;
  image.height = height;
  image.dataset.source = 'client';
  image.dataset.subject = 'portrait';

  return image;
}

function loadPhotos() {
  const photos = Array.isArray(window.SHARED_PHOTOS) ? window.SHARED_PHOTOS : [];
  const galleryPhotos = photos.filter((photo) => !reservedPhotos.has(photo.src));
  const fragment = document.createDocumentFragment();
  galleryPhotos.forEach((photo) => fragment.append(makePhoto(photo)));
  grid.replaceChildren(fragment);
  photoCount.textContent = `${photos.length} 张照片`;
}

function mountCursorGlow() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  document.querySelectorAll('[data-cursor-glow]').forEach((panel) => {
    let frame = 0;
    panel.addEventListener('pointermove', (event) => {
      const bounds = panel.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        panel.style.setProperty('--glow-x', `${x}px`);
        panel.style.setProperty('--glow-y', `${y}px`);
      });
    }, { passive: true });
    panel.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      panel.style.setProperty('--glow-x', '50%');
      panel.style.setProperty('--glow-y', '50%');
    });
  });
}

loadPhotos();
mountCursorGlow();

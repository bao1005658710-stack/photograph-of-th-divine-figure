const grid = document.querySelector('#photoGrid');
const emptyState = document.querySelector('#emptyState');
const photoCount = document.querySelector('#photoCount');
const dialog = document.querySelector('#photoDialog');
const dialogImage = document.querySelector('#dialogImage');
const dialogDate = document.querySelector('#dialogDate');

function todayText() {
  const now = new Date();
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${weekday}`;
}
document.querySelector('#today').textContent = todayText();

function prettyDate(value) {
  if (!value) return 'HERO FILE';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date) ? 'HERO FILE' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function addCard(photo, index) {
  const figure = document.createElement('figure');
  figure.className = `photo-card panel-${Number.isInteger(photo.panel) ? photo.panel % 9 : index % 9}`;
  figure.dataset.date = prettyDate(photo.date);
  const image = document.createElement('img');
  image.src = photo.src;
  image.alt = photo.alt || `个人照片，${prettyDate(photo.date)}`;
  image.loading = 'lazy';
  const visual = document.createElement('div');
  visual.className = 'photo-visual';
  visual.append(image);
  const frameNumber = document.createElement('span');
  frameNumber.className = 'frame-number';
  frameNumber.textContent = `#${String(index + 1).padStart(2, '0')}`;
  const caption = document.createElement('figcaption');
  caption.textContent = photo.caption || '这一格，帅得有点不讲道理。';
  figure.append(visual, frameNumber, caption);
  figure.addEventListener('click', () => openPhoto(photo));
  grid.append(figure);
}

function openPhoto(photo) {
  dialogImage.src = photo.src;
  dialogImage.alt = photo.alt || '放大的个人照片';
  dialogDate.textContent = prettyDate(photo.date);
  dialog.showModal();
}

function loadPhotos() {
  const photos = Array.isArray(window.SHARED_PHOTOS) ? window.SHARED_PHOTOS : [];
  grid.replaceChildren();
  photos.forEach(addCard);
  emptyState.hidden = photos.length > 0;
  photoCount.textContent = `${photos.length} 张战照`;
}

document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
loadPhotos();

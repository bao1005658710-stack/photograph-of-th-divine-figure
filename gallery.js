"use strict";

const grid = document.querySelector("#photo-grid");
const filters = document.querySelector("#filters");
const albumGrid = document.querySelector("#album-grid");
const total = document.querySelector("#total");
const loadPoint = document.querySelector("#load-point");
const loadMore = document.querySelector("#load-more");
const endNote = document.querySelector("#end-note");
const viewer = document.querySelector("#viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerTitle = document.querySelector("#viewer-title");
const viewerAlbum = document.querySelector("#viewer-album");
const viewerIndex = document.querySelector("#viewer-index");
const closeViewer = document.querySelector("#close-viewer");
const previous = document.querySelector("#prev-photo");
const next = document.querySelector("#next-photo");
const motionSwitch = document.querySelector(".motion-switch");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const photoCatalog = [];
const batchSize = 9;
let selectedAlbum = "";
let entries = [];
let rendered = 0;
let active = 0;
let opener;
let motionPaused = false;
const gallery = document.querySelector("#gallery");
const emptyLibrary = document.querySelector("#empty-library");
const libraryMessage = document.querySelector("#library-message");
const noAlbum = document.querySelector("#no-album");
const upload = document.querySelector("#upload");
const uploadForm = document.querySelector("#upload-form");
const closeUpload = document.querySelector("#close-upload");
const fileInput = document.querySelector("#photo-files");
const albumInput = document.querySelector("#album-input");
const albumOptions = document.querySelector("#album-options");
const selection = document.querySelector("#selection");
const uploadStatus = document.querySelector("#upload-status");
const deleteButton = document.querySelector("#delete-photo");
let pending = [];
let saving = false;
let deleting = false;

const urls = new WeakMap();
let browserLibrary;

function openLibrary() {
  if (browserLibrary) return browserLibrary;
  browserLibrary = new Promise((resolve, reject) => {
    const request = indexedDB.open("nocturne-pages-portrait-library", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("portraits", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return browserLibrary;
}

async function libraryTransaction(mode, run) {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("portraits", mode);
    const request = run(transaction.objectStore("portraits"));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

function photoURL(photo, kind) {
  if (photo.src) return photo.src;
  if (!urls.has(photo)) urls.set(photo, {});
  const variants = urls.get(photo);
  if (!variants[kind]) variants[kind] = URL.createObjectURL(photo[kind]);
  return variants[kind];
}

async function updateLibrary() {
  const local = await libraryTransaction("readonly", store => store.getAll());
  local.sort((a, b) => b.savedAt - a.savedAt || b.order - a.order);
  photoCatalog.splice(0, photoCatalog.length, ...local, ...window.publicPortraits);
}

async function preparePhoto(file, album) {
  const src = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = src;
    await image.decode();
    const scale = Math.min(1, 850 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const thumb = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .86));
    return {
      title: file.name.replace(/\.[^.]+$/, "") || "未命名人像",
      album,
      original: file,
      thumb: thumb || file,
      shape: Math.min(1.7, Math.max(.68, image.naturalWidth / image.naturalHeight))
    };
  } finally {
    URL.revokeObjectURL(src);
  }
}

function showSelection() {
  selection.textContent = pending.length
    ? "已选择 " + pending.length + " 张照片。"
    : "可选择多张图片。导入的照片只保存在当前浏览器。";
}

function openUpload(files = []) {
  if (upload.open) return;
  uploadForm.reset();
  pending = Array.from(files);
  albumInput.value = selectedAlbum || "人像";
  uploadStatus.textContent = "";
  showSelection();
  upload.showModal();
  (pending.length ? albumInput : fileInput).focus();
}

for (const button of document.querySelectorAll(".upload-trigger")) {
  button.addEventListener("click", () => openUpload());
}
closeUpload.addEventListener("click", () => upload.close());
upload.addEventListener("cancel", event => {
  if (saving) event.preventDefault();
});
fileInput.addEventListener("change", () => {
  pending = Array.from(fileInput.files);
  showSelection();
});
gallery.addEventListener("dragover", event => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  gallery.classList.add("dragging");
});
gallery.addEventListener("dragleave", event => {
  if (!gallery.contains(event.relatedTarget)) gallery.classList.remove("dragging");
});
gallery.addEventListener("drop", event => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  gallery.classList.remove("dragging");
  openUpload(event.dataTransfer.files);
});

uploadForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (saving) return;
  if (!pending.length) {
    uploadStatus.textContent = "请先选择至少一张照片。";
    fileInput.focus();
    return;
  }
  const album = albumInput.value.trim();
  if (!album) {
    uploadStatus.textContent = "请输入相册名称。";
    albumInput.focus();
    return;
  }
  let skipped = 0;
  saving = true;
  for (const control of uploadForm.elements) control.disabled = true;
  try {
    const prepared = [];
    const files = pending;
    for (const [index, file] of files.entries()) {
      uploadStatus.textContent = "正在读取 " + (index + 1) + " / " + files.length + "…";
      try {
        prepared.push(await preparePhoto(file, album));
      } catch {
        skipped++;
      }
    }
    if (!prepared.length) {
      uploadStatus.textContent = "这些文件无法作为图片读取。请换用 JPG、PNG 或 WebP。";
      return;
    }
    uploadStatus.textContent = "正在保存到当前浏览器…";
    const savedAt = Date.now();
    const added = prepared.map((photo, order) => ({
      ...photo, id: crypto.randomUUID(), savedAt, order
    })).reverse();
    await libraryTransaction("readwrite", store => {
      for (const photo of added) store.add(photo);
    });
    photoCatalog.unshift(...added);
    refreshLibrary(album);
    libraryMessage.textContent = "已保存 " + prepared.length + " 张照片。" + (skipped ? " 有 " + skipped + " 个文件无法读取。" : "");
    upload.close();
    gallery.scrollIntoView();
  } catch (error) {
    uploadStatus.textContent = error?.name === "QuotaExceededError"
      ? "当前浏览器的存储空间不足，请减少导入的照片。"
      : "照片未能保存，请检查浏览器的存储设置。";
  } finally {
    saving = false;
    for (const control of uploadForm.elements) control.disabled = false;
  }
});

function refreshLibrary(defaultAlbum) {
  const groups = new Map();
  for (const photo of photoCatalog) {
    if (!groups.has(photo.album)) groups.set(photo.album, []);
    groups.get(photo.album).push(photo);
  }
  filters.replaceChildren();
  albumGrid.replaceChildren();
  albumOptions.replaceChildren();
  emptyLibrary.hidden = photoCatalog.length > 0;
  noAlbum.hidden = groups.size > 0;
  for (const name of ["", ...groups.keys()]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.album = name;
    button.textContent = name || "全部照片";
    button.addEventListener("click", () => selectAlbum(name));
    filters.append(button);
  }
  for (const [name, photos] of groups) {
    albumOptions.append(new Option(name, name));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "album-card";
    const image = new Image();
    image.src = photoURL(photos[0], "thumb");
    image.alt = "";
    image.loading = "lazy";
    const info = document.createElement("span");
    info.className = "album-info";
    const title = document.createElement("span");
    title.className = "album-name";
    title.textContent = name;
    const count = document.createElement("span");
    count.className = "album-count";
    count.textContent = photos.length + " 张";
    info.append(title, count);
    button.append(image, info);
    button.addEventListener("click", () => {
      selectAlbum(name);
      gallery.scrollIntoView();
      Array.from(filters.children).find(filter => filter.dataset.album === name).focus({ preventScroll: true });
    });
    albumGrid.append(button);
  }
  selectAlbum(groups.has(defaultAlbum) ? defaultAlbum : "");
}

deleteButton.addEventListener("click", async () => {
  const photo = entries[active];
  if (deleting || !photo || photo.src || !window.confirm("从本地相册中移除《" + photo.title + "》？")) return;
  document.querySelector('#viewer-error').textContent = '';
  deleting = true;
  deleteButton.disabled = true;
  try {
    await libraryTransaction("readwrite", store => store.delete(photo.id));
    Object.values(urls.get(photo) || {}).forEach(url => URL.revokeObjectURL(url));
    const index = photoCatalog.indexOf(photo);
    if (index !== -1) photoCatalog.splice(index, 1);
    viewer.close();
    refreshLibrary(selectedAlbum);
    libraryMessage.textContent = "照片已从本地相册移除。";
    gallery.querySelector(".compact").focus({ preventScroll: true });
  } catch (error) {
    document.querySelector("#viewer-error").textContent = error.message;
  } finally {
    deleting = false;
    deleteButton.disabled = false;
  }
});
function spanCards() {
  const style = getComputedStyle(grid);
  const columns = Number(style.getPropertyValue("--columns"));
  const gap = parseFloat(style.columnGap);
  const width = (grid.clientWidth - gap * (columns - 1)) / columns;
  for (const card of grid.children) {
    const height = width / Number(card.dataset.shape);
    card.style.gridRowEnd = "span " + Math.max(1, Math.ceil((height + gap) / 4));
    card.style.marginBottom = gap + "px";
  }
}

function makePhoto(photo, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "photo";
  card.dataset.shape = photo.shape || 1.3;
  card.setAttribute("aria-label", "查看照片：" + photo.title);

  const image = new Image();
  image.alt = photo.title;
  image.loading = index < batchSize ? "eager" : "lazy";
  image.decoding = "async";
  image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
  image.addEventListener("error", () => card.classList.add("failed"), { once: true });
  image.src = photoURL(photo, "thumb");

  const caption = document.createElement("span");
  caption.className = "photo-caption";
  caption.textContent = photo.title;
  caption.setAttribute("aria-hidden", "true");

  card.append(image, caption);
  card.addEventListener("click", () => {
    opener = card;
    displayPhoto(index);
    viewer.showModal();
    closeViewer.focus();
  });
  return card;
}

function appendBatch(manual = false) {
  const start = rendered;
  const limit = Math.min(start + batchSize, entries.length);
  const batch = document.createDocumentFragment();
  for (let index = start; index < limit; index++) {
    batch.append(makePhoto(entries[index], index));
  }
  grid.append(batch);
  rendered = limit;
  spanCards();
  loadMore.hidden = rendered >= entries.length;
  endNote.hidden = !loadMore.hidden || entries.length === 0;
  loader.unobserve(loadPoint);
  if (!loadMore.hidden) loader.observe(loadPoint);
  if (manual && limit > start) grid.children[start].focus({ preventScroll: true });
}

const loader = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting && rendered < entries.length) appendBatch();
}, { rootMargin: "180px" });

function selectAlbum(id) {
  loader.unobserve(loadPoint);
  selectedAlbum = id;
  entries = photoCatalog.filter(photo => !id || photo.album === id);
  rendered = 0;
  for (const button of filters.children) {
    button.setAttribute("aria-pressed", String(button.dataset.album === selectedAlbum));
  }
  filters.hidden = photoCatalog.length === 0;
  total.textContent = entries.length + " 张照片";
  grid.replaceChildren();
  appendBatch();
  if (!entries.length) endNote.textContent = "此相册暂无照片";
  else endNote.textContent = "已浏览完此相册";
}

function displayPhoto(index) {
  if (index < 0 || index >= entries.length) return;
  document.querySelector('#viewer-error').textContent = '';
  active = index;
  const photo = entries[index];
  viewerImage.classList.remove("swapping");
  viewerImage.alt = photo.title;
  viewerImage.src = photoURL(photo, "original");
  void viewerImage.offsetWidth;
  viewerImage.classList.add("swapping");
  viewerTitle.textContent = photo.title;
  viewerAlbum.textContent = photo.album;
  deleteButton.hidden = Boolean(photo.src);
  viewerIndex.textContent = String(index + 1).padStart(2, "0") + " / " + String(entries.length).padStart(2, "0");
  previous.disabled = index === 0;
  next.disabled = index === entries.length - 1;
  if (previous.disabled && document.activeElement === previous) next.focus();
  if (next.disabled && document.activeElement === next) previous.focus();
}
closeViewer.addEventListener("click", () => viewer.close());
previous.addEventListener("click", () => displayPhoto(active - 1));
next.addEventListener("click", () => displayPhoto(active + 1));
viewer.addEventListener("close", () => opener?.focus({ preventScroll: true }));
viewer.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    displayPhoto(active + (event.key === "ArrowLeft" ? -1 : 1));
  }
});
loadMore.addEventListener("click", () => appendBatch(true));
updateLibrary().then(() => {
  refreshLibrary("");
  libraryMessage.textContent = "你导入的照片只保存在当前浏览器。";
}).catch(() => {
  photoCatalog.push(...window.publicPortraits);
  refreshLibrary("");
  libraryMessage.textContent = "此浏览器暂时无法保存你导入的照片。";
});
new ResizeObserver(spanCards).observe(grid);
new IntersectionObserver(([entry], observer) => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add("in-view");
  observer.disconnect();
}, { threshold: .2 }).observe(document.querySelector(".manifesto"));
const hero = document.querySelector(".hero");
const cover = document.querySelector(".cover");
const canvas = document.querySelector("#dust");
const context = canvas.getContext("2d");
const particles = Array.from({ length: 38 }, () => ({
  x: Math.random(),
  y: Math.random(),
  alpha: .09 + Math.random() * .20,
  radius: .45 + Math.random() * .7,
  speed: .6 + Math.random() * 1.5
}));
let canvasWidth = 0;
let canvasHeight = 0;
let visible = true;
let frame = 0;

function resizeCanvas() {
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = canvas.clientWidth;
  canvasHeight = canvas.clientHeight;
  canvas.width = Math.round(canvasWidth * density);
  canvas.height = Math.round(canvasHeight * density);
  context?.setTransform(density, 0, 0, density, 0, 0);
}

function animate(time) {
  const distance = Math.max(0, window.scrollY);
  const drift = Math.min(103, distance * .19);
  cover.style.setProperty("--hero-scale", String(1.065 + Math.min(.23, distance / 2300)));
  cover.style.setProperty("--drift", drift + "px");
  if (context) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    for (const particle of particles) {
      const x = particle.x * canvasWidth + Math.sin(time / 4300 + particle.y * 6) * 9;
      const y = (((particle.y - time * .000006 * particle.speed) % 1 + 1) % 1) * canvasHeight;
      context.fillStyle = "rgba(223,226,232," + particle.alpha + ")";
      context.beginPath();
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  frame = requestAnimationFrame(animate);
}

function updateMotion() {
  cancelAnimationFrame(frame);
  const paused = motionPaused || reduceMotion.matches;
  motionSwitch.setAttribute("aria-pressed", String(paused));
  document.body.classList.toggle("motion-paused", paused);
  motionSwitch.disabled = reduceMotion.matches;
  motionSwitch.title = paused ? "播放背景动效" : "暂停背景动效";
  motionSwitch.querySelector("b").textContent = paused ? "静止" : "动态";
  if (!paused && visible && !document.hidden) frame = requestAnimationFrame(animate);
  if (paused) {
    cover.style.removeProperty("--drift");
    cover.style.removeProperty("--hero-scale");
    context?.clearRect(0, 0, canvasWidth, canvasHeight);
  }
}
motionSwitch.addEventListener("click", () => {
  motionPaused = !motionPaused;
  updateMotion();
});
reduceMotion.addEventListener("change", updateMotion);
document.addEventListener("visibilitychange", updateMotion);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  updateMotion();
}).observe(hero);
new ResizeObserver(resizeCanvas).observe(canvas);
resizeCanvas();
updateMotion();
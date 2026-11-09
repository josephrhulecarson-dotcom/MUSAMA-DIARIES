(() => {
  const DB_NAME = 'musama-daries-media';
  const STORE_NAME = 'photos';
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const MAX_PHOTOS_PER_UPLOAD = 30;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Photo storage is not available in this browser.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open photo storage.'));
    });
  }

  async function withStore(mode, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Photo storage request failed.'));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Could not save your photo.'));
      };
    });
  }

  function makeId() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp));
  }

  function setupGallery(root) {
    const picker = root.querySelector('[data-photo-input]');
    const selectButton = root.querySelector('[data-select-photos]');
    const uploadButton = root.querySelector('[data-upload-photos]');
    const captionInput = root.querySelector('[data-photo-caption]');
    const filter = root.querySelector('[data-photo-filter]');
    const grid = root.querySelector('[data-photo-grid]');
    const status = root.querySelector('[data-photo-status]');
    const dropZone = root.querySelector('[data-drop-zone]');
    let selectedFiles = [];
    let objectUrls = [];

    const setStatus = (message, type = '') => {
      status.textContent = message;
      status.className = `photo-status ${type}`.trim();
    };

    const clearUrls = () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls = [];
    };

    async function renderPhotos() {
      clearUrls();
      grid.replaceChildren();
      const category = filter.value;
      const records = (await withStore('readonly', (store) => store.getAll())) || [];
      records.sort((a, b) => b.createdAt - a.createdAt);
      const visibleRecords = records.filter((photo) => category === 'all' || photo.category === category);

      if (!visibleRecords.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-gallery';
        empty.innerHTML = '<strong>Your photo gallery starts here.</strong>Select photos above to add your first memory.';
        grid.append(empty);
        return;
      }

      visibleRecords.forEach((photo) => {
        const card = document.createElement('article');
        card.className = 'photo-card';
        const image = document.createElement('img');
        const url = URL.createObjectURL(photo.blob);
        objectUrls.push(url);
        image.src = url;
        image.alt = photo.caption || 'Musama Diaries gallery photo';
        image.loading = 'lazy';
        const meta = document.createElement('div');
        meta.className = 'photo-meta';
        const title = document.createElement('strong');
        title.textContent = photo.caption || photo.name || 'Untitled photo';
        const details = document.createElement('small');
        details.textContent = `${photo.categoryLabel} · ${formatDate(photo.createdAt)}`;
        const actions = document.createElement('div');
        actions.className = 'photo-actions';
        const download = document.createElement('button');
        download.type = 'button';
        download.textContent = 'Download';
        download.addEventListener('click', () => {
          const link = document.createElement('a');
          link.href = url;
          link.download = photo.name || 'musama-photo';
          link.click();
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove ${photo.caption || photo.name || 'photo'}`);
        remove.addEventListener('click', async () => {
          if (!window.confirm('Remove this photo from this browser’s gallery?')) return;
          await withStore('readwrite', (store) => store.delete(photo.id));
          setStatus('Photo removed from this browser.', 'success');
          await renderPhotos();
        });
        actions.append(download, remove);
        meta.append(title, details, actions);
        card.append(image, meta);
        grid.append(card);
      });
    }

    async function receiveFiles(files) {
      const allowed = Array.from(files).filter((file) => file.type.startsWith('image/'));
      const rejected = Array.from(files).length - allowed.length;
      selectedFiles = allowed.slice(0, MAX_PHOTOS_PER_UPLOAD);
      picker.value = '';
      if (!selectedFiles.length) {
        setStatus('Choose image files such as JPG, PNG, or WebP.', 'error');
      } else {
        const total = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        setStatus(`${selectedFiles.length} photo${selectedFiles.length === 1 ? '' : 's'} selected · ${Math.round(total / 1024 / 1024)} MB. Add a caption and save.`);
      }
      if (rejected) setStatus(`${rejected} non-image file${rejected === 1 ? '' : 's'} skipped. Choose image files only.`, 'error');
    }

    selectButton.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => receiveFiles(picker.files));
    filter.addEventListener('change', () => renderPhotos().catch((error) => setStatus(error.message, 'error')));
    uploadButton.addEventListener('click', async () => {
      if (!selectedFiles.length) {
        picker.click();
        return;
      }
      const tooLarge = selectedFiles.filter((file) => file.size > MAX_FILE_SIZE);
      if (tooLarge.length) {
        setStatus(`Each photo must be 15 MB or smaller. ${tooLarge.map((file) => file.name).join(', ')} is too large.`, 'error');
        return;
      }
      uploadButton.disabled = true;
      try {
        const category = filter.value === 'all' ? 'worship' : filter.value;
        const categoryLabel = { worship: 'Worship', events: 'Events', outreach: 'Outreach' }[category];
        const caption = captionInput.value.trim();
        for (const file of selectedFiles) {
          await withStore('readwrite', (store) => store.add({
            id: makeId(),
            name: file.name,
            caption: caption || file.name.replace(/\.[^.]+$/, ''),
            category,
            categoryLabel,
            createdAt: Date.now(),
            blob: file,
          }));
        }
        const savedCount = selectedFiles.length;
        selectedFiles = [];
        captionInput.value = '';
        setStatus(`${savedCount} photo${savedCount === 1 ? '' : 's'} saved in this browser’s gallery.`, 'success');
        await renderPhotos();
      } catch (error) {
        setStatus(error.name === 'QuotaExceededError' ? 'This browser is low on storage. Remove older photos or make room, then try again.' : `Could not save photos: ${error.message}`, 'error');
      } finally {
        uploadButton.disabled = false;
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragover');
    }));
    dropZone.addEventListener('drop', (event) => receiveFiles(event.dataTransfer.files));

    renderPhotos().catch((error) => setStatus(`${error.message} Open this website in a modern browser to enable photo storage.`, 'error'));
  }

  document.querySelectorAll('[data-gallery-root]').forEach(setupGallery);
})();

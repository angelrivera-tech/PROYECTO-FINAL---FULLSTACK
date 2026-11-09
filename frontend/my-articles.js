// my-articles.js - Muestra y permite editar los artículos publicados por el usuario en "My Saved News"

(function () {
    const API_URL = '/api/articles';
    const container = document.getElementById('my-articles-container');
    if (!container) return;

    const usuarioId = Number(localStorage.getItem('usuarioId')) || null;

    // Sin sesión: no mostrar la sección de artículos publicados
    if (!usuarioId) {
        const section = document.getElementById('my-published-section');
        if (section) section.remove();
        return;
    }
    const modal = document.getElementById('editModal');
    const overlay = document.getElementById('editOverlay');
    const editCategory = document.getElementById('editCategory');
    const editImage = document.getElementById('editImage');
    const editContent = document.getElementById('editContent');
    const editError = document.getElementById('editError');
    const saveBtn = document.getElementById('saveEditBtn');

    let myArticles = [];
    let editingId = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Ajusta rutas de imágenes relativas igual que en la portada
    function fixImagePath(src) {
        // Sin imagen (o la antigua imagen por defecto, ya eliminada): fondo gris neutro
        if (!src || src.endsWith('imagenes/imagen2.jpg')) return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='250'%3E%3Crect width='100%25' height='100%25' fill='%23e5e5e5'/%3E%3C/svg%3E";
        if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('../') || src.startsWith('/')) return src;
        return '../imagenes/' + src.split('/').pop();
    }

    function setStatus(message, color) {
        container.innerHTML = `<p class="my-articles-status" style="${color ? 'color:' + color : ''}">${escapeHtml(message)}</p>`;
    }

    async function loadMyArticles() {
        if (!usuarioId) {
            setStatus('Log in to see and edit the articles you have published.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}?usuario_id=${encodeURIComponent(usuarioId)}`);
            if (!response.ok) throw new Error('Error al conectar con el servidor');
            myArticles = await response.json();
            renderMyArticles();
        } catch (error) {
            console.error('Error al cargar tus artículos:', error);
            setStatus('Your articles could not be loaded.', '#d9534f');
        }
    }

    function renderMyArticles() {
        if (myArticles.length === 0) {
            setStatus('You have not published any articles yet.');
            return;
        }

        container.innerHTML = '';
        myArticles.forEach(article => {
            const temp = document.createElement('div');
            temp.innerHTML = article.content || '';
            const firstImg = temp.querySelector('img');
            const imgUrl = fixImagePath(firstImg && !(article.image_url && !article.image_url.endsWith('imagenes/imagen2.jpg')) ? firstImg.getAttribute('src') : article.image_url);
            // Quitar el título (h1) del extracto
            const heading = temp.querySelector('h1');
            if (heading) heading.remove();
            const text = (temp.textContent || '').trim();
            const excerpt = text.length > 140 ? text.substring(0, 140) + '...' : text;
            const fecha = article.fecha_publicacion ? new Date(article.fecha_publicacion).toLocaleDateString() : '';

            const card = document.createElement('div');
            card.className = 'saved-card article-item my-article-card';
            card.innerHTML = `
                <div>
                    <div class="card-category">${escapeHtml(article.category || 'General')}</div>
                    <img src="${escapeHtml(imgUrl)}" alt="">
                    <h3>${escapeHtml(article.title)}</h3>
                    <p class="my-article-excerpt">${escapeHtml(excerpt)}</p>
                </div>
                <div class="card-actions">
                    <span class="saved-date">Published: ${escapeHtml(fecha)}</span>
                    <div class="card-buttons">
                        <button type="button" class="cancel-btn" data-view="${article.id}">View</button>
                        <button type="button" class="remove-btn" data-delete="${article.id}">Delete 🗑️</button>
                        <button type="button" class="edit-btn" data-edit="${article.id}">Edit ✏️</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    container.addEventListener('click', event => {
        const viewId = event.target.closest('[data-view]')?.getAttribute('data-view');
        if (viewId) {
            window.location.href = `article.html?id=${encodeURIComponent(viewId)}`;
            return;
        }
        const deleteId = event.target.closest('[data-delete]')?.getAttribute('data-delete');
        if (deleteId) {
            deleteArticle(Number(deleteId), event.target.closest('[data-delete]'));
            return;
        }
        const editId = event.target.closest('[data-edit]')?.getAttribute('data-edit');
        if (editId) openEditModal(Number(editId));
    });

    async function deleteArticle(id, button) {
        const article = myArticles.find(a => a.id === id);
        if (!article) return;
        const ok = await wnConfirm(`Delete "${article.title}"? This cannot be undone.`, { title: 'Delete article', okText: 'Delete', danger: true });
        if (!ok) return;

        button.disabled = true;
        try {
            const response = await fetch(`${API_URL}/${id}?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'DELETE',
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'The article could not be deleted.', { title: 'Something went wrong', danger: true });
                button.disabled = false;
                return;
            }
            myArticles = myArticles.filter(a => a.id !== id);
            renderMyArticles();
            wnToast('Article deleted');
        } catch (error) {
            console.error('Error al eliminar:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
            button.disabled = false;
        }
    }

    // ---------- Editor (mismas opciones que el Article Editor) ----------
    const UPLOAD_URL = '/api/article-images';
    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    const $ = id => document.getElementById(id);
    const categoryCustom = $('editCategoryCustom');
    const coverFile = $('editCoverFile');
    const coverPreviewImg = $('editCoverPreviewImg');
    const coverStatus = $('editCoverStatus');
    const coverRemoveBtn = $('editCoverRemoveBtn');
    const saveHint = $('editSaveHint');
    const wordCount = $('editWordCount');
    const previewModal = $('editPreviewModal');

    let imageReady = false;
    let effectiveImage = null;
    let checkToken = 0;
    let savedRange = null;

    function resolveSrc(src) {
        const value = (src || '').trim();
        if (!value) return '';
        if (/^(https?:|data:|\.\.\/|\/)/i.test(value)) return value;
        return '../imagenes/' + value.split('/').pop();
    }

    function imageLoads(url) {
        return new Promise(resolve => {
            if (!url) return resolve(false);
            const img = new Image();
            const timer = setTimeout(() => resolve(false), 15000);
            img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
            img.onerror = () => { clearTimeout(timer); resolve(false); };
            img.src = url;
        });
    }

    function firstContentImage() {
        const img = editContent.querySelector('img[src]');
        return img ? img.getAttribute('src') : '';
    }

    function setSaveState() {
        saveBtn.disabled = !imageReady;
        saveBtn.title = imageReady ? '' : 'Add an image that loads to save';
        saveHint.hidden = imageReady;
    }

    function setCoverStatus(kind, message) {
        coverStatus.className = 'edit-cover-status ' + kind;
        coverStatus.textContent = message;
    }

    // Revalida la imagen (portada o, si no hay, la primera imagen del texto)
    async function validateImage() {
        const token = ++checkToken;
        const cover = resolveSrc(editImage.value);
        const candidate = cover || firstContentImage();

        coverRemoveBtn.hidden = !editImage.value.trim();

        if (!candidate) {
            imageReady = false;
            effectiveImage = null;
            coverPreviewImg.hidden = true;
            setCoverStatus('missing', 'No cover image yet — an image is required to save.');
            setSaveState();
            return;
        }

        imageReady = false;
        setSaveState();
        setCoverStatus('loading', 'Checking image…');
        const ok = await imageLoads(candidate);
        if (token !== checkToken) return;

        imageReady = ok;
        effectiveImage = ok ? candidate : null;
        coverPreviewImg.hidden = !ok;
        if (ok) {
            coverPreviewImg.src = candidate;
            setCoverStatus('ok', cover ? '✔ Cover image ready.' : '✔ Using the first image in the article as cover.');
        } else {
            setCoverStatus('missing', cover
                ? '✖ This image could not be loaded. Check the URL or upload a file.'
                : '✖ The image in the article could not be loaded. Add a cover image.');
        }
        setSaveState();
    }

    function getCategory() {
        if (editCategory.value === '__custom') return categoryCustom.value.trim() || 'General';
        return editCategory.value;
    }

    function setCategory(value) {
        const exists = Array.from(editCategory.options).some(o => o.value === value && o.value !== '__custom');
        editCategory.value = exists ? value : '__custom';
        categoryCustom.value = exists ? '' : (value || '');
        categoryCustom.hidden = editCategory.value !== '__custom';
    }

    function updateWordCount() {
        const words = (editContent.innerText || '').trim().split(/\s+/).filter(Boolean).length;
        const minutes = Math.max(1, Math.round(words / 200));
        wordCount.textContent = `${words} word${words === 1 ? '' : 's'} · ~${minutes} min read`;
    }

    async function uploadImage(file) {
        if (!file) return null;
        if (!file.type.startsWith('image/')) {
            await wnAlert('Please choose an image file.', { title: 'Invalid file', danger: true });
            return null;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            await wnAlert('The image is too large (5 MB maximum).', { title: 'Image too large', danger: true });
            return null;
        }
        try {
            const response = await fetch(`${UPLOAD_URL}?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'The image could not be uploaded.');
            return result.url;
        } catch (error) {
            await wnAlert(error.message || 'The image could not be uploaded.', { title: 'Upload failed', danger: true });
            return null;
        }
    }

    function openEditModal(id) {
        const article = myArticles.find(a => a.id === id);
        if (!article) return;
        editingId = id;
        setCategory(article.category || 'General');
        editImage.value = article.image_url || '';
        editContent.innerHTML = article.content || `<h1>${escapeHtml(article.title)}</h1>`;
        editError.textContent = '';
        savedRange = null;
        modal.classList.add('active');
        overlay.classList.add('active');
        updateWordCount();
        validateImage();
        editContent.focus();
    }

    window.closeEditModal = function () {
        editingId = null;
        previewModal.hidden = true;
        modal.classList.remove('active');
        overlay.classList.remove('active');
    };

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!previewModal.hidden) { previewModal.hidden = true; return; }
        if (modal.classList.contains('active') && !document.querySelector('.wn-dialog-backdrop')) window.closeEditModal();
    });

    // Recordar la última selección dentro del editor
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (sel.rangeCount && editContent.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
        // Mantener el selector de estilo sincronizado
        if (document.activeElement !== editContent) return;
        const block = (document.queryCommandValue('formatBlock') || '').toUpperCase();
        const select = $('editBlockFormat');
        if (Array.from(select.options).some(o => o.value === block)) select.value = block;
        else if (block === '' || block === 'DIV') select.value = 'P';
    });

    function restoreSelection() {
        editContent.focus();
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    }

    function runCommand(command, value = null) {
        restoreSelection();
        document.execCommand(command, false, value);
        editContent.dispatchEvent(new Event('input'));
    }

    // Botones de formato del editor
    document.querySelectorAll('.edit-toolbar .edit-tool-btn[data-command]').forEach(button => {
        button.addEventListener('mousedown', e => e.preventDefault());
        button.addEventListener('click', async () => {
            const command = button.getAttribute('data-command');
            if (command === 'createLink' || command === 'insertImage') {
                const range = savedRange;
                const value = command === 'createLink'
                    ? await wnPrompt('Enter the link URL:', { title: 'Insert link', placeholder: 'https://...', okText: 'Insert' })
                    : await wnPrompt('Enter the image URL or path:', { title: 'Insert photo', placeholder: '../imagenes/photo.jpg', okText: 'Insert' });
                if (value && value.trim()) {
                    savedRange = range;
                    runCommand(command, command === 'insertImage' ? resolveSrc(value) : value.trim());
                }
            } else {
                runCommand(command);
            }
        });
    });

    $('editBlockFormat').addEventListener('change', e => runCommand('formatBlock', e.target.value));
    $('editFontSize').addEventListener('change', e => {
        if (e.target.value) runCommand('fontSize', e.target.value);
        e.target.value = '';
    });
    $('editTextColor').addEventListener('input', e => runCommand('foreColor', e.target.value));
    $('editHighlightColor').addEventListener('input', e => {
        restoreSelection();
        if (!document.execCommand('hiliteColor', false, e.target.value)) {
            document.execCommand('backColor', false, e.target.value);
        }
        editContent.dispatchEvent(new Event('input'));
    });

    // Subir una imagen dentro del texto
    const inlineFile = $('editInlineFile');
    $('editInlineUploadBtn').addEventListener('mousedown', e => e.preventDefault());
    $('editInlineUploadBtn').addEventListener('click', () => inlineFile.click());
    inlineFile.addEventListener('change', async () => {
        const range = savedRange;
        const url = await uploadImage(inlineFile.files[0]);
        inlineFile.value = '';
        if (url) {
            savedRange = range;
            runCommand('insertImage', url);
        }
    });

    // --- Portada ---
    let coverTimer = null;
    editImage.addEventListener('input', () => {
        clearTimeout(coverTimer);
        coverTimer = setTimeout(validateImage, 400);
    });

    $('editCoverUploadBtn').addEventListener('click', () => coverFile.click());
    coverFile.addEventListener('change', async () => {
        const file = coverFile.files[0];
        coverFile.value = '';
        if (!file) return;
        setCoverStatus('loading', 'Uploading image…');
        const url = await uploadImage(file);
        if (url) editImage.value = url;
        validateImage();
    });

    $('editCoverFromContentBtn').addEventListener('click', async () => {
        const src = firstContentImage();
        if (!src) {
            await wnAlert('The article has no images yet. Add one with "Photo" or "Upload Photo".', { title: 'No images' });
            return;
        }
        editImage.value = src;
        validateImage();
    });


    coverRemoveBtn.addEventListener('click', () => {
        editImage.value = '';
        validateImage();
    });

    editCategory.addEventListener('change', () => {
        categoryCustom.hidden = editCategory.value !== '__custom';
        if (!categoryCustom.hidden) categoryCustom.focus();
    });

    // --- Cambios en el texto ---
    let contentTimer = null;
    editContent.addEventListener('input', () => {
        updateWordCount();
        clearTimeout(contentTimer);
        contentTimer = setTimeout(() => { if (!editImage.value.trim()) validateImage(); }, 500);
    });

    // --- Vista previa ---
    $('editPreviewBtn').addEventListener('click', () => {
        const cover = effectiveImage && imageReady && !editContent.querySelector(`img[src="${CSS.escape(effectiveImage)}"]`)
            ? `<img class="edit-preview-cover" src="${escapeHtml(effectiveImage)}" alt="Cover">`
            : '';
        $('editPreviewBody').innerHTML = `
            <span class="edit-preview-category">${escapeHtml(getCategory())}</span>
            <hr style="width:100%; margin:16px 0;">
            ${cover}
            <div class="article-body">${editContent.innerHTML}</div>
            ${imageReady ? '' : '<p style="color:#d9534f; font-weight:600;">⚠ This article has no image yet and cannot be saved.</p>'}
        `;
        previewModal.hidden = false;
    });
    $('editPreviewClose').addEventListener('click', () => { previewModal.hidden = true; });
    previewModal.addEventListener('click', e => { if (e.target === previewModal) previewModal.hidden = true; });

    saveBtn.addEventListener('click', async () => {
        if (editingId === null) return;

        // Igual que en el panel de administración: el título es el primer h1 del contenido
        const heading = editContent.querySelector('h1');
        const title = (heading ? heading.innerText : editContent.innerText.split('\n')[0] || '').trim();
        const content = editContent.innerHTML.trim();

        if (!title || !editContent.innerText.trim()) {
            editError.textContent = 'The article needs a title (first heading) and some content.';
            return;
        }

        // Un artículo publicado siempre necesita una imagen que se pueda mostrar
        await validateImage();
        if (!imageReady || !effectiveImage) {
            editError.textContent = 'The article needs an image to display. Add a cover image (URL or upload) before saving.';
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        editError.textContent = '';

        try {
            const response = await fetch(`${API_URL}/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    category: getCategory(),
                    image_url: effectiveImage,
                    content,
                    usuario_id: usuarioId,
                }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                editError.textContent = result.error || 'The article could not be saved.';
                return;
            }

            myArticles = myArticles.map(a => (a.id === editingId ? result.article : a));
            renderMyArticles();
            window.closeEditModal();
            wnToast('Article updated');
        } catch (error) {
            console.error('Error al guardar:', error);
            editError.textContent = 'Could not connect to the server.';
        } finally {
            saveBtn.textContent = 'Save Changes';
            setSaveState();
        }
    });

    loadMyArticles();
})();

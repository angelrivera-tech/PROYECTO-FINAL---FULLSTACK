// admin.js - Panel de administración para Worldnews

document.addEventListener('DOMContentLoaded', async () => {
    // 0. VERIFICACIÓN DE SESIÓN: Asegurar que el usuario esté logueado
    const usuarioLogueado = localStorage.getItem('usuarioActivo');
    if (!usuarioLogueado) {
        await wnAlert('Debes iniciar sesión para acceder al panel de administración.', { title: 'Inicia sesión' });
        window.location.href = '../pages/sign in.html'; // Cambia la ruta si tu login está en otra carpeta
        return;
    }

    const API_URL = '/api/articles';
    const UPLOAD_URL = '/api/article-images';
    const DEFAULT_CONTENT = '<h1>Article Title Here...</h1><p>Start writing your article here just like in Microsoft Word...</p>';
    const PLACEHOLDER_TITLE = 'Article Title Here...';
    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

    const $ = (id) => document.getElementById(id);
    const publishBtn = document.querySelector('.submit-btn');
    const editorPage = document.querySelector('.word-page');
    const adminList = document.querySelector('.admin-list');
    const usuarioId = Number(localStorage.getItem('usuarioId')) || null;
    const DRAFT_KEY = `wnArticleDraft-${usuarioId || 'anon'}`;

    const categorySelect = $('article-category');
    const categoryCustom = $('article-category-custom');
    const coverInput = $('cover-url');
    const coverFile = $('cover-file');
    const coverPreviewImg = $('cover-preview-img');
    const coverStatus = $('cover-status');
    const coverRemoveBtn = $('cover-remove-btn');
    const publishHint = $('publish-hint');
    const editorHeading = $('editor-heading');
    const cancelEditBtn = $('cancel-edit-btn');
    const wordCount = $('word-count');
    const draftStatus = $('draft-status');

    let editingId = null;      // ID del artículo que se está editando (null = artículo nuevo)
    let imageReady = false;    // ¿Hay una imagen que se puede mostrar?
    let effectiveImage = null; // Imagen que acompañará al artículo publicado
    let checkToken = 0;
    let myArticles = [];

    // Escapar texto para insertarlo de forma segura en el HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // Ajusta rutas de imágenes igual que en la portada y en la página del artículo
    function resolveSrc(src) {
        const value = (src || '').trim();
        if (!value) return '';
        if (/^(https?:|data:|\.\.\/|\/)/i.test(value)) return value;
        return '../imagenes/' + value.split('/').pop();
    }

    // Comprueba que la imagen realmente se pueda cargar
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
        const img = editorPage.querySelector('img[src]');
        return img ? img.getAttribute('src') : '';
    }

    function setPublishState() {
        publishBtn.disabled = !imageReady;
        publishBtn.title = imageReady ? '' : 'Add an image that loads to publish';
        publishHint.hidden = imageReady;
    }

    function setCoverStatus(kind, message) {
        coverStatus.className = 'cover-status ' + kind;
        coverStatus.textContent = message;
    }

    // Revalida la imagen del artículo (portada o, si no hay, la primera imagen del texto)
    async function validateImage() {
        const token = ++checkToken;
        const cover = resolveSrc(coverInput.value);
        const fromContent = cover ? '' : firstContentImage();
        const candidate = cover || fromContent;

        coverRemoveBtn.hidden = !coverInput.value.trim();

        if (!candidate) {
            imageReady = false;
            effectiveImage = null;
            coverPreviewImg.hidden = true;
            setCoverStatus('missing', 'No cover image yet — an image is required to publish.');
            setPublishState();
            return;
        }

        imageReady = false;
        setPublishState();
        setCoverStatus('loading', 'Checking image…');
        const ok = await imageLoads(candidate);
        if (token !== checkToken) return; // Hubo otro cambio mientras se comprobaba

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
        setPublishState();
    }

    function getCategory() {
        if (categorySelect.value === '__custom') return categoryCustom.value.trim() || 'General';
        return categorySelect.value;
    }

    function setCategory(value) {
        const exists = Array.from(categorySelect.options).some(o => o.value === value && o.value !== '__custom');
        categorySelect.value = exists ? value : '__custom';
        categoryCustom.value = exists ? '' : (value || '');
        categoryCustom.hidden = categorySelect.value !== '__custom';
    }

    function updateWordCount() {
        const words = (editorPage.innerText || '').trim().split(/\s+/).filter(Boolean).length;
        const minutes = Math.max(1, Math.round(words / 200));
        wordCount.textContent = `${words} word${words === 1 ? '' : 's'} · ~${minutes} min read`;
    }

    // --- Borrador automático (solo para artículos nuevos) ---
    let draftTimer = null;
    function saveDraft() {
        if (editingId !== null) return;
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({
                    content: editorPage.innerHTML,
                    category: getCategory(),
                    cover: coverInput.value,
                }));
                draftStatus.textContent = 'Draft saved';
            } catch { /* almacenamiento lleno */ }
        }, 600);
    }

    function loadDraft() {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (!draft) return;
            if (draft.content) editorPage.innerHTML = draft.content;
            setCategory(draft.category || 'General');
            coverInput.value = draft.cover || '';
            draftStatus.textContent = 'Draft restored';
        } catch { /* borrador dañado */ }
    }

    function resetEditor() {
        editingId = null;
        editorPage.innerHTML = DEFAULT_CONTENT;
        setCategory('General');
        coverInput.value = '';
        localStorage.removeItem(DRAFT_KEY);
        draftStatus.textContent = '';
        editorHeading.textContent = 'Write & Format Article';
        publishBtn.textContent = 'Publish Article';
        cancelEditBtn.hidden = true;
        updateWordCount();
        validateImage();
    }

    // --- Subida de imágenes ---
    async function uploadImage(file) {
        if (!file) return null;
        if (!file.type.startsWith('image/')) {
            await wnAlert('Selecciona un archivo de imagen.', { title: 'Archivo no válido', danger: true });
            return null;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            await wnAlert('La imagen es demasiado grande (máximo 5 MB).', { title: 'Imagen demasiado grande', danger: true });
            return null;
        }
        try {
            const response = await fetch(`${UPLOAD_URL}?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'No se pudo subir la imagen');
            return result.url;
        } catch (error) {
            await wnAlert(error.message || 'No se pudo subir la imagen.', { title: 'Error al subir', danger: true });
            return null;
        }
    }

    // 1. Función para obtener y mostrar los artículos en el panel de administración
    async function fetchAdminArticles() {
        if (!adminList) return;
        if (!usuarioId) {
            adminList.innerHTML = '<li style="text-align: center; color: #888;">Inicia sesión para ver tus artículos.</li>';
            return;
        }

        try {
            // Solo los artículos publicados por el usuario que inició sesión
            const response = await fetch(`${API_URL}?usuario_id=${encodeURIComponent(usuarioId)}`);
            if (!response.ok) throw new Error('Error al conectar con el servidor');

            myArticles = await response.json();
            renderAdminList(myArticles);
        } catch (error) {
            console.error('Error al cargar artículos:', error);
            adminList.innerHTML = '<li style="color: red; text-align: center;">Error al cargar los artículos</li>';
        }
    }

    // 2. Renderizar los artículos en la lista de administración (ver, editar, eliminar)
    function renderAdminList(articles) {
        adminList.innerHTML = '';

        if (articles.length === 0) {
            adminList.innerHTML = '<li style="text-align: center; color: #888;">Todavía no has publicado artículos.</li>';
            return;
        }

        articles.forEach(article => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.gap = '12px';
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid #333';

            const temp = document.createElement('div');
            temp.innerHTML = article.content || '';
            const inlineImg = temp.querySelector('img[src]');
            const hasOwnCover = article.image_url && !article.image_url.endsWith('imagenes/imagen2.jpg');
            const thumb = resolveSrc(hasOwnCover || !inlineImg ? article.image_url : inlineImg.getAttribute('src'));
            const fecha = article.fecha_publicacion ? new Date(article.fecha_publicacion).toLocaleDateString() : '';

            li.innerHTML = `
                <div class="admin-item-info">
                    ${thumb ? `<img class="admin-thumb" src="${escapeHtml(thumb)}" alt="">` : ''}
                    <span><strong>${escapeHtml(article.title)}</strong> (${escapeHtml(article.category || 'General')})${fecha ? ` <small style="color:#888;">· ${escapeHtml(fecha)}</small>` : ''}</span>
                </div>
                <div class="admin-item-actions">
                    <a class="btn-view" href="article.html?id=${encodeURIComponent(article.id)}">Ver</a>
                    <button type="button" class="btn-edit" data-id="${article.id}">Editar</button>
                    <button type="button" class="btn-delete" data-id="${article.id}">Eliminar</button>
                </div>
            `;
            li.querySelector('.btn-edit').addEventListener('click', () => startEditing(article.id));
            li.querySelector('.btn-delete').addEventListener('click', () => window.deleteArticle(article.id));
            adminList.appendChild(li);
        });
    }

    // Cargar un artículo existente en el editor
    async function startEditing(id) {
        const article = myArticles.find(a => a.id === id);
        if (!article) return;
        if (editingId === null && editorPage.innerHTML.trim() !== DEFAULT_CONTENT &&
            !(await wnConfirm('Se reemplazará lo que tienes en el editor (tu borrador se conserva). ¿Continuar?', { title: 'Editar artículo', okText: 'Editar', cancelText: 'Cancelar' }))) {
            return;
        }
        editingId = id;
        editorPage.innerHTML = article.content || DEFAULT_CONTENT;
        setCategory(article.category || 'General');
        coverInput.value = article.image_url || '';
        editorHeading.textContent = 'Editing: ' + (article.title || '');
        publishBtn.textContent = 'Update Article';
        cancelEditBtn.hidden = false;
        draftStatus.textContent = '';
        updateWordCount();
        validateImage();
        editorHeading.scrollIntoView({ behavior: 'smooth' });
    }

    cancelEditBtn.addEventListener('click', () => {
        editingId = null;
        editorHeading.textContent = 'Write & Format Article';
        publishBtn.textContent = 'Publish Article';
        cancelEditBtn.hidden = true;
        editorPage.innerHTML = DEFAULT_CONTENT;
        setCategory('General');
        coverInput.value = '';
        loadDraft();
        updateWordCount();
        validateImage();
    });

    $('clear-btn').addEventListener('click', async () => {
        if (await wnConfirm('¿Vaciar el editor y empezar un artículo nuevo?', { title: 'Nuevo artículo', okText: 'Vaciar', cancelText: 'Cancelar', danger: true })) {
            resetEditor();
        }
    });

    // 3. Publicar (o actualizar) el artículo desde el editor tipo Word
    publishBtn.addEventListener('click', async () => {
        const titleElement = editorPage.querySelector('h1');
        const title = titleElement ? titleElement.innerText.trim() : '';
        const content = editorPage.innerHTML;

        if (!title || title === PLACEHOLDER_TITLE) {
            await wnAlert('Escribe un título para el artículo en el primer "Heading 1".', { title: 'Falta el título', danger: true });
            return;
        }

        // No se puede publicar sin una imagen que mostrar
        await validateImage();
        if (!imageReady || !effectiveImage) {
            await wnAlert('El artículo necesita una imagen para mostrarse. Añade una imagen de portada (URL o subida) antes de publicar.', { title: 'Falta la imagen', danger: true });
            return;
        }

        const isEditing = editingId !== null;
        publishBtn.disabled = true;
        publishBtn.textContent = isEditing ? 'Updating...' : 'Publishing...';

        try {
            const response = await fetch(isEditing ? `${API_URL}/${editingId}` : API_URL, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    category: getCategory(),
                    image_url: effectiveImage,
                    content,
                    usuario_id: usuarioId, // ID del usuario que inició sesión
                }),
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok) {
                wnToast(isEditing ? '¡Artículo actualizado!' : '¡Artículo publicado con éxito!');
                if (isEditing) {
                    editingId = null;
                    editorHeading.textContent = 'Write & Format Article';
                    cancelEditBtn.hidden = true;
                    editorPage.innerHTML = DEFAULT_CONTENT;
                    setCategory('General');
                    coverInput.value = '';
                    loadDraft();
                    updateWordCount();
                    validateImage();
                } else {
                    resetEditor();
                }
                fetchAdminArticles(); // Actualizar la lista en el panel
            } else {
                await wnAlert('No se pudo guardar el artículo: ' + (result.error || 'Error desconocido'), { title: 'Error al publicar', danger: true });
            }
        } catch (error) {
            console.error('Error al enviar:', error);
            await wnAlert('Error de conexión con el servidor.', { title: 'Error de conexión', danger: true });
        } finally {
            publishBtn.textContent = editingId !== null ? 'Update Article' : 'Publish Article';
            setPublishState();
        }
    });

    // 4. Función global para eliminar un artículo
    window.deleteArticle = async function(id) {
        if (!(await wnConfirm('¿Estás seguro de eliminar este artículo? Esta acción no se puede deshacer.', { title: 'Eliminar artículo', okText: 'Eliminar', cancelText: 'Cancelar', danger: true }))) return;

        try {
            const response = await fetch(`${API_URL}/${id}?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                if (editingId === id) cancelEditBtn.click();
                fetchAdminArticles(); // Actualizar la lista
            } else {
                await wnAlert('No se pudo eliminar el registro', { title: 'Error al eliminar', danger: true });
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
        }
    };

    // 5. Herramientas de formato
    // Guardar la última selección dentro del editor para que los menús y colores la usen
    let savedRange = null;
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (sel.rangeCount && editorPage.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    });

    function restoreSelection() {
        editorPage.focus();
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    }

    function runCommand(command, value = null) {
        restoreSelection();
        document.execCommand(command, false, value);
        editorPage.dispatchEvent(new Event('input'));
    }

    document.querySelectorAll('.tool-btn[data-command]').forEach(button => {
        // Evitar que el botón quite el foco (y la selección) del editor
        button.addEventListener('mousedown', e => e.preventDefault());
        button.addEventListener('click', async () => {
            const command = button.getAttribute('data-command');

            if (command === 'createLink' || command === 'insertImage') {
                const range = savedRange;
                const value = command === 'createLink'
                    ? await wnPrompt('Ingresa la URL del enlace:', { title: 'Insertar enlace', placeholder: 'https://...', okText: 'Insertar', cancelText: 'Cancelar' })
                    : await wnPrompt('Ingresa la URL o ruta de la imagen:', { title: 'Insertar imagen', placeholder: '../imagenes/foto.jpg', okText: 'Insertar', cancelText: 'Cancelar' });
                if (value && value.trim()) {
                    savedRange = range;
                    runCommand(command, command === 'insertImage' ? resolveSrc(value) : value.trim());
                }
            } else {
                runCommand(command);
            }
        });
    });

    $('block-format').addEventListener('change', (e) => {
        runCommand('formatBlock', e.target.value);
    });

    $('font-size').addEventListener('change', (e) => {
        if (e.target.value) runCommand('fontSize', e.target.value);
        e.target.value = '';
    });

    $('text-color').addEventListener('input', (e) => runCommand('foreColor', e.target.value));
    $('highlight-color').addEventListener('input', (e) => {
        restoreSelection();
        if (!document.execCommand('hiliteColor', false, e.target.value)) {
            document.execCommand('backColor', false, e.target.value);
        }
        editorPage.dispatchEvent(new Event('input'));
    });

    // Mantener el selector de estilo sincronizado con el texto actual
    document.addEventListener('selectionchange', () => {
        if (!editorPage.contains(document.activeElement) && document.activeElement !== editorPage) return;
        const block = (document.queryCommandValue('formatBlock') || '').toUpperCase();
        const select = $('block-format');
        if (Array.from(select.options).some(o => o.value === block)) select.value = block;
        else if (block === '' || block === 'DIV') select.value = 'P';
    });

    // Subir una imagen dentro del texto
    const inlineFile = $('inline-file');
    $('inline-upload-btn').addEventListener('mousedown', e => e.preventDefault());
    $('inline-upload-btn').addEventListener('click', () => inlineFile.click());
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
    coverInput.addEventListener('input', () => {
        clearTimeout(coverTimer);
        coverTimer = setTimeout(() => { validateImage(); saveDraft(); }, 400);
    });

    $('cover-upload-btn').addEventListener('click', () => coverFile.click());
    coverFile.addEventListener('change', async () => {
        const file = coverFile.files[0];
        coverFile.value = '';
        if (!file) return;
        setCoverStatus('loading', 'Uploading image…');
        const url = await uploadImage(file);
        if (url) coverInput.value = url;
        validateImage();
        saveDraft();
    });

    $('cover-from-content-btn').addEventListener('click', async () => {
        const src = firstContentImage();
        if (!src) {
            await wnAlert('El artículo todavía no tiene imágenes. Añade una con "Add Photo" o "Upload Photo".', { title: 'Sin imágenes' });
            return;
        }
        coverInput.value = src;
        validateImage();
        saveDraft();
    });


    coverRemoveBtn.addEventListener('click', () => {
        coverInput.value = '';
        validateImage();
        saveDraft();
    });

    categorySelect.addEventListener('change', () => {
        categoryCustom.hidden = categorySelect.value !== '__custom';
        if (!categoryCustom.hidden) categoryCustom.focus();
        saveDraft();
    });
    categoryCustom.addEventListener('input', saveDraft);

    // --- Cambios en el texto ---
    let contentTimer = null;
    editorPage.addEventListener('input', () => {
        updateWordCount();
        saveDraft();
        clearTimeout(contentTimer);
        contentTimer = setTimeout(() => { if (!coverInput.value.trim()) validateImage(); }, 500);
    });

    // --- Vista previa ---
    const previewModal = $('preview-modal');
    $('preview-btn').addEventListener('click', () => {
        const body = $('preview-body');
        const cover = effectiveImage && imageReady && !editorPage.querySelector(`img[src="${CSS.escape(effectiveImage)}"]`)
            ? `<img class="preview-cover" src="${escapeHtml(effectiveImage)}" alt="Portada">`
            : '';
        body.innerHTML = `
            <span class="preview-category">${escapeHtml(getCategory())}</span>
            <hr style="width:100%; margin:16px 0;">
            ${cover}
            <div class="article-body">${editorPage.innerHTML}</div>
            ${imageReady ? '' : '<p style="color:#d9534f; font-weight:600;">⚠ This article has no image yet and cannot be published.</p>'}
        `;
        previewModal.hidden = false;
    });
    $('preview-close').addEventListener('click', () => { previewModal.hidden = true; });
    previewModal.addEventListener('click', (e) => { if (e.target === previewModal) previewModal.hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') previewModal.hidden = true; });

    // Estado inicial
    loadDraft();
    updateWordCount();
    setPublishState();
    validateImage();

    // Cargar los artículos al iniciar la página de administración
    fetchAdminArticles();
});

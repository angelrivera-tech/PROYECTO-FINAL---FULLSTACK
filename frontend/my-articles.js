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
        if (!src) return '../imagenes/imagen2.jpg';
        if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('../')) return src;
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
            const imgUrl = fixImagePath(firstImg ? firstImg.getAttribute('src') : article.image_url);
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

    function openEditModal(id) {
        const article = myArticles.find(a => a.id === id);
        if (!article) return;
        editingId = id;
        editCategory.value = article.category || '';
        editImage.value = article.image_url || '';
        editContent.innerHTML = article.content || `<h1>${escapeHtml(article.title)}</h1>`;
        editError.textContent = '';
        modal.classList.add('active');
        overlay.classList.add('active');
        editContent.focus();
    }

    window.closeEditModal = function () {
        editingId = null;
        modal.classList.remove('active');
        overlay.classList.remove('active');
    };

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('active')) window.closeEditModal();
    });

    // Botones de formato del editor
    document.querySelectorAll('.edit-tool-btn[data-command]').forEach(button => {
        button.addEventListener('click', async () => {
            const command = button.getAttribute('data-command');
            editContent.focus();
            if (command === 'createLink' || command === 'insertImage') {
                // Guardar la selección del editor mientras la ventana está abierta
                const selection = window.getSelection();
                const range = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
                const value = command === 'createLink'
                    ? await wnPrompt('Enter the link URL:', { title: 'Insert link', placeholder: 'https://...', okText: 'Insert' })
                    : await wnPrompt('Enter the image URL or path:', { title: 'Insert photo', placeholder: '../imagenes/photo.jpg', okText: 'Insert' });
                if (value && value.trim()) {
                    editContent.focus();
                    if (range) { selection.removeAllRanges(); selection.addRange(range); }
                    document.execCommand(command, false, value.trim());
                }
            } else {
                document.execCommand(command, false, null);
            }
        });
    });

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

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        editError.textContent = '';

        try {
            const response = await fetch(`${API_URL}/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    category: editCategory.value.trim() || 'General',
                    image_url: editImage.value.trim(),
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
        } catch (error) {
            console.error('Error al guardar:', error);
            editError.textContent = 'Could not connect to the server.';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });

    loadMyArticles();
})();

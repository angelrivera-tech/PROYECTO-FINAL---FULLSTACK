// saved-articles.js - Muestra los artículos guardados ("pin") en "My Saved News"

(function () {
    const container = document.getElementById('articles-container');
    const emptyMsg = document.getElementById('noArticlesMsg');
    if (!container) return;

    const usuarioId = Number(localStorage.getItem('usuarioId')) || null;
    let saved = [];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fixImagePath(src) {
        if (!src) return '../imagenes/imagen2.jpg';
        if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('../') || src.startsWith('/')) return src;
        return '../imagenes/' + src.split('/').pop();
    }

    function showEmpty(message) {
        container.innerHTML = '';
        emptyMsg.textContent = message;
        emptyMsg.style.display = 'block';
    }

    function render() {
        if (saved.length === 0) {
            showEmpty('You have no saved articles yet. Use "📌 Save for later" on any article to pin it here.');
            return;
        }
        if (usuarioId) {
            emptyMsg.style.display = 'none';
        } else {
            emptyMsg.textContent = 'These pins are saved in this browser. Log in to keep them in your account.';
            emptyMsg.style.display = 'block';
        }
        container.innerHTML = '';

        saved.forEach(article => {
            const temp = document.createElement('div');
            temp.innerHTML = article.content || '';
            const firstImg = temp.querySelector('img');
            const imgUrl = fixImagePath(firstImg && !(article.image_url && !article.image_url.endsWith('imagenes/imagen2.jpg')) ? firstImg.getAttribute('src') : article.image_url);
            const heading = temp.querySelector('h1');
            if (heading) heading.remove();
            const text = (temp.textContent || '').trim();
            const excerpt = text.length > 140 ? text.substring(0, 140) + '...' : text;
            const fecha = article.fecha_guardado ? new Date(article.fecha_guardado).toLocaleDateString() : '';

            const card = document.createElement('div');
            card.className = 'saved-card article-item';
            card.innerHTML = `
                <div>
                    <div class="card-category">${escapeHtml(article.category || 'General')}</div>
                    <img src="${escapeHtml(imgUrl)}" alt="">
                    <h3>${escapeHtml(article.title)}</h3>
                    <p class="my-article-excerpt">${escapeHtml(excerpt)}</p>
                </div>
                <div class="card-actions">
                    <span class="saved-date">Saved: ${escapeHtml(fecha)}</span>
                    <div class="card-buttons">
                        <button type="button" class="edit-btn" data-read="${article.id}">Read 📖</button>
                        <button type="button" class="remove-btn" data-unpin="${article.id}">Remove</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Volver a aplicar la búsqueda si hay texto escrito
        if (typeof window.searchArticles === 'function') window.searchArticles();
    }

    container.addEventListener('click', async event => {
        const readId = event.target.closest('[data-read]')?.getAttribute('data-read');
        if (readId) {
            window.location.href = `article.html?id=${encodeURIComponent(readId)}`;
            return;
        }

        const unpinButton = event.target.closest('[data-unpin]');
        if (!unpinButton) return;
        const id = Number(unpinButton.getAttribute('data-unpin'));
        const article = saved.find(a => a.id === id);
        if (!article) return;

        const ok = await wnConfirm(`Remove "${article.title}" from your saved articles?`, {
            title: 'Remove saved article',
            okText: 'Remove',
            danger: true,
        });
        if (!ok) return;

        if (!usuarioId) {
            window.wnPins.removeGuestPin(id);
            saved = saved.filter(a => a.id !== id);
            render();
            wnToast('Removed from My Saved News');
            return;
        }

        unpinButton.disabled = true;
        try {
            const response = await fetch(`/api/saved/${id}?usuario_id=${encodeURIComponent(usuarioId)}`, { method: 'DELETE' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'The article could not be removed.', { title: 'Something went wrong', danger: true });
                unpinButton.disabled = false;
                return;
            }
            saved = saved.filter(a => a.id !== id);
            render();
            wnToast('Removed from My Saved News');
        } catch (error) {
            console.error('Error al quitar:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
            unpinButton.disabled = false;
        }
    });

    // Visitantes sin sesión: los pins están en este navegador
    async function loadGuestPins() {
        const pins = window.wnPins ? window.wnPins.guestPins() : [];
        if (pins.length === 0) return [];
        const response = await fetch('/api/articles');
        if (!response.ok) throw new Error('Error al conectar con el servidor');
        const byId = new Map((await response.json()).map(a => [a.id, a]));
        return pins
            .filter(p => byId.has(p.id))
            .map(p => ({ ...byId.get(p.id), fecha_guardado: p.fecha_guardado }));
    }

    async function load() {
        emptyMsg.style.display = 'block';
        emptyMsg.textContent = 'Loading your saved articles...';
        try {
            if (usuarioId) {
                // Pasa a la cuenta los pins hechos antes de iniciar sesión
                if (window.wnPins) await window.wnPins.load();
                const response = await fetch(`/api/saved?usuario_id=${encodeURIComponent(usuarioId)}`);
                if (!response.ok) throw new Error('Error al conectar con el servidor');
                saved = await response.json();
            } else {
                saved = await loadGuestPins();
            }
            render();
        } catch (error) {
            console.error('Error al cargar guardados:', error);
            showEmpty('Your saved articles could not be loaded.');
        }
    }

    load();
})();

// pins.js - Guardar ("pin") artículos para leer después.
// Requiere dialogs.js. Expone window.wnPins.

(function () {
    if (window.wnPins) return;
    const API = '/api/saved';

    const style = document.createElement('style');
    style.textContent = `
    .pin-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: #ffffff; color: #111111;
        border: 2px solid #111111; border-radius: 6px;
        padding: 6px 14px; font-weight: 600; font-size: 0.9rem;
        cursor: pointer; font-family: inherit;
        transition: all 0.2s ease;
    }
    .pin-btn:hover { background: #111111; color: #ffffff; transform: translateY(-1px); }
    .pin-btn.pinned { background: #0275d8; border-color: #0275d8; color: #ffffff; }
    .pin-btn.pinned:hover { background: #025aa5; border-color: #025aa5; }
    .pin-btn:disabled { opacity: 0.6; cursor: wait; transform: none; }
    `;
    document.head.appendChild(style);

    let pinned = new Set();
    let loaded = null;

    function userId() {
        return Number(localStorage.getItem('usuarioId')) || null;
    }

    async function load() {
        const id = userId();
        if (!id) { pinned = new Set(); return pinned; }
        if (!loaded) {
            loaded = fetch(`${API}?usuario_id=${encodeURIComponent(id)}`)
                .then(r => (r.ok ? r.json() : []))
                .then(list => { pinned = new Set(list.map(a => a.id)); return pinned; })
                .catch(() => pinned);
        }
        return loaded;
    }

    function paint(button, isPinned) {
        button.classList.toggle('pinned', isPinned);
        button.textContent = isPinned ? '📌 Saved' : '📌 Save for later';
        button.setAttribute('aria-pressed', String(isPinned));
        button.title = isPinned ? 'Remove from My Saved News' : 'Save to read later';
    }

    async function toggle(articleId, button) {
        const id = userId();
        if (!id) {
            await wnAlert('Log in to save articles and read them later.', { title: 'Log in required' });
            window.location.href = '../pages/log in.html';
            return;
        }

        const isPinned = pinned.has(articleId);
        if (button) button.disabled = true;
        try {
            const response = isPinned
                ? await fetch(`${API}/${articleId}?usuario_id=${encodeURIComponent(id)}`, { method: 'DELETE' })
                : await fetch(API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario_id: id, articulo_id: articleId }),
                });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'The article could not be saved.', { title: 'Something went wrong', danger: true });
                return;
            }
            if (isPinned) pinned.delete(articleId); else pinned.add(articleId);
            document.querySelectorAll(`.pin-btn[data-pin="${articleId}"]`).forEach(b => paint(b, !isPinned));
            wnToast(isPinned ? 'Removed from My Saved News' : 'Saved to My Saved News 📌');
        } catch (error) {
            console.error('Error al guardar:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
        } finally {
            if (button) button.disabled = false;
        }
    }

    // Crea un botón de pin para un artículo
    function button(articleId) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pin-btn';
        b.setAttribute('data-pin', articleId);
        paint(b, pinned.has(articleId));
        b.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            toggle(articleId, b);
        });
        return b;
    }

    window.wnPins = {
        load,
        toggle,
        button,
        isPinned: id => pinned.has(id),
        remove: id => pinned.delete(id),
    };
})();

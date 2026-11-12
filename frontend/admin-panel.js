// admin-panel.js - Panel de administración de Worldnews (solo para la cuenta de administrador).
// Todas las acciones pasan por /api/admin, que comprueba la sesión firmada en el servidor.

(function () {
    const API = '/api/admin';
    const $ = (id) => document.getElementById(id);

    let articles = [];
    let users = [];
    let editingArticleId = null;
    let editingUserId = null;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function toast(message, error) {
        if (window.wnToast) wnToast(message, { error });
    }

    // Petición autenticada al API del panel
    async function api(path, options = {}) {
        const token = localStorage.getItem('wnSessionToken');
        const response = await fetch(API + path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + (token || ''),
                ...(options.headers || {}),
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = new Error(data.error || 'Something went wrong');
            err.status = response.status;
            throw err;
        }
        return data;
    }

    function showGate(message, showLogin) {
        $('ap-gate').hidden = false;
        $('ap-content').hidden = true;
        $('ap-gate-msg').textContent = message;
        $('ap-gate-login').hidden = !showLogin;
    }

    // ---------- Pestañas ----------
    document.querySelectorAll('.ap-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ap-tab').forEach((t) => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.ap-panel').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
        });
    });

    // ---------- Ventanas ----------
    function openModal(id) { $(id).hidden = false; }
    function closeModal(id) { $(id).hidden = true; }
    document.querySelectorAll('.ap-modal').forEach((modal) => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-close]')) closeModal(modal.id);
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.ap-modal').forEach((m) => { m.hidden = true; });
    });

    // ---------- Artículos ----------
    function renderArticles() {
        const q = $('ap-article-search').value.trim().toLowerCase();
        const rows = articles.filter((a) =>
            !q || [a.title, a.category, a.author].some((v) => (v || '').toLowerCase().includes(q)));
        $('ap-stat-articles').textContent = articles.length;
        const body = $('ap-articles-body');
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="6" class="ap-muted">${articles.length ? 'No articles match your search.' : 'There are no articles yet.'}</td></tr>`;
            return;
        }
        body.innerHTML = rows.map((a) => `
            <tr>
                <td>${a.id}</td>
                <td class="ap-title-cell"><a href="article.html?id=${a.id}" target="_blank">${escapeHtml(a.title)}</a></td>
                <td>${escapeHtml(a.category || 'General')}</td>
                <td>${a.author ? escapeHtml(a.author) : '<span class="ap-muted">(deleted user)</span>'}</td>
                <td>${a.fecha_publicacion ? new Date(a.fecha_publicacion).toLocaleDateString() : ''}</td>
                <td class="ap-actions">
                    <button class="ap-btn ap-btn-sm" data-edit-article="${a.id}">Edit</button>
                    <button class="ap-btn ap-btn-sm ap-btn-danger" data-delete-article="${a.id}">Delete</button>
                </td>
            </tr>`).join('');
    }

    async function loadArticles() {
        articles = await api('/articles');
        renderArticles();
    }

    const contentEditor = $('ap-a-content');
    const htmlEditor = $('ap-a-html');

    function editorHtml() {
        return htmlEditor.hidden ? contentEditor.innerHTML : htmlEditor.value;
    }

    function openArticleEditor(id) {
        const a = articles.find((x) => x.id === id);
        if (!a) return;
        editingArticleId = id;
        $('ap-article-id').textContent = '#' + id;
        $('ap-a-title').value = a.title || '';
        $('ap-a-category').value = a.category || '';
        $('ap-a-image').value = a.image_url || '';
        contentEditor.innerHTML = a.content || '';
        htmlEditor.value = a.content || '';
        contentEditor.hidden = false;
        htmlEditor.hidden = true;
        $('ap-a-view').href = 'article.html?id=' + id;
        openModal('ap-article-modal');
    }

    document.querySelectorAll('.ap-editor-toolbar [data-cmd]').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => e.preventDefault()); // mantener la selección
        btn.addEventListener('click', async () => {
            if (!htmlEditor.hidden) return;
            const cmd = btn.dataset.cmd;
            let value = btn.dataset.val || null;
            if (cmd === 'createLink' || cmd === 'insertImage') {
                const sel = window.getSelection();
                const range = sel.rangeCount ? sel.getRangeAt(0) : null;
                value = await wnPrompt(cmd === 'createLink' ? 'Link URL:' : 'Image URL:', { placeholder: 'https://…' });
                if (!value) return;
                contentEditor.focus();
                if (range) { sel.removeAllRanges(); sel.addRange(range); }
            }
            document.execCommand(cmd, false, value);
            contentEditor.focus();
        });
    });

    $('ap-toggle-html').addEventListener('click', () => {
        if (htmlEditor.hidden) {
            htmlEditor.value = contentEditor.innerHTML;
        } else {
            contentEditor.innerHTML = htmlEditor.value;
        }
        htmlEditor.hidden = !htmlEditor.hidden;
        contentEditor.hidden = !contentEditor.hidden;
        $('ap-toggle-html').classList.toggle('active', !htmlEditor.hidden);
    });

    $('ap-a-save').addEventListener('click', async () => {
        const btn = $('ap-a-save');
        btn.disabled = true;
        try {
            const result = await api('/articles/' + editingArticleId, {
                method: 'PUT',
                body: JSON.stringify({
                    title: $('ap-a-title').value,
                    category: $('ap-a-category').value,
                    image_url: $('ap-a-image').value.trim(),
                    content: editorHtml(),
                }),
            });
            const i = articles.findIndex((a) => a.id === editingArticleId);
            if (i >= 0) articles[i] = { ...articles[i], ...result.article };
            renderArticles();
            closeModal('ap-article-modal');
            toast('Article updated');
        } catch (err) {
            await wnAlert(err.message, { title: 'Could not save', danger: true });
        } finally {
            btn.disabled = false;
        }
    });

    async function deleteArticle(id) {
        const a = articles.find((x) => x.id === id);
        if (!a) return;
        const ok = await wnConfirm(`Delete "${a.title}"? This cannot be undone.`, { title: 'Delete article', danger: true, okText: 'Delete' });
        if (!ok) return;
        try {
            await api('/articles/' + id, { method: 'DELETE' });
            articles = articles.filter((x) => x.id !== id);
            renderArticles();
            const author = users.find((u) => u.username === a.author);
            if (author) { author.published_count = Math.max(0, author.published_count - 1); renderUsers(); }
            toast('Article deleted');
        } catch (err) {
            await wnAlert(err.message, { title: 'Could not delete', danger: true });
        }
    }

    $('ap-articles-body').addEventListener('click', (e) => {
        const edit = e.target.closest('[data-edit-article]');
        const del = e.target.closest('[data-delete-article]');
        if (edit) openArticleEditor(Number(edit.dataset.editArticle));
        if (del) deleteArticle(Number(del.dataset.deleteArticle));
    });
    $('ap-article-search').addEventListener('input', renderArticles);

    // ---------- Usuarios ----------
    function renderUsers() {
        const q = $('ap-user-search').value.trim().toLowerCase();
        const rows = users.filter((u) => !q || [u.username, u.email].some((v) => (v || '').toLowerCase().includes(q)));
        $('ap-stat-users').textContent = users.length;
        const body = $('ap-users-body');
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="6" class="ap-muted">No users match your search.</td></tr>';
            return;
        }
        body.innerHTML = rows.map((u) => `
            <tr>
                <td>${u.id}</td>
                <td>${escapeHtml(u.username)} ${u.is_admin ? '<span class="ap-badge">Admin</span>' : ''}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${u.published_count}</td>
                <td>${u.saved_count}</td>
                <td class="ap-actions">
                    <button class="ap-btn ap-btn-sm" data-edit-user="${u.id}">Edit</button>
                    ${u.is_admin ? '' : `<button class="ap-btn ap-btn-sm ap-btn-danger" data-delete-user="${u.id}">Delete</button>`}
                </td>
            </tr>`).join('');
    }

    async function loadUsers() {
        users = await api('/users');
        renderUsers();
    }

    function openUserEditor(id) {
        const u = users.find((x) => x.id === id);
        if (!u) return;
        editingUserId = id;
        $('ap-user-id').textContent = '#' + id;
        $('ap-u-username').value = u.username;
        $('ap-u-email').value = u.email;
        $('ap-u-username').disabled = !!u.is_admin; // el administrador conserva su nombre
        openModal('ap-user-modal');
    }

    $('ap-u-save').addEventListener('click', async () => {
        const btn = $('ap-u-save');
        btn.disabled = true;
        try {
            const old = users.find((u) => u.id === editingUserId);
            const result = await api('/users/' + editingUserId, {
                method: 'PUT',
                body: JSON.stringify({ username: $('ap-u-username').value, email: $('ap-u-email').value }),
            });
            if (old) {
                // Actualizar el nombre del autor en la lista de artículos
                articles.forEach((a) => { if (a.usuario_id === old.id) a.author = result.user.username; });
                Object.assign(old, result.user);
            }
            renderUsers();
            renderArticles();
            closeModal('ap-user-modal');
            toast('User updated');
        } catch (err) {
            await wnAlert(err.message, { title: 'Could not save', danger: true });
        } finally {
            btn.disabled = false;
        }
    });

    async function deleteUser(id) {
        const u = users.find((x) => x.id === id);
        if (!u) return;
        const ok = await wnConfirm(`Delete the account "${u.username}"? Their saved articles and profile picture are removed too.`,
            { title: 'Delete user', danger: true, okText: 'Continue' });
        if (!ok) return;
        let mode = 'keep';
        if (u.published_count > 0) {
            const removeArticles = await wnConfirm(
                `${u.username} has published ${u.published_count} article(s). Delete those articles as well?`,
                { title: 'Their articles', danger: true, okText: 'Delete articles', cancelText: 'Keep articles' });
            mode = removeArticles ? 'delete' : 'keep';
        }
        try {
            await api(`/users/${id}?articles=${mode}`, { method: 'DELETE' });
            users = users.filter((x) => x.id !== id);
            if (mode === 'delete') articles = articles.filter((a) => a.usuario_id !== id);
            else articles.forEach((a) => { if (a.usuario_id === id) { a.usuario_id = null; a.author = null; } });
            renderUsers();
            renderArticles();
            toast('User deleted');
        } catch (err) {
            await wnAlert(err.message, { title: 'Could not delete', danger: true });
        }
    }

    $('ap-users-body').addEventListener('click', (e) => {
        const edit = e.target.closest('[data-edit-user]');
        const del = e.target.closest('[data-delete-user]');
        if (edit) openUserEditor(Number(edit.dataset.editUser));
        if (del) deleteUser(Number(del.dataset.deleteUser));
    });
    $('ap-user-search').addEventListener('input', renderUsers);

    // ---------- Agentes de IA (espacio reservado) ----------
    // Para añadir un agente en el futuro: devolverlo desde GET /api/admin/agents
    // con { id, name, description } y conectar el botón "Run agent".
    async function loadAgents() {
        const { agents = [] } = await api('/agents').catch(() => ({ agents: [] }));
        $('ap-stat-agents').textContent = agents.length;
        const list = $('ap-agents-list');
        if (!agents.length) {
            list.innerHTML = ['Article summarizer', 'Category suggester', 'Content reviewer'].map((name) => `
                <div class="ap-agent-card ap-agent-placeholder">
                    <div class="ap-agent-icon">🤖</div>
                    <strong>${name}</strong>
                    <small>Slot available</small>
                </div>`).join('');
            return;
        }
        list.innerHTML = agents.map((a) => `
            <div class="ap-agent-card">
                <div class="ap-agent-icon">🤖</div>
                <strong>${escapeHtml(a.name)}</strong>
                <small>${escapeHtml(a.description || '')}</small>
            </div>`).join('');
        const select = $('ap-agent-select');
        select.innerHTML = agents.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    }

    // ---------- Inicio ----------
    document.addEventListener('DOMContentLoaded', async () => {
        if (!localStorage.getItem('usuarioActivo')) {
            showGate('You need to log in to use the admin panel.', true);
            return;
        }
        if (!localStorage.getItem('wnSessionToken')) {
            showGate('For security, please log in again to open the admin panel.', true);
            return;
        }
        try {
            await api('/me');
        } catch (err) {
            showGate(err.message, err.status === 401);
            return;
        }
        $('ap-gate').hidden = true;
        $('ap-content').hidden = false;
        try {
            await Promise.all([loadArticles(), loadUsers(), loadAgents()]);
        } catch (err) {
            await wnAlert(err.message, { title: 'Could not load data', danger: true });
        }
    });
})();

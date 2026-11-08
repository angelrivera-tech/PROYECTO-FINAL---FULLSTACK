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
    const publishBtn = document.querySelector('.submit-btn');
    const editorPage = document.querySelector('.word-page');
    const adminList = document.querySelector('.admin-list');
    const usuarioId = Number(localStorage.getItem('usuarioId')) || null;

    // Escapar texto para insertarlo de forma segura en el HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
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
            
            const articles = await response.json();
            renderAdminList(articles);
        } catch (error) {
            console.error('Error al cargar artículos:', error);
            adminList.innerHTML = '<li style="color: red; text-align: center;">Error al cargar los artículos</li>';
        }
    }

    // 2. Renderizar los artículos en la lista de administración (con opción de eliminar)
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
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid #333';

            li.innerHTML = `
                <span><strong>${escapeHtml(article.title)}</strong> (${escapeHtml(article.category || 'General')})</span>
                <button onclick="deleteArticle(${article.id})" class="btn-delete" style="background-color: #d9534f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Eliminar</button>
            `;
            adminList.appendChild(li);
        });
    }

    // 3. Publicar nuevo artículo desde el editor tipo Word
    if (publishBtn && editorPage) {
        publishBtn.addEventListener('click', async () => {
            const titleElement = editorPage.querySelector('h1');
            const title = titleElement ? titleElement.innerText.trim() : 'Sin título';
            const content = editorPage.innerHTML;
            
            const category = "General"; 
            const image_url = "../imagenes/imagen2.jpg"; 
            const usuario_id = usuarioId; // ID del usuario que inició sesión

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: title,
                        category: category,
                        image_url: image_url,
                        content: content,
                        usuario_id: usuario_id
                    }),
                });

                const result = await response.json();

                if (response.ok) {
                    wnToast('¡Artículo publicado con éxito!');
                    editorPage.innerHTML = '<h1>Article Title Here...</h1><p>Start writing your article here...</p>'; // Limpiar editor
                    fetchAdminArticles(); // Actualizar la lista en el panel
                } else {
                    await wnAlert('No se pudo publicar el artículo: ' + (result.error || 'Error desconocido'), { title: 'Error al publicar', danger: true });
                }
            } catch (error) {
                console.error('Error al enviar:', error);
                await wnAlert('Error de conexión con el servidor.', { title: 'Error de conexión', danger: true });
            }
        });
    }

    // 4. Función global para eliminar un artículo
    window.deleteArticle = async function(id) {
        if (!(await wnConfirm('¿Estás seguro de eliminar este artículo? Esta acción no se puede deshacer.', { title: 'Eliminar artículo', okText: 'Eliminar', cancelText: 'Cancelar', danger: true }))) return;

        try {
            const response = await fetch(`${API_URL}/${id}?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchAdminArticles(); // Actualizar la lista
            } else {
                await wnAlert('No se pudo eliminar el registro', { title: 'Error al eliminar', danger: true });
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
        }
    };

    // 5. Funcionalidad avanzada para los botones de formato (incluyendo Links e Imágenes)
    const toolButtons = document.querySelectorAll('.tool-btn[data-command]');
    toolButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const command = button.getAttribute('data-command');

            if (command === 'createLink' || command === 'insertImage') {
                // Guardar la selección del editor mientras la ventana está abierta
                const selection = window.getSelection();
                const range = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
                const value = command === 'createLink'
                    ? await wnPrompt('Ingresa la URL del enlace:', { title: 'Insertar enlace', placeholder: 'https://...', okText: 'Insertar', cancelText: 'Cancelar' })
                    : await wnPrompt('Ingresa la URL o ruta de la imagen:', { title: 'Insertar imagen', placeholder: '../imagenes/foto.jpg', okText: 'Insertar', cancelText: 'Cancelar' });
                if (value && value.trim()) {
                    if (editorPage) editorPage.focus();
                    if (range) { selection.removeAllRanges(); selection.addRange(range); }
                    document.execCommand(command, false, value.trim());
                }
            } else {
                document.execCommand(command, false, null);
            }
        });
    });

    // Cargar los artículos al iniciar la página de administración
    fetchAdminArticles();
});
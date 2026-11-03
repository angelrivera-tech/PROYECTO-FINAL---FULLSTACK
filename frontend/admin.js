// admin.js - Panel de administración para Worldnews

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/articles';
    const publishBtn = document.querySelector('.submit-btn');
    const editorPage = document.querySelector('.word-page');
    const adminList = document.querySelector('.admin-list');

    // 1. Función para obtener y mostrar los artículos en el panel de administración
    async function fetchAdminArticles() {
        if (!adminList) return;
        
        try {
            const response = await fetch(API_URL);
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
            adminList.innerHTML = '<li style="text-align: center; color: #888;">No hay artículos publicados.</li>';
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
                <span><strong>${article.title}</strong> (${article.category || 'General'})</span>
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
            const usuario_id = 1; // ID del administrador por defecto

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
                    alert('¡Artículo publicado con éxito!');
                    editorPage.innerHTML = '<h1>Article Title Here...</h1><p>Start writing your article here...</p>'; // Limpiar editor
                    fetchAdminArticles(); // Actualizar la lista en el panel
                } else {
                    alert('No se pudo publicar el artículo: ' + (result.error || 'Error desconocido'));
                }
            } catch (error) {
                console.error('Error al enviar:', error);
                alert('Error de conexión con el servidor.');
            }
        });
    }

    // 4. Función global para eliminar un artículo
    window.deleteArticle = async function(id) {
        if (!confirm('¿Estás seguro de eliminar este artículo?')) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchAdminArticles(); // Actualizar la lista
            } else {
                alert('No se pudo eliminar el registro');
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
        }
    };

    // 5. Funcionalidad avanzada para los botones de formato (incluyendo Links e Imágenes)
    const toolButtons = document.querySelectorAll('.tool-btn[data-command]');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');

            if (command === 'createLink') {
                const url = prompt('Ingresa la URL del enlace:');
                if (url) {
                    document.execCommand(command, false, url);
                }
            } else if (command === 'insertImage') {
                const imageUrl = prompt('Ingresa la URL o ruta de la imagen:');
                if (imageUrl) {
                    document.execCommand(command, false, imageUrl);
                }
            } else {
                document.execCommand(command, false, null);
            }
        });
    });

    // Cargar los artículos al iniciar la página de administración
    fetchAdminArticles();
});
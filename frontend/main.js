document.addEventListener('DOMContentLoaded', async () => {
    const articlesContainer = document.getElementById('articles-container');
    
    // 1. Verificar si el usuario ha iniciado sesión y actualizar la interfaz (Navbar)
    actualizarInterfazUsuario();

    if (!articlesContainer) return;

    try {
        // Detectar si estamos en local (incluyendo doble clic con file://) o en producción
        const API_URL = '/api/articles';

        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error al conectar con el servidor');

        const articles = await response.json();
        if (window.wnPins) await wnPins.load();
        articlesContainer.innerHTML = '';

        if (articles.length === 0) {
            articlesContainer.innerHTML = '<p style="text-align: center; color: #888;">No hay noticias publicadas todavía.</p>';
            return;
        }

        articles.forEach(article => {
            const articleDiv = document.createElement('div');
            articleDiv.classList.add('article-item');

            const fecha = article.fecha_publicacion ? new Date(article.fecha_publicacion).toLocaleDateString() : '';

            let imgUrl = article.image_url || '../imagenes/imagen2.jpg';
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = article.content || '';
            const firstImg = tempDiv.querySelector('img');
            
            if (firstImg) {
                imgUrl = firstImg.getAttribute('src');
            }

            if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:') && !imgUrl.startsWith('../')) {
                const fileName = imgUrl.split('/').pop();
                imgUrl = '../imagenes/' + fileName;
            }

            let rawContent = tempDiv.textContent || tempDiv.innerText || '';
            let excerpt = rawContent.length > 150 ? rawContent.substring(0, 150) + '...' : rawContent;

            articleDiv.innerHTML = `
                <div class="article-card-container">
                    <img src="${imgUrl}" alt="Portada" class="article-thumbnail">
                    <div class="article-card-content">
                        <span class="article-category">${article.category || 'General'}</span>
                        <h3>
                            <a href="article.html?id=${article.id}" class="article-title-link">${article.title}</a>
                        </h3>
                        <small class="article-date">Publicado: ${fecha}</small>
                        <p class="article-excerpt">${excerpt}</p>
                        <div class="article-card-actions" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <a href="article.html?id=${article.id}" class="read-more-btn">Leer más &rarr;</a>
                        </div>
                    </div>
                </div>
                <hr>
            `;

            if (window.wnPins) {
                articleDiv.querySelector('.article-card-actions').appendChild(wnPins.button(article.id));
            }

            articlesContainer.appendChild(articleDiv);
        });

    } catch (error) {
        console.error('Error al cargar los artículos:', error);
        articlesContainer.innerHTML = '<p style="text-align: center; color: red;">No se pudieron cargar las noticias del servidor.</p>';
    }
});

// Función para adaptar la barra de navegación según si hay sesión activa
function actualizarInterfazUsuario() {
    const usuarioLogueado = localStorage.getItem('usuarioActivo');
    const linksHeader = document.querySelector('.navigation-links') || document.querySelector('.header-links');
    if (!linksHeader) return;

    if (usuarioLogueado) {
        const links = linksHeader.querySelectorAll('a');
        links.forEach(link => {
            if (link.textContent.toLowerCase().includes('sign in') || link.textContent.toLowerCase().includes('log in') || link.textContent.toLowerCase().includes('login')) {
                link.style.display = 'none';
            }
        });

        // Agregar un botón de cerrar sesión dinámicamente si no existe
        if (!document.getElementById('logoutBtn')) {
            const logoutLink = document.createElement('a');
            logoutLink.id = 'logoutBtn';
            logoutLink.href = '#';
            logoutLink.textContent = `Cerrar sesión (${usuarioLogueado})`;
            logoutLink.style.color = '#ff4d4d';
            logoutLink.onclick = cerrarSesion;
            linksHeader.appendChild(logoutLink);
        }
    }
}

// Función para cerrar sesión desde el menú
async function cerrarSesion(event) {
    event.preventDefault();
    localStorage.removeItem('usuarioActivo');
    localStorage.removeItem('usuarioId');
    await wnAlert('Has cerrado sesión correctamente.', { title: 'Sesión cerrada' });
    window.location.href = '../pages/index.html';
}
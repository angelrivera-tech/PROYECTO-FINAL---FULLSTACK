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

        // Agrupar los artículos por categoría (el orden del API ya es del más reciente al más antiguo)
        const groups = new Map();
        articles.forEach(article => {
            const name = String(article.category || '').trim() || 'General';
            const key = name.toLowerCase();
            if (!groups.has(key)) groups.set(key, { name, items: [] });
            groups.get(key).items.push(article);
        });

        // Las categorías estándar primero (en el orden del editor), luego las personalizadas por orden alfabético
        const order = HOME_CATEGORY_ORDER.map(c => c.toLowerCase());
        const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
            return a.localeCompare(b);
        });

        sortedGroups.forEach(([, group]) => {
            articlesContainer.appendChild(buildCategoryRow(group));
        });

        const noResults = document.createElement('p');
        noResults.id = 'no-search-results';
        noResults.className = 'no-search-results';
        noResults.textContent = 'No articles match your search.';
        noResults.hidden = true;
        articlesContainer.appendChild(noResults);

        updateAllRowArrows();
        window.addEventListener('resize', updateAllRowArrows);

    } catch (error) {
        console.error('Error al cargar los artículos:', error);
        articlesContainer.innerHTML = '<p style="text-align: center; color: red;">No se pudieron cargar las noticias del servidor.</p>';
    }
});

const HOME_CATEGORY_ORDER = ['General', 'World', 'Politics', 'Economy', 'Technology', 'Science', 'Health', 'Sports', 'Culture', 'Entertainment', 'Opinion'];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Crea una fila horizontal (carrusel) con todos los artículos de una categoría
function buildCategoryRow(group) {
    const section = document.createElement('section');
    section.className = 'category-row';

    const header = document.createElement('div');
    header.className = 'category-row-header';
    header.innerHTML = `
        <h2 class="category-row-title">${escapeHtml(group.name)}</h2>
        <span class="category-row-count">${group.items.length} ${group.items.length === 1 ? 'article' : 'articles'}</span>
        <div class="category-row-nav">
            <button type="button" class="row-arrow prev" aria-label="Scroll ${escapeHtml(group.name)} left">&#8249;</button>
            <button type="button" class="row-arrow next" aria-label="Scroll ${escapeHtml(group.name)} right">&#8250;</button>
        </div>
    `;

    const track = document.createElement('div');
    track.className = 'category-row-track';
    track.tabIndex = 0;
    track.setAttribute('aria-label', `${group.name} articles`);

    group.items.forEach(article => track.appendChild(buildArticleCard(article)));

    const scrollBy = dir => track.scrollBy({ left: dir * Math.max(track.clientWidth * 0.8, 280), behavior: 'smooth' });
    header.querySelector('.prev').addEventListener('click', () => scrollBy(-1));
    header.querySelector('.next').addEventListener('click', () => scrollBy(1));
    track.addEventListener('scroll', () => updateRowArrows(section), { passive: true });

    section.appendChild(header);
    section.appendChild(track);
    return section;
}

// Activa/desactiva las flechas según si se puede seguir desplazando
function updateRowArrows(section) {
    const track = section.querySelector('.category-row-track');
    const prev = section.querySelector('.row-arrow.prev');
    const next = section.querySelector('.row-arrow.next');
    const overflow = track.scrollWidth - track.clientWidth > 2;
    section.classList.toggle('scrollable', overflow);
    prev.disabled = !overflow || track.scrollLeft <= 2;
    next.disabled = !overflow || track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
}

function updateAllRowArrows() {
    document.querySelectorAll('.category-row').forEach(updateRowArrows);
}

function buildArticleCard(article) {
    const articleDiv = document.createElement('div');
    articleDiv.classList.add('article-item');

    const fecha = article.fecha_publicacion ? new Date(article.fecha_publicacion).toLocaleDateString() : '';

    // Fondo gris neutro si el artículo no tiene ninguna imagen
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='250'%3E%3Crect width='100%25' height='100%25' fill='%23e5e5e5'/%3E%3C/svg%3E";
    let imgUrl = article.image_url && !article.image_url.endsWith('imagenes/imagen2.jpg') ? article.image_url : placeholder;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content || '';
    const firstImg = tempDiv.querySelector('img');

    // La portada elegida tiene prioridad; los artículos antiguos (sin portada propia) usan su primera imagen
    const hasOwnCover = article.image_url && !article.image_url.endsWith('imagenes/imagen2.jpg');
    if (firstImg && !hasOwnCover) {
        imgUrl = firstImg.getAttribute('src');
    }

    if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:') && !imgUrl.startsWith('../') && !imgUrl.startsWith('/')) {
        const fileName = imgUrl.split('/').pop();
        imgUrl = '../imagenes/' + fileName;
    }

    const rawContent = (tempDiv.textContent || tempDiv.innerText || '').trim();
    const excerpt = rawContent.length > 120 ? rawContent.substring(0, 120) + '...' : rawContent;

    articleDiv.innerHTML = `
        <div class="article-card-container">
            <a href="article.html?id=${article.id}" class="article-thumb-link" tabindex="-1" aria-hidden="true">
                <img src="${escapeHtml(imgUrl)}" alt="" class="article-thumbnail" loading="lazy">
            </a>
            <div class="article-card-content">
                <span class="article-category">${escapeHtml(article.category || 'General')}</span>
                <h3>
                    <a href="article.html?id=${article.id}" class="article-title-link">${escapeHtml(article.title)}</a>
                </h3>
                <small class="article-date">Publicado: ${fecha}</small>
                <p class="article-excerpt">${escapeHtml(excerpt)}</p>
                <div class="article-card-actions">
                    <a href="article.html?id=${article.id}" class="read-more-btn">Leer más &rarr;</a>
                </div>
            </div>
        </div>
    `;

    if (window.wnPins) {
        articleDiv.querySelector('.article-card-actions').appendChild(wnPins.button(article.id));
    }
    return articleDiv;
}

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
    }
}

// Función para cerrar sesión desde el menú
async function cerrarSesion(event) {
    event.preventDefault();
    localStorage.removeItem('usuarioActivo');
    localStorage.removeItem('usuarioId');
    localStorage.removeItem('wnSessionToken');
    localStorage.removeItem('wnIsAdmin');
    await wnAlert('Has cerrado sesión correctamente.', { title: 'Sesión cerrada' });
    window.location.href = '../pages/index.html';
}
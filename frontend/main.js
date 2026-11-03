document.addEventListener('DOMContentLoaded', async () => {
    const articlesContainer = document.getElementById('articles-container');
    
    if (!articlesContainer) return;

    try {
        const response = await fetch('http://localhost:3000/api/articles');
        if (!response.ok) throw new Error('Error al conectar con el servidor');

        const articles = await response.json();
        articlesContainer.innerHTML = '';

        if (articles.length === 0) {
            articlesContainer.innerHTML = '<p style="text-align: center; color: #888;">No hay noticias publicadas todavía.</p>';
            return;
        }

        articles.forEach(article => {
            const articleDiv = document.createElement('div');
            articleDiv.classList.add('article-item');

            const fecha = article.fecha_publicacion ? new Date(article.fecha_publicacion).toLocaleDateString() : '';

            // Intentar extraer la primera imagen del contenido HTML si existe, o usar la imagen por defecto
            let imgUrl = article.image_url || '../imagenes/imagen2.jpg';
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = article.content || '';
            const firstImg = tempDiv.querySelector('img');
            
            if (firstImg) {
                imgUrl = firstImg.getAttribute('src');
            }

            // Corrección de ruta si es local
            if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:') && !imgUrl.startsWith('../')) {
                const fileName = imgUrl.split('/').pop();
                imgUrl = '../imagenes/' + fileName;
            }

            // Limpiar etiquetas HTML para el texto de resumen
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
                        <a href="article.html?id=${article.id}" class="read-more-btn">Leer más &rarr;</a>
                    </div>
                </div>
                <hr>
            `;

            articlesContainer.appendChild(articleDiv);
        });

    } catch (error) {
        console.error('Error al cargar los artículos:', error);
        articlesContainer.innerHTML = '<p style="text-align: center; color: red;">No se pudieron cargar las noticias del servidor.</p>';
    }
});
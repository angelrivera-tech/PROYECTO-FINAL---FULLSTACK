// article-detail.js - Carga un artículo específico por su ID desde la base de datos

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('single-article-container');
    
    // Extraer el ID de la URL (ej: article.html?id=3 -> id = 3)
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) {
        container.innerHTML = '<p style="color: red; text-align: center;">Artículo no encontrado.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}`);
        if (!response.ok) throw new Error('No se pudo obtener el artículo');

        const article = await response.json();
        const fecha = article.fecha_publicacion ? new Date(article.fecha_publicacion).toLocaleDateString() : '';

        // Procesar el contenido HTML de forma segura para ajustar las rutas de las imágenes
        let fixedContent = article.content || '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = fixedContent;
        
        const images = tempDiv.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('../') && !src.startsWith('/')) {
                if (src.includes('imagenes/')) {
                    img.setAttribute('src', '../' + src.replace(/^\/+/, ''));
                } else {
                    // Si pusiste solo el nombre de la foto (ej: "foto.jpg"), la redirige a la carpeta superior
                    const fileName = src.split('/').pop();
                    img.setAttribute('src', '../imagenes/' + fileName);
                }
            }
        });
        
        fixedContent = tempDiv.innerHTML;

        // Mostrar la portada elegida si no aparece ya dentro del contenido
        let coverHtml = '';
        const cover = article.image_url;
        const isLegacyDefault = cover && cover.endsWith('imagenes/imagen2.jpg');
        const coverInContent = cover && Array.from(tempDiv.querySelectorAll('img')).some(img => (img.getAttribute('src') || '').endsWith(cover.replace(/^(\.\.\/)+/, '')));
        if (cover && !isLegacyDefault && !coverInContent) {
            const safeCover = cover.replace(/"/g, '&quot;');
            coverHtml = `<img src="${safeCover}" alt="Portada" class="article-cover" style="display:block; width:100%; max-height:420px; object-fit:cover; border-radius:8px; margin-bottom:20px;">`;
        }

        container.innerHTML = `
            <span style="background: #eee; padding: 5px 10px; font-size: 0.9rem; border-radius: 4px;">${article.category || 'General'}</span>
            <small style="color: #666; display: block; margin: 15px 0 10px 0;">Publicado el: ${fecha}</small>
            <hr style="margin-bottom: 20px;">
            ${coverHtml}
            <div class="article-body">
                ${fixedContent}
            </div>
            <div id="article-actions" style="margin-top: 40px; display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
                <a href="index.html" style="text-decoration: none; background: #333; color: white; padding: 10px 20px; border-radius: 5px;">&larr; Volver al inicio</a>
            </div>
        `;

        if (window.wnPins) {
            await wnPins.load();
            document.getElementById('article-actions').appendChild(wnPins.button(article.id));
        }

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="color: red; text-align: center;">Hubo un error al cargar la noticia.</p>';
    }
});
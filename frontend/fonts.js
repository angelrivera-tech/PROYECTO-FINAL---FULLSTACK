// fonts.js - Lista compartida de fuentes para los editores de artículos y la página del artículo
(function () {
    // Fuentes web (Google Fonts) + fuentes del sistema
    const FONTS = [
        { group: 'Serif' },
        { label: 'Georgia', value: 'Georgia, serif' },
        { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
        { label: 'Merriweather', value: "'Merriweather', Georgia, serif", web: 'Merriweather:ital,wght@0,400;0,700;1,400' },
        { label: 'Playfair Display', value: "'Playfair Display', Georgia, serif", web: 'Playfair+Display:ital,wght@0,400;0,700;1,400' },
        { label: 'Lora', value: "'Lora', Georgia, serif", web: 'Lora:ital,wght@0,400;0,700;1,400' },
        { group: 'Sans-serif' },
        { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
        { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
        { label: 'Roboto', value: "'Roboto', Arial, sans-serif", web: 'Roboto:ital,wght@0,400;0,700;1,400' },
        { label: 'Open Sans', value: "'Open Sans', Arial, sans-serif", web: 'Open+Sans:ital,wght@0,400;0,700;1,400' },
        { label: 'Montserrat', value: "'Montserrat', Arial, sans-serif", web: 'Montserrat:ital,wght@0,400;0,700;1,400' },
        { group: 'Display' },
        { label: 'Oswald', value: "'Oswald', Impact, sans-serif", web: 'Oswald:wght@400;700' },
        { label: 'Bebas Neue', value: "'Bebas Neue', Impact, sans-serif", web: 'Bebas+Neue' },
        { label: 'Caveat (handwriting)', value: "'Caveat', cursive", web: 'Caveat:wght@400;700' },
        { group: 'Monospace' },
        { label: 'Courier New', value: "'Courier New', Courier, monospace" },
        { label: 'Roboto Mono', value: "'Roboto Mono', 'Courier New', monospace", web: 'Roboto+Mono:wght@400;700' },
    ];

    // Cargar las fuentes web una sola vez
    function loadWebFonts() {
        if (document.getElementById('wn-web-fonts')) return;
        const families = FONTS.filter(f => f.web).map(f => 'family=' + f.web).join('&');
        const link = document.createElement('link');
        link.id = 'wn-web-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?' + families + '&display=swap';
        document.head.appendChild(link);
    }

    // Rellenar un <select> con las fuentes (cada opción se muestra con su propia fuente)
    function fillSelect(select) {
        if (!select) return;
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Font';
        select.appendChild(placeholder);

        let parent = select;
        FONTS.forEach(font => {
            if (font.group) {
                parent = document.createElement('optgroup');
                parent.label = font.group;
                select.appendChild(parent);
                return;
            }
            const option = document.createElement('option');
            option.value = font.value;
            option.textContent = font.label;
            option.style.fontFamily = font.value;
            parent.appendChild(option);
        });
    }

    loadWebFonts();
    window.wnFonts = { list: FONTS, fillSelect, loadWebFonts };
})();

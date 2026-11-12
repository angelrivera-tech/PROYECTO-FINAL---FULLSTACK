// admin-nav.js - Muestra el botón "Admin Panel" en el menú lateral solo a la cuenta de administrador.
// (El servidor vuelve a comprobar el permiso en cada acción del panel.)
(function () {
    const ADMIN_USERNAMES = ['Angel'];

    function addStyles() {
        if (document.getElementById('admin-nav-style')) return;
        const style = document.createElement('style');
        style.id = 'admin-nav-style';
        style.textContent = `
            .sidebar-content a.admin-panel-link { color: #f0ad4e; font-weight: bold; }
            .sidebar-content a.admin-panel-link:hover { background-color: #f0ad4e; color: #111111; }`;
        document.head.appendChild(style);
    }

    function addAdminLink() {
        const username = localStorage.getItem('usuarioActivo');
        if (!username || !ADMIN_USERNAMES.includes(username)) return;
        const menu = document.querySelector('#accountSidebar .sidebar-content');
        if (!menu || menu.querySelector('.admin-panel-link')) return;

        addStyles();
        const link = document.createElement('a');
        link.href = '../pages/admin panel.html';
        link.className = 'admin-link admin-panel-link';
        link.textContent = 'Admin Panel 🛡️';

        const manage = menu.querySelector('.admin-link');
        if (manage) manage.insertAdjacentElement('afterend', link);
        else menu.prepend(link);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addAdminLink);
    else addAdminLink();
})();

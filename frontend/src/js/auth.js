// Autenticación con JWT en el navegador.
// Después de iniciar sesión, el servidor entrega un JWT que se guarda en localStorage ("wnSessionToken").
// Este archivo añade ese token a todas las peticiones al API (/api/...) con la cabecera
// "Authorization: Bearer <token>". El servidor usa el token para saber quién es el usuario
// y rechaza con 401 las rutas protegidas si falta o ha expirado.
(function () {
    const TOKEN_KEY = 'wnSessionToken';
    const SESSION_KEYS = ['usuarioActivo', 'usuarioId', TOKEN_KEY, 'wnIsAdmin'];
    // Rutas que no deben cerrar la sesión al recibir 401 (login, o páginas que muestran su propio aviso)
    const NO_LOGOUT = ['/api/login', '/api/verify-2fa', '/api/register', '/api/admin/'];

    const originalFetch = window.fetch.bind(window);
    let redirecting = false;

    function apiPath(input) {
        try {
            const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
            return url.origin === location.origin && url.pathname.startsWith('/api/') ? url.pathname : null;
        } catch {
            return null;
        }
    }

    async function sessionExpired() {
        if (redirecting) return;
        redirecting = true;
        SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
        const message = 'Tu sesión ha expirado. Inicia sesión de nuevo.';
        if (window.wnAlert) await window.wnAlert(message, { title: 'Sesión expirada' });
        else alert(message);
        window.location.href = '../pages/log%20in.html';
    }

    window.fetch = async function (input, init = {}) {
        const path = apiPath(input);
        const token = localStorage.getItem(TOKEN_KEY);
        if (!path) return originalFetch(input, init);

        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
        const response = await originalFetch(input, { ...init, headers });

        const loggedIn = Boolean(localStorage.getItem('usuarioId') || token);
        if (response.status === 401 && loggedIn && !NO_LOGOUT.some((p) => path.startsWith(p))) {
            sessionExpired();
        }
        return response;
    };

    window.wnAuth = {
        token: () => localStorage.getItem(TOKEN_KEY),
        isLoggedIn: () => Boolean(localStorage.getItem(TOKEN_KEY)),
    };
})();

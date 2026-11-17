// account-recovery.js - "¿Olvidaste tu contraseña o usuario?" y enlaces enviados por correo
// Sin ?token= muestra el formulario de recuperación; con ?token= muestra el formulario que corresponda al enlace.

(function () {
    const token = new URLSearchParams(window.location.search).get('token');
    const title = document.getElementById('recoveryTitle');
    const panels = ['forgotForm', 'loadingPanel', 'passwordForm', 'emailForm', 'confirmForm', 'resultPanel']
        .map((id) => document.getElementById(id));

    function show(id) {
        panels.forEach((panel) => { panel.hidden = panel.id !== id; });
    }

    function showResult(message, { error = false, linkText = 'Ir a log in', linkHref = '../pages/log in.html' } = {}) {
        const msg = document.getElementById('resultMessage');
        msg.textContent = message;
        msg.classList.toggle('error', error);
        const link = document.getElementById('resultLink');
        link.textContent = linkText;
        link.href = linkHref;
        show('resultPanel');
    }

    async function post(path, body) {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, data };
    }

    // Envía un formulario con el botón desactivado mientras espera
    function handleSubmit(form, action) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            try {
                await action();
            } catch (error) {
                console.error('Error:', error);
                await wnAlert('No se pudo conectar con el servidor.', { title: 'Error de conexión', danger: true });
            } finally {
                button.disabled = false;
            }
        });
    }

    // ---------- Sin enlace: ¿Olvidaste tu contraseña o usuario? ----------
    handleSubmit(document.getElementById('forgotForm'), async () => {
        const email = document.getElementById('forgotEmail').value.trim();
        if (!email) return;
        const { ok, data } = await post('/api/account/forgot', { email });
        if (!ok) {
            await wnAlert(data.error || 'No se pudo enviar el correo.', { title: 'Algo salió mal', danger: true });
            return;
        }
        showResult(data.message + ' Revisa también la carpeta de spam.', { linkText: 'Volver a log in' });
    });

    // ---------- Nueva contraseña ----------
    handleSubmit(document.getElementById('passwordForm'), async () => {
        const password = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        if (password.length < 6) {
            await wnAlert('La contraseña debe tener al menos 6 caracteres.', { title: 'Contraseña muy corta' });
            return;
        }
        if (password !== confirm) {
            await wnAlert('Las contraseñas no coinciden.', { title: 'Revisa la contraseña' });
            return;
        }
        const { ok, data } = await post('/api/account/reset-password', { token, password });
        if (!ok) {
            showResult(data.error || 'No se pudo cambiar la contraseña.', { error: true });
            return;
        }
        showResult(data.message);
    });

    // ---------- Nuevo correo ----------
    handleSubmit(document.getElementById('emailForm'), async () => {
        const email = document.getElementById('newEmail').value.trim();
        if (!email) return;
        const { ok, data } = await post('/api/account/change-email', { token, email });
        if (!ok) {
            await wnAlert(data.error || 'No se pudo cambiar el correo.', { title: 'Algo salió mal', danger: true });
            return;
        }
        showResult(data.message + ' Revisa también la carpeta de spam.', {
            linkText: 'Volver a Profile Settings',
            linkHref: '../pages/profile settings.html',
        });
    });

    // ---------- Confirmar nuevo correo ----------
    handleSubmit(document.getElementById('confirmForm'), async () => {
        const { ok, data } = await post('/api/account/confirm-email', { token });
        if (!ok) {
            showResult(data.error || 'No se pudo confirmar el correo.', { error: true });
            return;
        }
        const loggedIn = Boolean(localStorage.getItem('usuarioId'));
        showResult(data.message, loggedIn
            ? { linkText: 'Ir a Profile Settings', linkHref: '../pages/profile settings.html' }
            : {});
    });

    async function init() {
        if (!token) {
            title.textContent = 'Recuperar cuenta';
            show('forgotForm');
            return;
        }

        show('loadingPanel');
        try {
            const response = await fetch(`/api/account/token?token=${encodeURIComponent(token)}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                title.textContent = 'Enlace no válido';
                showResult(data.error || 'El enlace no es válido o ya expiró.', {
                    error: true,
                    linkText: 'Solicitar un nuevo enlace',
                    linkHref: '../pages/account recovery.html',
                });
                return;
            }

            document.querySelectorAll('.js-username').forEach((el) => { el.textContent = data.username; });
            if (data.type === 'password_reset') {
                title.textContent = 'Cambiar contraseña';
                show('passwordForm');
            } else if (data.type === 'email_change') {
                title.textContent = 'Cambiar correo';
                document.getElementById('currentEmail').textContent = data.email;
                show('emailForm');
            } else if (data.type === 'email_confirm') {
                title.textContent = 'Confirmar correo';
                document.getElementById('pendingEmail').textContent = data.new_email;
                show('confirmForm');
            }
        } catch (error) {
            console.error('Error al comprobar el enlace:', error);
            showResult('No se pudo conectar con el servidor.', { error: true });
        }
    }

    init();
})();

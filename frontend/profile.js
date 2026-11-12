// profile.js - Página "Profile Settings": muestra los datos del usuario y su foto de perfil

(function () {
    const usuarioId = Number(localStorage.getItem('usuarioId')) || null;
    const statusMsg = document.getElementById('profileStatus');
    const content = document.getElementById('profileContent');
    const loggedOut = document.getElementById('profileLoggedOut');
    const avatarImg = document.getElementById('avatarImage');
    const avatarInitial = document.getElementById('avatarInitial');
    const fileInput = document.getElementById('avatarInput');
    const changeBtn = document.getElementById('changeAvatarBtn');
    const removeBtn = document.getElementById('removeAvatarBtn');

    const MAX_BYTES = 2 * 1024 * 1024;
    const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    function setAvatar(url) {
        if (url) {
            avatarImg.src = url;
            avatarImg.hidden = false;
            avatarInitial.hidden = true;
            changeBtn.textContent = 'Change photo 📷';
            removeBtn.hidden = false;
        } else {
            avatarImg.removeAttribute('src');
            avatarImg.hidden = true;
            avatarInitial.hidden = false;
            changeBtn.textContent = 'Add photo 📷';
            removeBtn.hidden = true;
        }
    }

    function setBusy(busy) {
        changeBtn.disabled = busy;
        removeBtn.disabled = busy;
    }

    async function load() {
        if (!usuarioId) {
            statusMsg.style.display = 'none';
            loggedOut.hidden = false;
            return;
        }
        try {
            const response = await fetch(`/api/profile?usuario_id=${encodeURIComponent(usuarioId)}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Error al cargar el perfil');

            document.getElementById('infoUsername').textContent = data.username;
            document.getElementById('infoEmail').textContent = data.email_masked;
            document.getElementById('statPublished').textContent = data.published_count;
            document.getElementById('statSaved').textContent = data.saved_count;
            avatarInitial.textContent = (data.username || '?').charAt(0);
            setAvatar(data.avatar_url);

            statusMsg.style.display = 'none';
            content.hidden = false;
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            statusMsg.textContent = 'Your profile could not be loaded.';
        }
    }

    changeBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;

        if (!TYPES.includes(file.type)) {
            await wnAlert('Please choose a JPG, PNG, WEBP or GIF image.', { title: 'Invalid file', danger: true });
            return;
        }
        if (file.size > MAX_BYTES) {
            await wnAlert('The image is too large. The maximum size is 2 MB.', { title: 'Image too large', danger: true });
            return;
        }

        setBusy(true);
        try {
            const response = await fetch(`/api/profile/avatar?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'The photo could not be uploaded.', { title: 'Something went wrong', danger: true });
                return;
            }
            setAvatar(result.avatar_url);
            wnToast('Profile picture updated');
        } catch (error) {
            console.error('Error al subir la foto:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
        } finally {
            setBusy(false);
        }
    });

    removeBtn.addEventListener('click', async () => {
        const ok = await wnConfirm('Remove your profile picture?', {
            title: 'Remove photo',
            okText: 'Remove',
            danger: true,
        });
        if (!ok) return;

        setBusy(true);
        try {
            const response = await fetch(`/api/profile/avatar?usuario_id=${encodeURIComponent(usuarioId)}`, { method: 'DELETE' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'The photo could not be removed.', { title: 'Something went wrong', danger: true });
                return;
            }
            setAvatar(null);
            wnToast('Profile picture removed');
        } catch (error) {
            console.error('Error al quitar la foto:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
        } finally {
            setBusy(false);
        }
    });

    // Cambio de correo o contraseña: se envía un enlace seguro al correo de la cuenta
    async function requestChange(type, button) {
        const what = type === 'email' ? 'email address' : 'password';
        const ok = await wnConfirm(
            `We'll send a secure link to your current email address. Open it to change your ${what}. The link expires in 30 minutes.`,
            { title: type === 'email' ? 'Change email' : 'Change password', okText: 'Send link' }
        );
        if (!ok) return;

        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Sending...';
        try {
            const response = await fetch('/api/account/request-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: usuarioId, type }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'The email could not be sent.', { title: 'Something went wrong', danger: true });
                return;
            }
            await wnAlert(result.message || 'Check your email for the link.', { title: 'Check your email 📧' });
        } catch (error) {
            console.error('Error al solicitar el cambio:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    const emailBtn = document.getElementById('changeEmailBtn');
    const passwordBtn = document.getElementById('changePasswordBtn');
    emailBtn.addEventListener('click', () => requestChange('email', emailBtn));
    passwordBtn.addEventListener('click', () => requestChange('password', passwordBtn));

    // Eliminar la cuenta: los artículos publicados se conservan en el sitio
    const deleteBtn = document.getElementById('deleteAccountBtn');
    deleteBtn.addEventListener('click', async () => {
        const ok = await wnConfirm(
            'Your account, profile picture and saved articles will be permanently deleted. The articles you published will stay on Worldnews. This cannot be undone.',
            { title: 'Delete account', okText: 'Continue', danger: true }
        );
        if (!ok) return;

        const password = await wnPrompt('Enter your password to confirm.', {
            title: 'Confirm deletion',
            okText: 'Delete account',
            placeholder: 'Password',
            inputType: 'password',
            danger: true,
        });
        if (!password) return;

        deleteBtn.disabled = true;
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = 'Deleting...';
        try {
            const response = await fetch(`/api/profile?usuario_id=${encodeURIComponent(usuarioId)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                await wnAlert(result.error || 'Your account could not be deleted.', { title: 'Something went wrong', danger: true });
                return;
            }
            localStorage.removeItem('usuarioActivo');
            localStorage.removeItem('usuarioId');
            await wnAlert('Your account has been deleted. The articles you published are still available.', { title: 'Account deleted' });
            window.location.href = '../pages/index.html';
        } catch (error) {
            console.error('Error al eliminar la cuenta:', error);
            await wnAlert('Could not connect to the server.', { title: 'Connection error', danger: true });
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
        }
    });

    load();
})();

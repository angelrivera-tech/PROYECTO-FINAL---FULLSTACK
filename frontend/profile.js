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
            document.getElementById('infoEmail').textContent = data.email;
            document.getElementById('infoId').textContent = '#' + data.id;
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

    load();
})();

// dialogs.js - Ventanas emergentes con el estilo de Worldnews.
// Sustituyen a alert(), confirm() y prompt() del navegador.
//   await wnAlert('Mensaje');
//   if (await wnConfirm('¿Seguro?', { danger: true })) { ... }
//   const url = await wnPrompt('Ingresa la URL:');  // null si se cancela

(function () {
    if (window.wnDialog) return;

    const css = `
    .wn-dialog-backdrop {
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(3px);
        display: flex; justify-content: center; align-items: center;
        z-index: 20000;
        opacity: 0; transition: opacity 0.18s ease;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .wn-dialog-backdrop.open { opacity: 1; }
    .wn-dialog {
        background: #1b1b1b; color: #ffffff;
        width: 90%; max-width: 420px; box-sizing: border-box;
        border-radius: 10px; overflow: hidden;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.55);
        text-align: center;
        transform: translateY(12px) scale(0.98); transition: transform 0.18s ease;
    }
    .wn-dialog-backdrop.open .wn-dialog { transform: none; }
    .wn-dialog-head {
        background: #111111; padding: 14px 20px;
        border-bottom: 3px solid #0275d8;
        font-size: 1.1rem; font-weight: 700; letter-spacing: 1px;
    }
    .wn-dialog.danger .wn-dialog-head { border-bottom-color: #d9534f; }
    .wn-dialog-head small {
        display: block; font-size: 0.7rem; font-weight: 600;
        color: #888888; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px;
    }
    .wn-dialog-body { padding: 22px 24px 8px 24px; }
    .wn-dialog-body p {
        margin: 0; color: #cccccc; font-size: 1rem; line-height: 1.5;
        white-space: pre-line; word-wrap: break-word;
    }
    .wn-dialog-input {
        width: 100%; box-sizing: border-box; margin-top: 16px;
        padding: 10px 12px; border-radius: 6px;
        border: 1px solid #333333; background: #111111; color: #ffffff;
        font-size: 0.95rem; outline: none;
    }
    .wn-dialog-input:focus { border-color: #0275d8; box-shadow: 0 0 0 3px rgba(2, 117, 216, 0.3); }
    .wn-dialog-actions {
        display: flex; justify-content: center; gap: 12px;
        padding: 20px 24px 22px 24px;
    }
    .wn-dialog-btn {
        border: none; padding: 9px 20px; border-radius: 6px;
        cursor: pointer; font-weight: 600; font-size: 0.95rem;
        transition: background-color 0.2s, transform 0.2s;
    }
    .wn-dialog-btn:hover { transform: translateY(-1px); }
    .wn-dialog-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
    .wn-dialog-ok { background: #0275d8; color: #ffffff; }
    .wn-dialog-ok:hover { background: #025aa5; }
    .wn-dialog.danger .wn-dialog-ok { background: #d9534f; }
    .wn-dialog.danger .wn-dialog-ok:hover { background: #c9302c; }
    .wn-dialog-cancel { background: #333333; color: #dddddd; }
    .wn-dialog-cancel:hover { background: #444444; color: #ffffff; }

    .wn-toast {
        position: fixed; left: 50%; bottom: 28px;
        transform: translate(-50%, 20px); opacity: 0;
        background: #1b1b1b; color: #ffffff;
        border-left: 4px solid #0275d8; border-radius: 6px;
        padding: 12px 20px; font-weight: 600; font-size: 0.95rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
        z-index: 20001; transition: all 0.25s ease; pointer-events: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .wn-toast.show { transform: translate(-50%, 0); opacity: 1; }
    .wn-toast.error { border-left-color: #d9534f; }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Cola para que nunca se abran dos ventanas a la vez
    let queue = Promise.resolve();

    function open(kind, message, options = {}) {
        const run = () => new Promise(resolve => {
            const previousFocus = document.activeElement;
            const backdrop = document.createElement('div');
            backdrop.className = 'wn-dialog-backdrop';

            const dialog = document.createElement('div');
            dialog.className = 'wn-dialog' + (options.danger ? ' danger' : '');
            dialog.setAttribute('role', kind === 'alert' ? 'alertdialog' : 'dialog');
            dialog.setAttribute('aria-modal', 'true');

            const head = document.createElement('div');
            head.className = 'wn-dialog-head';
            const brand = document.createElement('small');
            brand.textContent = 'Worldnews';
            head.appendChild(brand);
            head.appendChild(document.createTextNode(options.title ||
                (kind === 'confirm' ? 'Please confirm' : kind === 'prompt' ? 'Enter a value' : 'Notice')));

            const body = document.createElement('div');
            body.className = 'wn-dialog-body';
            const text = document.createElement('p');
            text.textContent = message == null ? '' : String(message);
            body.appendChild(text);

            let input = null;
            if (kind === 'prompt') {
                input = document.createElement('input');
                input.type = options.inputType || 'text';
                input.className = 'wn-dialog-input';
                input.placeholder = options.placeholder || '';
                input.value = options.defaultValue || '';
                body.appendChild(input);
            }

            const actions = document.createElement('div');
            actions.className = 'wn-dialog-actions';
            let cancelBtn = null;
            if (kind !== 'alert') {
                cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'wn-dialog-btn wn-dialog-cancel';
                cancelBtn.textContent = options.cancelText || 'Cancel';
                actions.appendChild(cancelBtn);
            }
            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'wn-dialog-btn wn-dialog-ok';
            okBtn.textContent = options.okText || 'OK';
            actions.appendChild(okBtn);

            dialog.append(head, body, actions);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);
            requestAnimationFrame(() => backdrop.classList.add('open'));
            (input || okBtn).focus();

            function close(result) {
                document.removeEventListener('keydown', onKey, true);
                backdrop.classList.remove('open');
                setTimeout(() => backdrop.remove(), 180);
                if (previousFocus && previousFocus.focus) previousFocus.focus();
                resolve(result);
            }
            const cancelValue = kind === 'confirm' ? false : kind === 'prompt' ? null : undefined;

            function onKey(event) {
                if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation();
                    close(cancelValue);
                } else if (event.key === 'Enter' && (event.target === input || event.target === okBtn || !dialog.contains(event.target))) {
                    event.preventDefault(); event.stopPropagation();
                    okBtn.click();
                } else if (event.key === 'Tab') {
                    // Mantener el foco dentro de la ventana
                    const focusables = [input, cancelBtn, okBtn].filter(Boolean);
                    const index = focusables.indexOf(document.activeElement);
                    event.preventDefault();
                    const next = (index + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
                    focusables[next].focus();
                }
            }
            document.addEventListener('keydown', onKey, true);

            okBtn.addEventListener('click', () => {
                if (kind === 'confirm') close(true);
                else if (kind === 'prompt') close(input.value);
                else close(undefined);
            });
            if (cancelBtn) cancelBtn.addEventListener('click', () => close(cancelValue));
            backdrop.addEventListener('click', event => {
                if (event.target === backdrop) close(cancelValue);
            });
        });

        const result = queue.then(run);
        queue = result.catch(() => {});
        return result;
    }

    let toastTimer = null;
    function toast(message, options = {}) {
        let el = document.querySelector('.wn-toast');
        if (!el) {
            el = document.createElement('div');
            el.className = 'wn-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.toggle('error', !!options.error);
        requestAnimationFrame(() => el.classList.add('show'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), options.duration || 2400);
    }

    window.wnDialog = {
        alert: (message, options) => open('alert', message, options),
        confirm: (message, options) => open('confirm', message, options),
        prompt: (message, options) => open('prompt', message, options),
        toast,
    };
    window.wnAlert = window.wnDialog.alert;
    window.wnConfirm = window.wnDialog.confirm;
    window.wnPrompt = window.wnDialog.prompt;
    window.wnToast = toast;
})();

// =========================================================================
// SGC - SISTEMA DE NOTIFICACIONES (TOASTS Y MODALES)
// =========================================================================

/**
 * Muestra una notificación flotante (Toast).
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - 'info', 'success', 'warning', 'error' (por defecto 'info').
 */
export function showAlert(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Contenedor de Toasts no encontrado. Habilitando alert nativo.');
        alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Íconos SVG según el tipo
    let svgIcon = '';
    switch (type) {
        case 'success':
            svgIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            break;
        case 'error':
            svgIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            break;
        case 'warning':
            svgIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            break;
        default:
            svgIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    // Inferir error basado en texto
    if (type === 'info' && message.toLowerCase().includes('error')) {
        toast.className = `toast toast-error`;
        svgIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    }

    toast.innerHTML = `
        <div class="toast-icon">${svgIcon}</div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    container.appendChild(toast);

    // Activar animación
    setTimeout(() => {
        toast.classList.add('toast-show');
    }, 10);

    // Auto-eliminar
    const duration = type === 'error' ? 5000 : 3000;
    const timeout = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Botón de cierre
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timeout);
        removeToast(toast);
    });
}

function removeToast(toast) {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

/**
 * Muestra un modal de confirmación y retorna una promesa.
 * @param {string} message - Pregunta o advertencia.
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm-global');
        const msgEl = document.getElementById('modal-confirm-message');
        const btnCancel = document.getElementById('btn-cancel-confirm');
        const btnAccept = document.getElementById('btn-accept-confirm');

        if (!modal) {
            console.warn('Modal de confirmación no encontrado. Habilitando confirm nativo.');
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message;
        modal.classList.remove('hidden');

        // Limpiar event listeners previos
        const newCancel = btnCancel.cloneNode(true);
        const newAccept = btnAccept.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        btnAccept.parentNode.replaceChild(newAccept, btnAccept);

        newCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            resolve(false);
        });

        newAccept.addEventListener('click', () => {
            modal.classList.add('hidden');
            resolve(true);
        });
    });
}

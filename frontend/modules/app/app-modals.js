// =========================================================================
// SGC - MÓDULO DE CONTROLES DE INTERFAZ Y MODALES
// Control de visibilidad de contraseñas, barra lateral, off-canvas móvil y ventanas modales.
// =========================================================================

import {
    populatePersonaModalSelects,
    populateFamiliaModalSelects,
    populateViviendaModalSelects
} from "../../ui.js";

export function setupPasswordToggles() {
    document.querySelectorAll(".btn-toggle-password").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            if (!input) return;

            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            btn.classList.toggle("active", isPassword);

            if (isPassword) {
                btn.innerHTML = `<svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            } else {
                btn.innerHTML = `<svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            }
        });
    });
}

export function setupSidebarControls() {
    const sidebar = document.getElementById("app-sidebar");
    const toggleBtn = document.getElementById("btn-toggle-sidebar");
    const mobileBtn = document.getElementById("btn-mobile-menu");
    const overlay = document.getElementById("sidebar-overlay");

    // Colapsar panel lateral en escritorio
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            localStorage.setItem("sidebar-collapsed", sidebar.classList.contains("collapsed") ? "true" : "false");
        });

        if (localStorage.getItem("sidebar-collapsed") === "true") {
            sidebar.classList.add("collapsed");
        }
    }

    // Abrir/cerrar menú móvil off-canvas
    const closeMobileSidebar = () => {
        if (sidebar) sidebar.classList.remove("mobile-open");
        if (overlay) overlay.classList.remove("active");
    };

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
            if (overlay) overlay.classList.toggle("active", sidebar.classList.contains("mobile-open"));
        });
    }

    if (overlay) {
        overlay.addEventListener("click", closeMobileSidebar);
    }

    // Exponer la función de cierre para navegación
    window.closeMobileSidebar = closeMobileSidebar;
}

export function setupAuthSwitchControls() {
    const btnToRegister = document.getElementById("btn-switch-to-register");
    const btnToLogin = document.getElementById("btn-switch-to-login");
    const regOverlay = document.getElementById("auth-register-overlay");
    const loginOverlay = document.getElementById("auth-login-overlay");

    if (btnToRegister) {
        btnToRegister.addEventListener("click", () => {
            loginOverlay.classList.add("hidden");
            regOverlay.classList.remove("hidden");
        });
    }

    if (btnToLogin) {
        btnToLogin.addEventListener("click", () => {
            regOverlay.classList.add("hidden");
            loginOverlay.classList.remove("hidden");
        });
    }
}

export function setupGlobalControls() {
    setupPasswordToggles();
    setupSidebarControls();
    setupAuthSwitchControls();
}

// Helper de apertura, cierre y cancelación para ventanas modales
export function setupModalControl(openBtnId, closeBtnId, cancelBtnId, modalId) {
    const openBtn = document.getElementById(openBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const cancelBtn = document.getElementById(cancelBtnId);
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (openBtn) {
        openBtn.addEventListener("click", () => {
            if (modalId === "modal-persona") {
                document.getElementById("persona-modal-title").textContent = "Registrar Nueva Persona";
                document.getElementById("persona-id").value = "";
                document.getElementById("form-persona").reset();
                populatePersonaModalSelects();
            }
            if (modalId === "modal-familia") populateFamiliaModalSelects();
            if (modalId === "modal-vivienda") populateViviendaModalSelects();
            modal.classList.remove("hidden");
        });
    }

    const closeModal = () => modal.classList.add("hidden");

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
}


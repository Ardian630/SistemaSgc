// =========================================================================
// SGC - PUNTO DE ENTRADA PRINCIPAL (ORQUESTADOR)
// Coordina la inicialización, autenticación, navegación y módulos del sistema.
// =========================================================================

import {
    initializeAuth,
    getCurrentUser,
    isUserAdmin,
    isPanelAllowedForUser,
    handleRegisterAdminSubmit,
    handleLoginSubmit,
    handleLogoutClick
} from "./auth.js";

import {
    renderDashboard,
    renderPersonasTable,
    renderFamilias,
    renderViviendasTree,
    renderUsuariosTable,
    renderParametros,
    populateSelects,
    populateProfessionsChecklist
} from "./ui.js";

import { supabase } from "./supabase-client.js";

import { initTheme } from "./modules/app/app-theme.js";
import {
    navigateToPanel,
    restoreActivePanel,
    getPanelIdFromHash
} from "./modules/app/app-navigation.js";
import { setupGlobalControls } from "./modules/app/app-modals.js";
import { initCensoWindowActions } from "./modules/app/app-handlers-censo.js";
import { populateRoleSelector } from "./modules/app/app-handlers-admin.js";
import { setupEventListeners } from "./modules/app/app-listeners.js";

// Re-exportar para retrocompatibilidad
export { navigateToPanel };

// =========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =========================================================================

export async function initApp() {
    initTheme();

    const currentUser = getCurrentUser();

    // 1. Restaurar visualmente el panel de inmediato al recargar para evitar parpadeos
    let initialTargetId = getPanelIdFromHash() || localStorage.getItem("activePanelId") || sessionStorage.getItem("activePanelId") || "panel-dashboard";
    if (currentUser && !isPanelAllowedForUser(initialTargetId, currentUser)) {
        initialTargetId = "panel-dashboard";
    }
    navigateToPanel(initialTargetId, { saveStorage: true, updateHash: true, render: false });

    // Diagnóstico RLS: muestra cómo ve la base de datos la sesión actual
    if (supabase) {
        try {
            const { data: diag, error: diagErr } = await supabase.rpc("debug_mi_sesion");
            if (diagErr) console.warn("[RLS Debug] No se pudo ejecutar debug_mi_sesion:", diagErr);
            else console.log("[RLS Debug] Sesión vista por la BD:", diag);
        } catch (e) {
            console.warn("[RLS Debug] Error:", e);
        }
    }

    try { await populateSelects(); } catch (err) { console.warn("[App] Error cargando selectores:", err); }
    try { await populateProfessionsChecklist(); } catch (err) { console.warn("[App] Error cargando profesiones:", err); }
    if (isUserAdmin(currentUser)) {
        try { await populateRoleSelector(); } catch (err) { console.warn("[App] Error cargando selector de roles:", err); }
    }

    try { await renderDashboard(); } catch (err) { console.warn("[App] Error renderizando dashboard:", err); }
    try { await renderPersonasTable(); } catch (err) { console.warn("[App] Error renderizando personas:", err); }
    try { await renderFamilias(); } catch (err) { console.warn("[App] Error renderizando familias:", err); }
    try { await renderViviendasTree(); } catch (err) { console.warn("[App] Error renderizando viviendas:", err); }

    // Renderizado condicional estricto: usuarios y parámetros solo para Administradores
    if (isUserAdmin(currentUser)) {
        try { await renderUsuariosTable(); } catch (err) { console.warn("[App] Error renderizando usuarios:", err); }
        try { await renderParametros(); } catch (err) { console.warn("[App] Error renderizando parámetros:", err); }
    }

    // 2. Garantizar que el panel en el que se quedó el usuario se sincronice y renderice completamente
    restoreActivePanel();
}

document.addEventListener("DOMContentLoaded", async () => {
    // Unificación tipográfica global para Chart.js
    if (typeof window !== "undefined" && window.Chart) {
        Chart.defaults.font.family = "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
    }

    // Inicializar controles globales (toggles de clave, sidebar, menú móvil, alternancia auth)
    setupGlobalControls();

    // Inicializar acciones globales de censo en window (editar/eliminar comunidades, edificios, viviendas)
    initCensoWindowActions();

    // Configurar todos los event listeners de la interfaz inmediatamente
    setupEventListeners();

    // Escuchar eventos de recuperación de contraseña de Supabase
    if (supabase) {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                const overlayReset = document.getElementById("auth-reset-overlay");
                const overlayLogin = document.getElementById("auth-login-overlay");
                const overlayRegister = document.getElementById("auth-register-overlay");
                const appContainer = document.querySelector(".app-container");

                if (overlayReset) overlayReset.classList.remove("hidden");
                if (overlayLogin) overlayLogin.classList.add("hidden");
                if (overlayRegister) overlayRegister.classList.add("hidden");
                if (appContainer) {
                    appContainer.classList.add("hidden");
                    appContainer.style.display = "none";
                }
            }
        });
    }

    // 1. Verificar autenticación (decide si mostrar login, registro o app)
    await initializeAuth();

    const currentUser = getCurrentUser();

    if (currentUser) {
        await initApp();
    }

    // 2. Registrar formularios de autenticación (siempre, para overlays)
    const formRegister = document.getElementById("form-auth-register");
    const formLogin = document.getElementById("form-auth-login");
    const btnLogout = document.getElementById("btn-logout");

    if (formRegister) formRegister.addEventListener("submit", handleRegisterAdminSubmit);
    if (formLogin) formLogin.addEventListener("submit", (e) => handleLoginSubmit(e, initApp));
    if (btnLogout) btnLogout.addEventListener("click", handleLogoutClick);
});

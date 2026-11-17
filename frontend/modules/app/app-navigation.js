// =========================================================================
// SGC - MÓDULO DE NAVEGACIÓN Y ENRUTAMIENTO
// Manejo de paneles, sincronización de Hash URL, persistencia en Storage y permisos.
// =========================================================================

import { showAlert } from "../../notifications.js";
import { getCurrentUser, isUserAdmin, isPanelAllowedForUser } from "../../auth.js";
import {
    renderDashboard,
    renderPersonasTable,
    renderFamilias,
    renderViviendasTree,
    renderUsuariosTable,
    renderCharts,
    renderParametros
} from "../../ui.js";

export const PANEL_HASH_MAP = {
    "panel-dashboard": "dashboard",
    "panel-personas": "personas",
    "panel-familias": "familias",
    "panel-viviendas": "viviendas",
    "panel-usuarios": "usuarios",
    "panel-reportes": "reportes",
    "panel-parametros": "parametros",
    "panel-mi-cuenta": "mi-cuenta"
};

export function getPanelIdFromHash() {
    const rawHash = (window.location.hash || "").replace("#", "").trim().toLowerCase();
    if (!rawHash) return null;

    if (document.getElementById(rawHash)) return rawHash;
    if (document.getElementById("panel-" + rawHash)) return "panel-" + rawHash;

    for (const [panelId, hashName] of Object.entries(PANEL_HASH_MAP)) {
        if (hashName === rawHash) return panelId;
    }
    return null;
}

export function navigateToPanel(panelId, options = {}) {
    const { saveStorage = true, updateHash = true, render = true } = options;
    const targetId = panelId || "panel-dashboard";
    const targetPanel = document.getElementById(targetId);

    if (!targetPanel) {
        console.warn(`[Navigation] Panel ${targetId} no existe, regresando a dashboard.`);
        return navigateToPanel("panel-dashboard", options);
    }

    // Control estricto de roles: Verificar si el panel está permitido para el rol del usuario
    const currentUser = getCurrentUser();
    if (currentUser && !isPanelAllowedForUser(targetId, currentUser)) {
        showAlert("Acceso denegado: Su rol no tiene permisos para acceder a este apartado.", "warning");
        return navigateToPanel("panel-dashboard", { ...options, render: true });
    }

    // Actualizar clases activas en sidebar y paneles
    document.querySelectorAll(".menu-item").forEach(mi => {
        if (mi.getAttribute("data-target") === targetId) mi.classList.add("active");
        else mi.classList.remove("active");
    });

    document.querySelectorAll(".panel").forEach(p => {
        if (p.id === targetId) {
            p.classList.add("active");
            p.querySelectorAll(".table-container").forEach(tc => tc.scrollLeft = 0);
        } else {
            p.classList.remove("active");
        }
    });

    // Persistir en storage para recuperar tras refresh/recarga
    if (saveStorage) {
        localStorage.setItem("activePanelId", targetId);
        sessionStorage.setItem("activePanelId", targetId);
    }

    // Actualizar Hash de la URL de forma limpia
    if (updateHash) {
        const hashName = PANEL_HASH_MAP[targetId] || targetId.replace("panel-", "");
        if (window.location.hash !== "#" + hashName) {
            history.replaceState(null, "", "#" + hashName);
        }
    }

    // Renderizar datos del módulo activo (solo si el rol lo tiene permitido)
    if (render) {
        if (targetId === "panel-dashboard") renderDashboard();
        else if (targetId === "panel-personas") renderPersonasTable();
        else if (targetId === "panel-familias") renderFamilias();
        else if (targetId === "panel-viviendas") renderViviendasTree();
        else if (targetId === "panel-usuarios" && isUserAdmin(currentUser)) renderUsuariosTable();
        else if (targetId === "panel-reportes") renderCharts();
        else if (targetId === "panel-parametros" && isUserAdmin(currentUser)) renderParametros();
        else if (targetId === "panel-mi-cuenta") {
            if (currentUser) {
                const miNombreInput = document.getElementById("mi-nombre");
                const miTelefonoInput = document.getElementById("mi-telefono");
                if (miNombreInput) miNombreInput.value = currentUser.nombre_completo || "";
                if (miTelefonoInput) miTelefonoInput.value = currentUser.telefono || "";
            }
        }
    }

    if (window.closeMobileSidebar) window.closeMobileSidebar();
}

window.navigateToPanel = navigateToPanel;

export function restoreActivePanel() {
    let targetPanelId = getPanelIdFromHash();
    if (!targetPanelId) {
        targetPanelId = localStorage.getItem("activePanelId") || sessionStorage.getItem("activePanelId") || "panel-dashboard";
    }
    const currentUser = getCurrentUser();
    if (currentUser && !isPanelAllowedForUser(targetPanelId, currentUser)) {
        targetPanelId = "panel-dashboard";
    }
    navigateToPanel(targetPanelId, { saveStorage: true, updateHash: true, render: true });
}


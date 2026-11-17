// =========================================================================
// SGC - MÓDULO DE REGISTRO DE EVENT LISTENERS
// Centraliza el enlace de eventos DOM, formularios, filtros y botones de acción.
// =========================================================================

import { navigateToPanel, getPanelIdFromHash } from "./app-navigation.js";
import { setupModalControl } from "./app-modals.js";

import {
    handlePersonaSubmit,
    handleFamiliaSubmit,
    handleEditarFamiliaSubmit,
    handleComunidadSubmit,
    handleEdificioSubmit,
    handleViviendaSubmit,
    handleAsociarPersonaFamilia,
    handleAsociarFamiliaVivienda
} from "./app-handlers-censo.js";

import {
    handleCrearUsuario,
    handleParamProfesionSubmit,
    handleParamDiscapacidadSubmit,
    handleCambioClaveSubmit,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    handleMisDatosSubmit,
    handleEditarRolSubmit
} from "./app-handlers-admin.js";

import {
    setActiveCommunity,
    renderDashboard,
    renderPersonasTable,
    renderFamilias,
    renderViviendasTree,
    renderUsuariosTable,
    renderCharts,
    setReportesSexFilter,
    exportarPersonasExcel,
    exportarReportesPDF,
    exportarPiramidePDF
} from "../../ui.js";

export function setupEventListeners() {
    const addSafeListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Navegación Sidebar
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetId = item.getAttribute("data-target");
            if (targetId) {
                navigateToPanel(targetId);
            }
        });
    });

    // Escuchar cambios de Hash en la URL para soporte de navegación e historial
    window.addEventListener("hashchange", () => {
        const targetPanelId = getPanelIdFromHash();
        if (targetPanelId) {
            const activePanel = document.querySelector(".panel.active");
            if (!activePanel || activePanel.id !== targetPanelId) {
                navigateToPanel(targetPanelId);
            }
        }
    });

    // Filtro de comunidad activa
    addSafeListener("active-community-select", "change", (e) => {
        setActiveCommunity(e.target.value);
        const activePanel = document.querySelector(".panel.active");
        if (!activePanel) return;
        const activePanelId = activePanel.id;
        if (activePanelId === "panel-dashboard") renderDashboard();
        if (activePanelId === "panel-personas") renderPersonasTable();
        if (activePanelId === "panel-familias") renderFamilias();
        if (activePanelId === "panel-viviendas") renderViviendasTree();
        if (activePanelId === "panel-usuarios") renderUsuariosTable();
        if (activePanelId === "panel-reportes") renderCharts();
    });

    // Buscador Global
    addSafeListener("global-search", "input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query) {
            const btnPersonas = document.querySelector("[data-target='panel-personas']");
            if (btnPersonas) btnPersonas.click();
            const filterCedula = document.getElementById("filter-cedula");
            if (filterCedula) filterCedula.value = query;
            renderPersonasTable();
        }
    });

    // Modales
    setupModalControl("btn-open-persona-modal", "btn-close-persona-modal", "btn-cancel-persona-modal", "modal-persona");
    setupModalControl("btn-open-family-modal", "btn-close-family-modal", "btn-cancel-family-modal", "modal-familia");
    setupModalControl("btn-open-comunidad-modal", "btn-close-comunidad-modal", "btn-cancel-comunidad-modal", "modal-comunidad");
    setupModalControl("btn-open-edificio-modal", "btn-close-edificio-modal", "btn-cancel-edificio-modal", "modal-edificio");
    setupModalControl("btn-open-vivienda-modal", "btn-close-vivienda-modal", "btn-cancel-vivienda-modal", "modal-vivienda");
    setupModalControl(null, "btn-close-editar-family-modal", "btn-cancel-editar-family-modal", "modal-editar-familia");
    setupModalControl(null, "btn-close-editar-rol", "btn-cancel-editar-rol", "modal-editar-rol");

    // Formularios de datos
    addSafeListener("form-persona", "submit", handlePersonaSubmit);
    addSafeListener("form-familia", "submit", handleFamiliaSubmit);
    addSafeListener("form-editar-familia", "submit", handleEditarFamiliaSubmit);
    addSafeListener("form-comunidad", "submit", handleComunidadSubmit);
    addSafeListener("form-edificio", "submit", handleEdificioSubmit);
    addSafeListener("form-vivienda", "submit", handleViviendaSubmit);
    addSafeListener("form-asociar-persona-familia", "submit", handleAsociarPersonaFamilia);
    addSafeListener("form-asociar-familia-vivienda", "submit", handleAsociarFamiliaVivienda);
    addSafeListener("form-crear-usuario", "submit", handleCrearUsuario);
    addSafeListener("form-param-profesion", "submit", handleParamProfesionSubmit);
    addSafeListener("form-param-discapacidad", "submit", handleParamDiscapacidadSubmit);
    addSafeListener("form-cambio-clave", "submit", handleCambioClaveSubmit);
    addSafeListener("form-auth-forgot", "submit", handleForgotPasswordSubmit);
    addSafeListener("form-auth-reset", "submit", handleResetPasswordSubmit);
    addSafeListener("form-mis-datos", "submit", handleMisDatosSubmit);
    addSafeListener("form-editar-rol", "submit", handleEditarRolSubmit);

    // Botones adicionales y flujos
    addSafeListener("btn-ver-grafico-filtros", "click", () => {
        const filterGen = document.getElementById("filter-genero")?.value || "all";
        setReportesSexFilter(filterGen);
        const btnReportes = document.getElementById("menu-item-reportes");
        if (btnReportes) btnReportes.click();
    });

    addSafeListener("btn-forgot-password", "click", (e) => {
        e.preventDefault();
        const loginOverlay = document.getElementById("auth-login-overlay");
        const forgotOverlay = document.getElementById("auth-forgot-overlay");
        if (loginOverlay) loginOverlay.classList.add("hidden");
        if (forgotOverlay) forgotOverlay.classList.remove("hidden");
    });

    addSafeListener("btn-back-to-login", "click", () => {
        const forgotOverlay = document.getElementById("auth-forgot-overlay");
        const loginOverlay = document.getElementById("auth-login-overlay");
        if (forgotOverlay) forgotOverlay.classList.add("hidden");
        if (loginOverlay) loginOverlay.classList.remove("hidden");
    });

    // Despliegue de comunidad para rol líder de comunidad
    addSafeListener("usr-rol", "change", (e) => {
        const commGroup = document.getElementById("usr-comunidad-group");
        if (!commGroup) return;
        const selectedText = e.target.options[e.target.selectedIndex]?.text?.toLowerCase() || "";
        if (selectedText.includes("líder") || selectedText.includes("lider")) {
            commGroup.classList.remove("hidden");
        } else {
            commGroup.classList.add("hidden");
            const usrComunidad = document.getElementById("usr-comunidad");
            if (usrComunidad) usrComunidad.value = "";
        }
    });

    // Filtros Demográficos Reactivos
    const addInputListener = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", fn);
    };
    const addChangeListener = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", fn);
    };

    addInputListener("filter-cedula", renderPersonasTable);
    addInputListener("filter-edad-min", renderPersonasTable);
    addInputListener("filter-edad-max", renderPersonasTable);
    addChangeListener("filter-genero", renderPersonasTable);
    addChangeListener("filter-tipo-vivienda", renderPersonasTable);
    addChangeListener("filter-discapacidad-nivel", renderPersonasTable);

    document.querySelectorAll(".filter-discapacidad-type").forEach(el => {
        el.addEventListener("change", renderPersonasTable);
    });

    // Limpiar Filtros
    addSafeListener("btn-clear-filters", "click", () => {
        const elCedula = document.getElementById("filter-cedula");
        const elEdadMin = document.getElementById("filter-edad-min");
        const elEdadMax = document.getElementById("filter-edad-max");
        const elGenero = document.getElementById("filter-genero");
        const elTipoViv = document.getElementById("filter-tipo-vivienda");
        const elDiscNivel = document.getElementById("filter-discapacidad-nivel");

        if (elCedula) elCedula.value = "";
        if (elEdadMin) elEdadMin.value = "";
        if (elEdadMax) elEdadMax.value = "";
        if (elGenero) elGenero.value = "all";
        if (elTipoViv) elTipoViv.value = "all";
        if (elDiscNivel) elDiscNivel.value = "all";

        document.querySelectorAll(".filter-discapacidad-type").forEach(el => el.checked = false);
        document.querySelectorAll(".filter-profesion-item").forEach(el => el.checked = false);

        renderPersonasTable();
    });

    addSafeListener("btn-exportar-excel", "click", exportarPersonasExcel);
    addSafeListener("btn-exportar-pdf-reportes", "click", exportarReportesPDF);
    addSafeListener("btn-print-pyramid", "click", exportarPiramidePDF);

    // Segmentación y Filtro Interactivo por Sexo en Reportes Gráficos
    document.querySelectorAll("#reportes-sexo-filter-group .btn-segment").forEach(btn => {
        btn.addEventListener("click", () => {
            const sex = btn.dataset.sex;
            setReportesSexFilter(sex);
            renderCharts();
        });
    });
}


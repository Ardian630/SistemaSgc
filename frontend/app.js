import { showAlert, showConfirm } from './notifications.js';
// =========================================================================
// SGC - PUNTO DE ENTRADA PRINCIPAL (app.js)
// Importa los módulos auth.js y ui.js. Sin datos mock ni localStorage.
// =========================================================================

import { 
    initializeAuth, 
    getCurrentUser, 
    handleRegisterAdminSubmit, 
    handleLoginSubmit, 
    handleLogoutClick 
} from "./auth.js";

import {
    setActiveCommunity,
    renderDashboard,
    renderPersonasTable,
    renderFamilias,
    renderViviendasTree,
    renderUsuariosTable,
    populateSelects,
    populateProfessionsChecklist,
    populatePersonaModalSelects,
    populateFamiliaModalSelects,
    populateViviendaModalSelects,
    dbFetchAll,
    uiCreatePersona,
    uiUpdatePersona,
    uiCreateNucleo,
    uiCreateComunidad,
    uiCreateEdificio,
    uiCreateVivienda,
    uiUpdateComunidad,
    uiDeleteComunidad,
    uiUpdateEdificio,
    uiDeleteEdificio,
    uiUpdateVivienda,
    uiDeleteVivienda,

    uiAsociarPersonaFamilia,
    uiAsociarFamiliaVivienda,
    uiCreateUsuario,
    uiUpdateFamily,
    renderParametros,
    uiSaveDiscapacidad,
    renderCharts,
    exportarPersonasExcel,
    uiUpdateMisDatos,
    uiUpdateUserRole
} from "./ui.js";

import { 
    isSupabaseConnected, 
    apiGetRoles, 
    apiResetPasswordForEmail, 
    apiUpdatePassword,
    apiCreateNucleoSimple,
    apiUpdateNucleo,
    apiAsociarPersonaNucleo,
    apiAsociarNucleoVivienda,
    apiAsignarPersonaSueltaAVivienda,
    apiCreatePersona,
    supabase
} from "./supabase-client.js";

// =========================================================================
// INICIALIZACIÓN
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
    // Inicializar controles globales (toggles de clave, sidebar, menú móvil, alternancia auth)
    setupGlobalControls();

    // Configurar todos los event listeners de la interfaz inmediatamente
    setupEventListeners();

    // Escuchar eventos de recuperación de contraseña de Supabase
    if (supabase) {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                document.getElementById("auth-reset-overlay").classList.remove("hidden");
                document.getElementById("auth-login-overlay").classList.add("hidden");
                document.getElementById("auth-register-overlay").classList.add("hidden");
                document.querySelector(".app-container").classList.add("hidden");
                document.querySelector(".app-container").style.display = "none";
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

const PANEL_HASH_MAP = {
    "panel-dashboard": "dashboard",
    "panel-personas": "personas",
    "panel-familias": "familias",
    "panel-viviendas": "viviendas",
    "panel-usuarios": "usuarios",
    "panel-reportes": "reportes",
    "panel-parametros": "parametros",
    "panel-mi-cuenta": "mi-cuenta"
};

function getPanelIdFromHash() {
    const rawHash = (window.location.hash || "").replace("#", "").trim().toLowerCase();
    if (!rawHash) return null;
    
    if (document.getElementById(rawHash)) return rawHash;
    if (document.getElementById("panel-" + rawHash)) return "panel-" + rawHash;

    for (const [panelId, hashName] of Object.entries(PANEL_HASH_MAP)) {
        if (hashName === rawHash) return panelId;
    }
    return null;
}

function restoreActivePanel() {
    let targetPanelId = getPanelIdFromHash();
    if (!targetPanelId) {
        targetPanelId = localStorage.getItem("activePanelId") || sessionStorage.getItem("activePanelId") || "panel-dashboard";
    }

    const targetMenuItem = document.querySelector(`.menu-item[data-target="${targetPanelId}"]`);
    if (targetMenuItem && !targetMenuItem.classList.contains("hidden")) {
        targetMenuItem.click();
    } else {
        const defaultMenuItem = document.querySelector(`.menu-item[data-target="panel-dashboard"]`);
        if (defaultMenuItem) defaultMenuItem.click();
    }
}

async function initApp() {
    initTheme();

    // Diagnóstico RLS: muestra cómo ve la base de datos la sesión actual
    if (supabase) {
        try {
            const { data: diag, error: diagErr } = await supabase.rpc('debug_mi_sesion');
            if (diagErr) console.warn("[RLS Debug] No se pudo ejecutar debug_mi_sesion:", diagErr);
            else console.log("[RLS Debug] Sesión vista por la BD:", diag);
        } catch (e) {
            console.warn("[RLS Debug] Error:", e);
        }
    }

    try { await populateSelects(); } catch (err) { console.warn("[App] Error cargando selectores:", err); }
    try { await populateProfessionsChecklist(); } catch (err) { console.warn("[App] Error cargando profesiones:", err); }
    try { await renderDashboard(); } catch (err) { console.warn("[App] Error renderizando dashboard:", err); }
    try { await renderPersonasTable(); } catch (err) { console.warn("[App] Error renderizando personas:", err); }
    try { await renderFamilias(); } catch (err) { console.warn("[App] Error renderizando familias:", err); }
    try { await renderViviendasTree(); } catch (err) { console.warn("[App] Error renderizando viviendas:", err); }
    try { await renderUsuariosTable(); } catch (err) { console.warn("[App] Error renderizando usuarios:", err); }
    try { await renderParametros(); } catch (err) { console.warn("[App] Error renderizando parámetros:", err); }
    try { await populateRoleSelector(); } catch (err) { console.warn("[App] Error cargando selector de roles:", err); }

    // Restaurar el panel/sección exacta en la que se encontraba el usuario
    restoreActivePanel();
}

function initTheme() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    const moonIcon = themeBtn.querySelector(".theme-icon-moon");
    const sunIcon = themeBtn.querySelector(".theme-icon-sun");

    const applyTheme = (isLight) => {
        if (isLight) {
            document.body.classList.add("light-theme");
            if (moonIcon) moonIcon.classList.add("hidden");
            if (sunIcon) sunIcon.classList.remove("hidden");
        } else {
            document.body.classList.remove("light-theme");
            if (moonIcon) moonIcon.classList.remove("hidden");
            if (sunIcon) sunIcon.classList.add("hidden");
        }
    };

    const savedTheme = localStorage.getItem("theme");
    applyTheme(savedTheme === "light");

    themeBtn.addEventListener("click", () => {
        const isLightNow = !document.body.classList.contains("light-theme");
        applyTheme(isLightNow);
        localStorage.setItem("theme", isLightNow ? "light" : "dark");
    });
}

// =========================================================================
// CARGA DINÁMICA DEL SELECTOR DE ROLES
// Solo administradores fuertes y débiles pueden crear usuarios.
// Roles disponibles para creación: administrador_debil, líder de comunidad, consultor.
// =========================================================================

async function populateRoleSelector() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
        const roles = await apiGetRoles();
        const currentRole = roles.find(r => r.id_rol === currentUser.id_rol);
        const currentRoleName = currentRole ? currentRole.nombre_rol.toLowerCase() : "";

        // Solo administradores (fuerte o débil) pueden ver el panel de usuarios
        const isAdmin = currentRoleName.includes("administrador") || currentRoleName.includes("admin");
        const menuUsr = document.getElementById("menu-item-usuarios");
        
        if (isAdmin) {
            menuUsr.classList.remove("hidden");
        } else {
            menuUsr.classList.add("hidden");
            return; // No necesita el selector si no es admin
        }

        // Poblar el select con roles permitidos (NO incluir Administrador fuerte)
        const usrRolSelect = document.getElementById("usr-rol");
        usrRolSelect.innerHTML = `<option value="">Seleccione un rol...</option>`;

        const allowedRoleNames = ["administrador_debil", "líder de comunidad", "lider de comunidad", "consultor"];
        
        roles.forEach(r => {
            if (allowedRoleNames.includes(r.nombre_rol.toLowerCase())) {
                usrRolSelect.innerHTML += `<option value="${r.id_rol}">${r.nombre_rol}</option>`;
            }
        });
    } catch (err) {
        console.error("Error al cargar roles:", err);
    }
}

// =========================================================================
// CONTROLES GLOBALES DE INTERFAZ (SIDEBAR, CONTRASEÑAS, AUTH SWITCH)
// =========================================================================

function setupGlobalControls() {
    setupPasswordToggles();
    setupSidebarControls();
    setupAuthSwitchControls();
}

function setupPasswordToggles() {
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

function setupSidebarControls() {
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

function setupAuthSwitchControls() {
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

// =========================================================================
// EVENT LISTENERS DE LA APLICACIÓN
// =========================================================================

function setupEventListeners() {
    const addSafeListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Navegación Sidebar
    const menuItems = document.querySelectorAll(".menu-item");
    const panels = document.querySelectorAll(".panel");

    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            menuItems.forEach(mi => mi.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));

            item.classList.add("active");
            const targetId = item.getAttribute("data-target");
            const targetPanel = document.getElementById(targetId);
            
            if (targetId) {
                localStorage.setItem("activePanelId", targetId);
                sessionStorage.setItem("activePanelId", targetId);
                const hashName = PANEL_HASH_MAP[targetId] || targetId.replace("panel-", "");
                if (window.location.hash !== "#" + hashName) {
                    history.replaceState(null, "", "#" + hashName);
                }
            }

            if (targetPanel) targetPanel.classList.add("active");
            
            if (targetId === "panel-dashboard") renderDashboard();
            if (targetId === "panel-personas") renderPersonasTable();
            if (targetId === "panel-familias") renderFamilias();
            if (targetId === "panel-viviendas") renderViviendasTree();
            if (targetId === "panel-usuarios") renderUsuariosTable();
            if (targetId === "panel-reportes") renderCharts();
            if (targetId === "panel-parametros") renderParametros();
            if (targetId === "panel-mi-cuenta") {
                const currentUser = getCurrentUser();
                if (currentUser) {
                    const miNombreInput = document.getElementById("mi-nombre");
                    const miTelefonoInput = document.getElementById("mi-telefono");
                    if (miNombreInput) miNombreInput.value = currentUser.nombre_completo || "";
                    if (miTelefonoInput) miTelefonoInput.value = currentUser.telefono || "";
                }
            }

            // En móviles, cerrar el panel lateral tras seleccionar
            if (window.closeMobileSidebar) window.closeMobileSidebar();
        });
    });

    // Escuchar cambios de Hash en la URL para soporte de navegación e historial
    window.addEventListener("hashchange", () => {
        const targetPanelId = getPanelIdFromHash();
        if (targetPanelId) {
            const menuItem = document.querySelector(`.menu-item[data-target="${targetPanelId}"]`);
            if (menuItem && !menuItem.classList.contains("hidden") && !menuItem.classList.contains("active")) {
                menuItem.click();
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
    document.getElementById("filter-cedula").addEventListener("input", renderPersonasTable);
    document.getElementById("filter-edad-min").addEventListener("input", renderPersonasTable);
    document.getElementById("filter-edad-max").addEventListener("input", renderPersonasTable);
    document.getElementById("filter-genero").addEventListener("change", renderPersonasTable);
    document.getElementById("filter-tipo-vivienda").addEventListener("change", renderPersonasTable);
    document.getElementById("filter-discapacidad-nivel").addEventListener("change", renderPersonasTable);
    
    document.querySelectorAll(".filter-discapacidad-type").forEach(el => {
        el.addEventListener("change", renderPersonasTable);
    });

    // Limpiar Filtros
    document.getElementById("btn-clear-filters").addEventListener("click", () => {
        document.getElementById("filter-cedula").value = "";
        document.getElementById("filter-edad-min").value = "";
        document.getElementById("filter-edad-max").value = "";
        document.getElementById("filter-genero").value = "all";
        document.getElementById("filter-tipo-vivienda").value = "all";
        document.getElementById("filter-discapacidad-nivel").value = "all";
        
        document.querySelectorAll(".filter-discapacidad-type").forEach(el => el.checked = false);
        document.querySelectorAll(".filter-profesion-item").forEach(el => el.checked = false);
        
        renderPersonasTable();
    });

    const btnExportarExcel = document.getElementById("btn-exportar-excel");
    if(btnExportarExcel) {
        btnExportarExcel.addEventListener("click", exportarPersonasExcel);
    }
}

// Helper control modal
function setupModalControl(openBtnId, closeBtnId, cancelBtnId, modalId) {
    const openBtn = document.getElementById(openBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const cancelBtn = document.getElementById(cancelBtnId);
    const modal = document.getElementById(modalId);

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

// =========================================================================
// HANDLERS DE FORMULARIOS DE DATOS
// =========================================================================

async function handlePersonaSubmit(e) {
    e.preventDefault();

    const personaId = document.getElementById("persona-id").value;

    const nucleoSelection = document.getElementById("persona-nucleo").value || "";
    let finalIdNucleo = null;
    let targetViviendaId = null;

    if (nucleoSelection.startsWith("fam_")) {
        finalIdNucleo = nucleoSelection.split("_")[1];
    } else if (nucleoSelection.startsWith("viv_")) {
        targetViviendaId = nucleoSelection.split("_")[1];
    }

    const personaData = {
        id_nucleo: finalIdNucleo,
        nombre_completo: document.getElementById("persona-nombre").value,
        tipo_cedula: document.getElementById("persona-tipo-cedula").value,
        cedula_identidad: document.getElementById("persona-cedula").value,
        fecha_nacimiento: document.getElementById("persona-fecha-nacimiento").value,
        genero: document.getElementById("persona-genero").value,
        telefono: document.getElementById("persona-telefono").value || null,
        email: document.getElementById("persona-email").value || null,
        id_profesion: document.getElementById("persona-profesion").value || null,
        id_discapacidad: document.getElementById("persona-discapacidad").value || null
    };

    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(personaData.nombre_completo)) {
        showAlert("Los nombres no pueden contener números.", "error");
        return;
    }

    const cedulaRegex = /^\d{6,9}$/;
    if (!cedulaRegex.test(personaData.cedula_identidad)) {
        showAlert("La cédula debe contener solo números (entre 6 y 9 dígitos).", "error");
        return;
    }

    if (personaData.telefono) {
        const phoneRegex = /^04(12|14|16|24|26)-\d{7}$/;
        if (!phoneRegex.test(personaData.telefono)) {
            showAlert("El teléfono debe tener el formato 04xx-xxxxxxx", "error");
            return;
        }
    }

    try {
        if (personaId) {
            await uiUpdatePersona(personaId, personaData);
            if (targetViviendaId) {
                const newFamName = `Familia de ${personaData.nombre_completo}`;
                await apiAsignarPersonaSueltaAVivienda(newFamName, targetViviendaId, personaId);
            }
            showAlert("Datos de la persona actualizados con éxito.", "success");
        } else {
            const createdPersona = await uiCreatePersona(personaData);
            if (targetViviendaId && createdPersona) {
                const newFamName = `Familia de ${createdPersona.nombre_completo}`;
                await apiAsignarPersonaSueltaAVivienda(newFamName, targetViviendaId, createdPersona.id_persona);
            }
            showAlert("Persona registrada con éxito.", "success");
        }
        e.target.reset();
        document.getElementById("persona-id").value = "";
        document.getElementById("modal-persona").classList.add("hidden");
        
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar persona: " + (err.message || err), "error");
    }
}

async function handleFamiliaSubmit(e) {
    e.preventDefault();

    const jefeSelect = document.getElementById("fam-jefe");
    const jefeId = jefeSelect ? jefeSelect.value : null;
    const viviendaId = document.getElementById("fam-vivienda").value || null;
    const nombreFam = document.getElementById("fam-nombre").value;

    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(nombreFam)) {
        showAlert("El nombre de la familia no puede contener números.", "error");
        return;
    }

    try {
        await uiCreateNucleo(nombreFam, viviendaId, jefeId);
        e.target.reset();
        document.getElementById("modal-familia").classList.add("hidden");
        
        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
        showAlert("Núcleo familiar creado exitosamente.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al crear núcleo familiar: " + (err.message || err), "error");
    }
}

async function handleComunidadSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("com-id").value;
    const nombre = document.getElementById("com-nombre").value;

    try {
        if (id) {
            await uiUpdateComunidad(id, nombre);
            showAlert(`Comunidad "${nombre}" actualizada.`, "success");
        } else {
            await uiCreateComunidad(nombre);
            showAlert(`Comunidad "${nombre}" agregada.`, "success");
        }
        e.target.reset();
        document.getElementById("com-id").value = "";
        document.getElementById("modal-comunidad").classList.add("hidden");
        document.getElementById('modal-comunidad-title').textContent = 'Agregar Comunidad';
        await populateSelects();
        await renderViviendasTree();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar comunidad: " + (err.message || err), "error");
    }
}

async function handleEdificioSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("edf-id").value;
    const comId = document.getElementById("edf-comunidad").value;
    const nombre = document.getElementById("edf-nombre").value;

    try {
        if (id) {
            await uiUpdateEdificio(id, comId, nombre);
            showAlert(`Edificio "${nombre}" actualizado.`, "success");
        } else {
            await uiCreateEdificio(nombre, comId);
            showAlert(`Edificio "${nombre}" registrado.`, "success");
        }
        e.target.reset();
        document.getElementById("edf-id").value = "";
        document.getElementById("modal-edificio").classList.add("hidden");
        document.getElementById('modal-edificio-title').textContent = 'Agregar Edificio';
        await renderViviendasTree();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar edificio: " + (err.message || err), "error");
    }
}

async function handleViviendaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("viv-id").value;
    const comId = document.getElementById("viv-comunidad").value;
    const edfId = document.getElementById("viv-edificio").value || null;
    const numero = document.getElementById("viv-numero").value;
    const bloque = document.getElementById("viv-bloque").value || null;

    try {
        if (id) {
            await uiUpdateVivienda(id, comId, edfId, numero, bloque);
            showAlert(`Vivienda "${numero}" actualizada con éxito.`, "success");
        } else {
            await uiCreateVivienda(comId, edfId, numero, bloque);
            showAlert(`Vivienda "${numero}" registrada con éxito.`, "success");
        }
        e.target.reset();
        document.getElementById("viv-id").value = "";
        document.getElementById("modal-vivienda").classList.add("hidden");
        document.getElementById('modal-vivienda-title').textContent = 'Registrar Nueva Vivienda';
        await populateSelects();
        await renderViviendasTree();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar vivienda: " + (err.message || err), "error");
    }
}

async function handleAsociarPersonaFamilia(e) {
    e.preventDefault();
    const personaId = document.getElementById("asociar-persona-select").value;
    const familiaId = document.getElementById("asociar-familia-select").value;

    try {
        await uiAsociarPersonaFamilia(personaId, familiaId);
        showAlert("Persona asociada al núcleo familiar.", "success");
        e.target.reset();
        
        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
    } catch (err) {
        console.error(err);
        showAlert("Error al asociar persona: " + (err.message || err), "error");
    }
}

async function handleAsociarFamiliaVivienda(e) {
    e.preventDefault();
    const selection = document.getElementById("vivienda-asoc-familia").value;
    const viviendaId = document.getElementById("vivienda-asoc-vivienda").value;

    try {
        const db = await dbFetchAll();
        
        let targetNucleoId = selection.startsWith("fam_") ? selection.split("_")[1] : null;

        // Verificar si la vivienda destino ya está ocupada por otro núcleo familiar
        const isOccupied = db.nucleos.some(n => n.id_vivienda === viviendaId && n.id_nucleo !== targetNucleoId);
        
        let confirmMsg = "¿Está seguro que desea trasladar al grupo a esta nueva vivienda?";
        if (isOccupied) {
            confirmMsg = "La vivienda seleccionada ya se encuentra habitada por otra familia. ¿Desea trasladarlos allí de todas formas?";
        }

        const confirmed = await showConfirm(confirmMsg);
        if (!confirmed) return;

        if (selection.startsWith("fam_")) {
            await apiAsociarNucleoVivienda(targetNucleoId, viviendaId);
            showAlert("Núcleo familiar reubicado en la vivienda seleccionada.", "success");
        } else if (selection.startsWith("per_")) {
            const personaId = selection.split("_")[1];
            const persona = db.personas.find(p => p.id_persona === personaId);
            
            const newFamName = `Familia de ${persona.nombre_completo}`;
            await apiAsignarPersonaSueltaAVivienda(newFamName, viviendaId, persona.id_persona);
            
            showAlert("Persona asignada a la vivienda (se creó su núcleo familiar de 1 persona).", "success");
        }

        e.target.reset();
        
        await renderFamilias();
        await renderViviendasTree();
        await populateSelects();
    } catch (err) {
        console.error(err);
        showAlert("Error al asociar a vivienda: " + (err.message || err), "error");
    }
}

async function handleCrearUsuario(e) {
    e.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser) {
        showAlert("Error: No hay sesión activa.", "error");
        return;
    }

    // Verificar que el usuario actual es administrador (fuerte o débil)
    try {
        const roles = await apiGetRoles();
        const currentRole = roles.find(r => r.id_rol === currentUser.id_rol);
        const currentRoleName = currentRole ? currentRole.nombre_rol.toLowerCase() : "";
        
        if (!currentRoleName.includes("administrador") && !currentRoleName.includes("admin")) {
            showAlert("Acción denegada: Solo los administradores pueden crear cuentas de usuario.", "warning");
            return;
        }
    } catch (err) {
        console.error(err);
        showAlert("Error al verificar permisos: " + (err.message || err), "error");
        return;
    }

    const nombre = document.getElementById("usr-nombre").value;
    const email = document.getElementById("usr-email").value.trim();
    const tlf = document.getElementById("usr-telefono").value || null;
    const rol = document.getElementById("usr-rol").value;
    const commId = document.getElementById("usr-comunidad").value || null;
    const pass = document.getElementById("usr-password").value;

    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(nombre)) {
        showAlert("Los nombres no pueden contener números.", "error");
        return;
    }

    if (tlf) {
        const phoneRegex = /^04(12|14|16|24|26)-\d{7}$/;
        if (!phoneRegex.test(tlf)) {
            showAlert("El teléfono debe tener el formato 04xx-xxxxxxx", "error");
            return;
        }
    }

    if (!rol) {
        showAlert("Debe seleccionar un rol para el nuevo usuario.", "warning");
        return;
    }

    try {
        await uiCreateUsuario({
            nombre_completo: nombre,
            email: email,
            telefono: tlf,
            id_rol: rol,
            id_comunidad: commId,
            password: pass
        });

        e.target.reset();
        document.getElementById("usr-comunidad-group").classList.add("hidden");
        
        await renderUsuariosTable();
        await renderDashboard();
        showAlert("Cuenta de usuario creada con éxito.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al crear usuario: " + (err.message || err), "error");
    }
}

async function handleEditarFamiliaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("edit-fam-id").value;
    const nombre = document.getElementById("edit-fam-nombre").value;
    const viviendaId = document.getElementById("edit-fam-vivienda").value || null;
    const jefeId = document.getElementById("edit-fam-jefe").value || null;

    try {
        await uiUpdateFamily(id, nombre, viviendaId, jefeId);
        e.target.reset();
        document.getElementById("modal-editar-familia").classList.add("hidden");
        
        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
        showAlert("Núcleo familiar actualizado con éxito.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al actualizar núcleo familiar: " + (err.message || err), "error");
    }
}

async function handleParamProfesionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("param-profesion-id").value;
    const nombre = document.getElementById("param-profesion-nombre").value.trim();

    try {
        await uiSaveProfesion(id, nombre);
        e.target.reset();
        document.getElementById("param-profesion-id").value = "";
        await renderParametros();
        await populateSelects();
        await populateProfessionsChecklist();
        showAlert("Profesión guardada con éxito.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar profesión: " + (err.message || err), "error");
    }
}

async function handleParamDiscapacidadSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("param-discapacidad-id").value;
    const tipo = document.getElementById("param-discapacidad-tipo").value;
    const nivel = document.getElementById("param-discapacidad-nivel").value;

    try {
        await uiSaveDiscapacidad(id, tipo, nivel);
        e.target.reset();
        document.getElementById("param-discapacidad-id").value = "";
        await renderParametros();
        await populateSelects();
        await populatePersonaModalSelects();
        showAlert("Discapacidad guardada con éxito.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar discapacidad: " + (err.message || err), "error");
    }
}

async function handleCambioClaveSubmit(e) {
    e.preventDefault();
    const nueva = document.getElementById("pwd-nueva").value;
    const confirmar = document.getElementById("pwd-confirmar").value;

    if (nueva !== confirmar) {
        showAlert("Las contraseñas no coinciden.", "warning");
        return;
    }

    try {
        await apiUpdatePassword(nueva);
        e.target.reset();
        showAlert("Contraseña actualizada con éxito.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al actualizar contraseña: " + (err.message || err), "error");
    }
}

async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();

    try {
        await apiResetPasswordForEmail(email);
        showAlert("Se ha enviado un enlace de recuperación a su correo electrónico.", "info");
        document.getElementById("auth-forgot-overlay").classList.add("hidden");
        document.getElementById("auth-login-overlay").classList.remove("hidden");
    } catch (err) {
        console.error(err);
        showAlert("Error al enviar el enlace de recuperación: " + (err.message || err), "error");
    }
}

async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const nueva = document.getElementById("reset-password").value;
    const confirmar = document.getElementById("reset-password-confirm").value;

    if (nueva !== confirmar) {
        showAlert("Las contraseñas no coinciden.", "warning");
        return;
    }

    try {
        await apiUpdatePassword(nueva);
        showAlert("Contraseña restablecida con éxito. Inicie sesión con su nueva contraseña.", "success");
        document.getElementById("auth-reset-overlay").classList.add("hidden");
        document.getElementById("auth-login-overlay").classList.remove("hidden");
        window.location.hash = ""; // Clean URL
    } catch (err) {
        console.error(err);
        showAlert("Error al restablecer la contraseña: " + (err.message || err), "error");
    }
}

// -------------------------
// Manejo de roles y perfil
// -------------------------

async function handleMisDatosSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById("mi-nombre").value.trim();
    const telefono = document.getElementById("mi-telefono").value.trim();
    
    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(nombre)) {
        showAlert("Los nombres no pueden contener números.", "error");
        return;
    }

    if (telefono) {
        const phoneRegex = /^04(12|14|16|24|26)-\d{7}$/;
        if (!phoneRegex.test(telefono)) {
            showAlert("El teléfono debe tener el formato 04xx-xxxxxxx", "error");
            return;
        }
    }

    try {
        await uiUpdateMisDatos(nombre, telefono);
        showAlert("Tus datos han sido actualizados correctamente.", "success");
    } catch (error) {
        showAlert(error.message, "error");
    }
}

async function handleEditarRolSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("edit-usr-id").value;
    const rol = document.getElementById("edit-usr-rol").value;
    try {
        await uiUpdateUserRole(id, rol);
    } catch (error) {
        showAlert(error.message, "error");
    }
}

window.editComunidad = async (id) => {
    const db = await dbFetchAll();
    const c = db.comunidades.find(x => x.id_comunidad === id);
    if (!c) return;
    document.getElementById('com-id').value = c.id_comunidad;
    document.getElementById('com-nombre').value = c.nombre_comunidad;
    document.getElementById('modal-comunidad-title').textContent = 'Editar Comunidad';
    document.getElementById('modal-comunidad').classList.remove('hidden');
};

window.deleteComunidad = async (id) => {
    const confirmed = await showConfirm('¿Está seguro que desea eliminar esta comunidad? Se eliminarán todos sus edificios y viviendas asociados.');
    if (!confirmed) return;
    try {
        await uiDeleteComunidad(id);
        showAlert('Comunidad eliminada con éxito.', 'success');
        await populateSelects();
        await renderViviendasTree();
    } catch (err) {
        showAlert('Error al eliminar comunidad: ' + err.message, 'error');
    }
};

window.editEdificio = async (id) => {
    const db = await dbFetchAll();
    const e = db.edificios.find(x => x.id_edificio === id);
    if (!e) return;
    document.getElementById('edf-id').value = e.id_edificio;
    document.getElementById('edf-comunidad').value = e.id_comunidad;
    document.getElementById('edf-nombre').value = e.nombre_edificio;
    document.getElementById('modal-edificio-title').textContent = 'Editar Edificio';
    document.getElementById('modal-edificio').classList.remove('hidden');
};

window.deleteEdificio = async (id) => {
    const confirmed = await showConfirm('¿Está seguro que desea eliminar este edificio? Se eliminarán las viviendas asociadas.');
    if (!confirmed) return;
    try {
        await uiDeleteEdificio(id);
        showAlert('Edificio eliminado con éxito.', 'success');
        await renderViviendasTree();
    } catch (err) {
        showAlert('Error al eliminar edificio: ' + err.message, 'error');
    }
};

window.editVivienda = async (id) => {
    await populateViviendaModalSelects(); // Llenar el select de comunidades
    const db = await dbFetchAll();
    const v = db.viviendas.find(x => x.id_vivienda === id);
    if (!v) return;
    document.getElementById('viv-id').value = v.id_vivienda;
    document.getElementById('viv-comunidad').value = v.id_comunidad;
    
    // Trigger change on comunidad to populate edificios
    const comSelect = document.getElementById('viv-comunidad');
    comSelect.dispatchEvent(new Event('change'));

    setTimeout(() => {
        document.getElementById('viv-edificio').value = v.id_edificio || '';
        document.getElementById('viv-numero').value = v.numero_vivienda;
        document.getElementById('viv-bloque').value = v.bloque || '';
        document.getElementById('modal-vivienda-title').textContent = 'Editar Vivienda';
        document.getElementById('modal-vivienda').classList.remove('hidden');
    }, 100); // Pequeño delay para que el select se llene
};

window.deleteVivienda = async (id) => {
    const confirmed = await showConfirm('¿Está seguro que desea eliminar esta vivienda? Se desvincularán las familias asociadas.');
    if (!confirmed) return;
    try {
        await uiDeleteVivienda(id);
        showAlert('Vivienda eliminada con éxito.', 'success');
        await renderViviendasTree();
    } catch (err) {
        showAlert('Error al eliminar vivienda: ' + err.message, 'error');
    }
};

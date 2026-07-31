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
    uiAsociarPersonaFamilia,
    uiAsociarFamiliaVivienda,
    uiCreateUsuario,
    uiUpdateFamily,
    renderParametros,
    uiSaveProfesion,
    uiSaveDiscapacidad,
    renderCharts
} from "./ui.js";

import { 
    isSupabaseConnected, 
    apiGetRoles, 
    apiResetPasswordForEmail, 
    apiUpdatePassword,
    supabase
} from "./supabase-client.js";

// =========================================================================
// INICIALIZACIÓN
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
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
    document.getElementById("form-auth-register").addEventListener("submit", handleRegisterAdminSubmit);
    document.getElementById("form-auth-login").addEventListener("submit", handleLoginSubmit);
    document.getElementById("btn-logout").addEventListener("click", handleLogoutClick);
});

async function initApp() {
    await populateSelects();
    await populateProfessionsChecklist();
    await renderDashboard();
    await renderPersonasTable();
    await renderFamilias();
    await renderViviendasTree();
    await renderUsuariosTable();
    await renderParametros();
    
    setupEventListeners();

    // Cargar el selector de roles dinámicamente para crear usuarios
    await populateRoleSelector();

    // Tema visual (solo preferencia CSS, no datos)
    if (localStorage.getItem("theme") === "light") {
        document.body.classList.add("light-theme");
        document.getElementById("theme-toggle-btn").textContent = "☀️";
    }
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
// EVENT LISTENERS
// =========================================================================

function setupEventListeners() {
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
            
            targetPanel.classList.add("active");
            
            if (targetId === "panel-dashboard") renderDashboard();
            if (targetId === "panel-personas") renderPersonasTable();
            if (targetId === "panel-familias") renderFamilias();
            if (targetId === "panel-viviendas") renderViviendasTree();
            if (targetId === "panel-usuarios") renderUsuariosTable();
            if (targetId === "panel-reportes") renderCharts();
            if (targetId === "panel-parametros") renderParametros();
        });
    });

    // Filtro de comunidad activa
    const communitySelect = document.getElementById("active-community-select");
    communitySelect.addEventListener("change", (e) => {
        setActiveCommunity(e.target.value);
        const activePanelId = document.querySelector(".panel.active").id;
        if (activePanelId === "panel-dashboard") renderDashboard();
        if (activePanelId === "panel-personas") renderPersonasTable();
        if (activePanelId === "panel-familias") renderFamilias();
        if (activePanelId === "panel-viviendas") renderViviendasTree();
        if (activePanelId === "panel-usuarios") renderUsuariosTable();
        if (activePanelId === "panel-reportes") renderCharts();
    });

    // Buscador Global
    const globalSearch = document.getElementById("global-search");
    globalSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query) {
            document.querySelector("[data-target='panel-personas']").click();
            document.getElementById("filter-cedula").value = query;
            renderPersonasTable();
        }
    });

    // Cambiar tema (esto sí usa localStorage, pero solo para preferencia visual)
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    themeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        if (document.body.classList.contains("light-theme")) {
            localStorage.setItem("theme", "light");
            themeToggleBtn.textContent = "☀️";
        } else {
            localStorage.setItem("theme", "dark");
            themeToggleBtn.textContent = "🌙";
        }
    });

    // Modales
    setupModalControl("btn-open-persona-modal", "btn-close-persona-modal", "btn-cancel-persona-modal", "modal-persona");
    setupModalControl("btn-open-family-modal", "btn-close-family-modal", "btn-cancel-family-modal", "modal-familia");
    setupModalControl("btn-open-comunidad-modal", "btn-close-comunidad-modal", "btn-cancel-comunidad-modal", "modal-comunidad");
    setupModalControl("btn-open-edificio-modal", "btn-close-edificio-modal", "btn-cancel-edificio-modal", "modal-edificio");
    setupModalControl("btn-open-vivienda-modal", "btn-close-vivienda-modal", "btn-cancel-vivienda-modal", "modal-vivienda");
    setupModalControl(null, "btn-close-editar-family-modal", "btn-cancel-editar-family-modal", "modal-editar-familia");

    // Formularios de datos
    document.getElementById("form-persona").addEventListener("submit", handlePersonaSubmit);
    document.getElementById("form-familia").addEventListener("submit", handleFamiliaSubmit);
    document.getElementById("form-editar-familia").addEventListener("submit", handleEditarFamiliaSubmit);
    document.getElementById("form-comunidad").addEventListener("submit", handleComunidadSubmit);
    document.getElementById("form-edificio").addEventListener("submit", handleEdificioSubmit);
    document.getElementById("form-vivienda").addEventListener("submit", handleViviendaSubmit);
    document.getElementById("form-asociar-persona-familia").addEventListener("submit", handleAsociarPersonaFamilia);
    document.getElementById("form-asociar-familia-vivienda").addEventListener("submit", handleAsociarFamiliaVivienda);
    document.getElementById("form-crear-usuario").addEventListener("submit", handleCrearUsuario);
    document.getElementById("form-param-profesion").addEventListener("submit", handleParamProfesionSubmit);
    document.getElementById("form-param-discapacidad").addEventListener("submit", handleParamDiscapacidadSubmit);
    document.getElementById("form-cambio-clave").addEventListener("submit", handleCambioClaveSubmit);
    document.getElementById("form-auth-forgot").addEventListener("submit", handleForgotPasswordSubmit);
    document.getElementById("form-auth-reset").addEventListener("submit", handleResetPasswordSubmit);

    // Botones adicionales y flujos
    document.getElementById("btn-ver-grafico-filtros").addEventListener("click", () => {
        document.getElementById("menu-item-reportes").click();
    });

    document.getElementById("btn-forgot-password").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("auth-login-overlay").classList.add("hidden");
        document.getElementById("auth-forgot-overlay").classList.remove("hidden");
    });

    document.getElementById("btn-back-to-login").addEventListener("click", () => {
        document.getElementById("auth-forgot-overlay").classList.add("hidden");
        document.getElementById("auth-login-overlay").classList.remove("hidden");
    });

    // Despliegue de comunidad para rol líder de comunidad
    const usrRolSelect = document.getElementById("usr-rol");
    usrRolSelect.addEventListener("change", (e) => {
        const value = e.target.value;
        const commGroup = document.getElementById("usr-comunidad-group");
        // Mostrar comunidad si el texto de la opción seleccionada incluye "líder" o "lider"
        const selectedText = e.target.options[e.target.selectedIndex]?.text?.toLowerCase() || "";
        if (selectedText.includes("líder") || selectedText.includes("lider")) {
            commGroup.classList.remove("hidden");
        } else {
            commGroup.classList.add("hidden");
            document.getElementById("usr-comunidad").value = "";
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

    const personaData = {
        id_nucleo: document.getElementById("persona-nucleo").value || null,
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

    try {
        if (personaId) {
            await uiUpdatePersona(personaId, personaData);
            alert("Datos de la persona actualizados con éxito.");
        } else {
            await uiCreatePersona(personaData);
            alert("Persona registrada con éxito.");
        }
        e.target.reset();
        document.getElementById("persona-id").value = "";
        document.getElementById("modal-persona").classList.add("hidden");
        
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
    } catch (err) {
        console.error(err);
        alert("Error al guardar persona: " + (err.message || err));
    }
}

async function handleFamiliaSubmit(e) {
    e.preventDefault();

    const jefeSelect = document.getElementById("fam-jefe");
    const jefeId = jefeSelect ? jefeSelect.value : null;
    const viviendaId = document.getElementById("fam-vivienda").value || null;
    const nombreFam = document.getElementById("fam-nombre").value;

    try {
        await uiCreateNucleo(nombreFam, viviendaId, jefeId);
        e.target.reset();
        document.getElementById("modal-familia").classList.add("hidden");
        
        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
        alert("Núcleo familiar creado exitosamente.");
    } catch (err) {
        console.error(err);
        alert("Error al crear núcleo familiar: " + (err.message || err));
    }
}

async function handleComunidadSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById("com-nombre").value;

    try {
        await uiCreateComunidad(nombre);
        e.target.reset();
        document.getElementById("modal-comunidad").classList.add("hidden");
        await populateSelects();
        await renderViviendasTree();
        alert(`Comunidad "${nombre}" agregada.`);
    } catch (err) {
        console.error(err);
        alert("Error al crear comunidad: " + (err.message || err));
    }
}

async function handleEdificioSubmit(e) {
    e.preventDefault();
    const comId = document.getElementById("edf-comunidad").value;
    const nombre = document.getElementById("edf-nombre").value;

    try {
        await uiCreateEdificio(nombre, comId);
        e.target.reset();
        document.getElementById("modal-edificio").classList.add("hidden");
        await renderViviendasTree();
        alert(`Edificio "${nombre}" registrado.`);
    } catch (err) {
        console.error(err);
        alert("Error al crear edificio: " + (err.message || err));
    }
}

async function handleViviendaSubmit(e) {
    e.preventDefault();
    const comId = document.getElementById("viv-comunidad").value;
    const edfId = document.getElementById("viv-edificio").value || null;
    const numero = document.getElementById("viv-numero").value;
    const bloque = document.getElementById("viv-bloque").value || null;

    try {
        await uiCreateVivienda(comId, edfId, numero, bloque);
        e.target.reset();
        document.getElementById("modal-vivienda").classList.add("hidden");
        await populateSelects();
        await renderViviendasTree();
        alert(`Vivienda "${numero}" registrada con éxito.`);
    } catch (err) {
        console.error(err);
        alert("Error al crear vivienda: " + (err.message || err));
    }
}

async function handleAsociarPersonaFamilia(e) {
    e.preventDefault();
    const personaId = document.getElementById("asociar-persona-select").value;
    const familiaId = document.getElementById("asociar-familia-select").value;

    try {
        await uiAsociarPersonaFamilia(personaId, familiaId);
        alert("Persona asociada al núcleo familiar.");
        e.target.reset();
        
        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
    } catch (err) {
        console.error(err);
        alert("Error al asociar persona: " + (err.message || err));
    }
}

async function handleAsociarFamiliaVivienda(e) {
    e.preventDefault();
    const familiaId = document.getElementById("vivienda-asoc-familia").value;
    const viviendaId = document.getElementById("vivienda-asoc-vivienda").value;

    try {
        await uiAsociarFamiliaVivienda(familiaId, viviendaId);
        alert("Núcleo familiar reubicado en la vivienda seleccionada.");
        e.target.reset();
        
        await renderFamilias();
        await renderViviendasTree();
        await populateSelects();
    } catch (err) {
        console.error(err);
        alert("Error al asociar familia a vivienda: " + (err.message || err));
    }
}

async function handleCrearUsuario(e) {
    e.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert("Error: No hay sesión activa.");
        return;
    }

    // Verificar que el usuario actual es administrador (fuerte o débil)
    try {
        const roles = await apiGetRoles();
        const currentRole = roles.find(r => r.id_rol === currentUser.id_rol);
        const currentRoleName = currentRole ? currentRole.nombre_rol.toLowerCase() : "";
        
        if (!currentRoleName.includes("administrador") && !currentRoleName.includes("admin")) {
            alert("Acción denegada: Solo los administradores pueden crear cuentas de usuario.");
            return;
        }
    } catch (err) {
        console.error(err);
        alert("Error al verificar permisos: " + (err.message || err));
        return;
    }

    const nombre = document.getElementById("usr-nombre").value;
    const email = document.getElementById("usr-email").value.trim();
    const tlf = document.getElementById("usr-telefono").value || null;
    const rol = document.getElementById("usr-rol").value;
    const commId = document.getElementById("usr-comunidad").value || null;
    const pass = document.getElementById("usr-password").value;

    if (!rol) {
        alert("Debe seleccionar un rol para el nuevo usuario.");
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
        alert("Cuenta de usuario creada con éxito.");
    } catch (err) {
        console.error(err);
        alert("Error al crear usuario: " + (err.message || err));
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
        alert("Núcleo familiar actualizado con éxito.");
    } catch (err) {
        console.error(err);
        alert("Error al actualizar núcleo familiar: " + (err.message || err));
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
        alert("Profesión guardada con éxito.");
    } catch (err) {
        console.error(err);
        alert("Error al guardar profesión: " + (err.message || err));
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
        alert("Discapacidad guardada con éxito.");
    } catch (err) {
        console.error(err);
        alert("Error al guardar discapacidad: " + (err.message || err));
    }
}

async function handleCambioClaveSubmit(e) {
    e.preventDefault();
    const nueva = document.getElementById("pwd-nueva").value;
    const confirmar = document.getElementById("pwd-confirmar").value;

    if (nueva !== confirmar) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    try {
        await apiUpdatePassword(nueva);
        e.target.reset();
        alert("Contraseña actualizada con éxito.");
    } catch (err) {
        console.error(err);
        alert("Error al actualizar contraseña: " + (err.message || err));
    }
}

async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();

    try {
        await apiResetPasswordForEmail(email);
        alert("Se ha enviado un enlace de recuperación a su correo electrónico.");
        document.getElementById("auth-forgot-overlay").classList.add("hidden");
        document.getElementById("auth-login-overlay").classList.remove("hidden");
    } catch (err) {
        console.error(err);
        alert("Error al enviar el enlace de recuperación: " + (err.message || err));
    }
}

async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const nueva = document.getElementById("reset-password").value;
    const confirmar = document.getElementById("reset-password-confirm").value;

    if (nueva !== confirmar) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    try {
        await apiUpdatePassword(nueva);
        alert("Contraseña restablecida con éxito. Inicie sesión con su nueva contraseña.");
        document.getElementById("auth-reset-overlay").classList.add("hidden");
        window.location.hash = ""; // Clean URL
        window.location.reload();
    } catch (err) {
        console.error(err);
        alert("Error al restablecer la contraseña: " + (err.message || err));
    }
}

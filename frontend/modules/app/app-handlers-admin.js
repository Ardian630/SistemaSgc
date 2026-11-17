// =========================================================================
// SGC - MÓDULO DE CONTROLADORES DE ADMINISTRACIÓN Y CUENTA
// Manejo de usuarios, roles, parámetros del sistema y seguridad de contraseñas.
// =========================================================================

import { showAlert } from "../../notifications.js";
import { getCurrentUser } from "../../auth.js";
import {
    apiGetRoles,
    apiResetPasswordForEmail,
    apiUpdatePassword
} from "../../supabase-client.js";

import {
    uiCreateUsuario,
    uiUpdateUserRole,
    uiUpdateMisDatos,
    uiSaveProfesion,
    uiSaveDiscapacidad,
    renderUsuariosTable,
    renderDashboard,
    renderParametros,
    populateSelects,
    populateProfessionsChecklist,
    populatePersonaModalSelects
} from "../../ui.js";

// =========================================================================
// CARGA DINÁMICA DEL SELECTOR DE ROLES
// Solo administradores fuertes y débiles pueden crear usuarios.
// Roles disponibles para creación: administrador_debil, líder de comunidad, consultor.
// =========================================================================

export async function populateRoleSelector() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
        const roles = await apiGetRoles();
        const currentRole = roles.find(r => r.id_rol === currentUser.id_rol);
        const currentRoleName = currentRole ? currentRole.nombre_rol.toLowerCase() : (currentUser.nombre_rol || "").toLowerCase();

        const adminUuids = [
            "eec65b46-ce49-41be-9da7-be001e7ce87e", // Administrador
            "8c37a94d-7b05-42fc-9fdb-5e4eb8cee87f", // administrador_debil
            "1",
            "r-1",
            "r-4"
        ];
        const isAdmin = currentRoleName.includes("administrador") || currentRoleName.includes("admin") || adminUuids.includes(String(currentUser.id_rol));
        const menuUsr = document.getElementById("menu-item-usuarios");
        const menuParam = document.getElementById("menu-item-parametros");

        if (menuUsr) {
            if (isAdmin) menuUsr.classList.remove("hidden");
            else menuUsr.classList.add("hidden");
        }
        if (menuParam) {
            if (isAdmin) menuParam.classList.remove("hidden");
            else menuParam.classList.add("hidden");
        }

        // Poblar el select con roles permitidos si existe en el DOM
        const usrRolSelect = document.getElementById("usr-rol");
        if (usrRolSelect) {
            usrRolSelect.innerHTML = `<option value="">Seleccione un rol...</option>`;
            const allowedRoleNames = ["administrador_debil", "líder de comunidad", "lider de comunidad", "consultor"];
            roles.forEach(r => {
                if (allowedRoleNames.includes(r.nombre_rol.toLowerCase())) {
                    usrRolSelect.innerHTML += `<option value="${r.id_rol}">${r.nombre_rol}</option>`;
                }
            });
        }
    } catch (err) {
        console.error("Error al cargar roles:", err);
    }
}

export async function handleCrearUsuario(e) {
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

export async function handleEditarRolSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("edit-usr-id").value;
    const rol = document.getElementById("edit-usr-rol").value;
    try {
        await uiUpdateUserRole(id, rol);
    } catch (error) {
        showAlert(error.message, "error");
    }
}

export async function handleParamProfesionSubmit(e) {
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

export async function handleParamDiscapacidadSubmit(e) {
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

export async function handleCambioClaveSubmit(e) {
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

export async function handleForgotPasswordSubmit(e) {
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

export async function handleResetPasswordSubmit(e) {
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

export async function handleMisDatosSubmit(e) {
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


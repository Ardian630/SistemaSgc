import { showAlert, showConfirm } from "../../notifications.js";
import { getCurrentUser } from "../../auth.js";
import { dbFetchAll } from "./ui-common.js";
import {
    apiCreatePersona,
    apiUpdatePersona,
    apiDeletePersona,
    apiCreateNucleoSimple,
    apiUpdateNucleo,
    apiDeleteNucleo,
    apiAsociarPersonaNucleo,
    apiAsociarNucleoVivienda,
    apiCreateComunidad,
    apiUpdateComunidad,
    apiDeleteComunidad,
    apiGetEdificios,
    apiCreateEdificio,
    apiUpdateEdificio,
    apiDeleteEdificio,
    apiGetViviendas,
    apiCreateVivienda,
    apiUpdateVivienda,
    apiDeleteVivienda,
    apiCreateUsuario,
    apiDeleteUsuario
} from "../../supabase-client.js";
import { canUserModifyPersona, renderPersonasTable } from "./ui-personas.js";
import { renderDashboard } from "./ui-dashboard.js";
import { renderFamilias } from "./ui-familias-viviendas.js";
import { renderUsuariosTable } from "./ui-usuarios.js";
import { populatePersonaModalSelects, populateSelects } from "./ui-forms.js";

// =========================================================================
// OPERACIONES DE ESCRITURA Y CRUD
// =========================================================================

export async function uiCreatePersona(persona) {
    return await apiCreatePersona(persona);
}

export async function uiUpdatePersona(id, personaData) {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    const p = db.personas.find(x => x.id_persona === id);
    if (!p) throw new Error("Persona no encontrada.");

    if (!canUserModifyPersona(currentUser, p, db)) {
        throw new Error("Acción denegada: No tiene permisos para editar esta persona.");
    }

    await apiUpdatePersona(id, personaData);
}

export async function uiOpenEditPersonaModal(id) {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    const p = db.personas.find(x => x.id_persona === id);
    if (!p) return;

    if (!canUserModifyPersona(currentUser, p, db)) {
        showAlert("Acción denegada: No tiene permisos para editar esta persona.", "warning");
        return;
    }

    document.getElementById("persona-modal-title").textContent = "Editar Persona";
    document.getElementById("persona-id").value = p.id_persona;
    document.getElementById("persona-nombre").value = p.nombre_completo;
    document.getElementById("persona-tipo-cedula").value = p.tipo_cedula;
    document.getElementById("persona-cedula").value = p.cedula_identidad;
    document.getElementById("persona-fecha-nacimiento").value = p.fecha_nacimiento;
    document.getElementById("persona-genero").value = p.genero;
    document.getElementById("persona-telefono").value = p.telefono || "";
    document.getElementById("persona-email").value = p.email || "";

    await populatePersonaModalSelects();

    document.getElementById("persona-profesion").value = p.id_profesion || "";
    document.getElementById("persona-discapacidad").value = p.id_discapacidad || "";
    document.getElementById("persona-nucleo").value = p.id_nucleo || "";

    document.getElementById("modal-persona").classList.remove("hidden");
}

export async function uiCreateNucleo(nombreFam, idVivienda, idJefeFamilia) {
    // Al crear un núcleo, se registra sin jefe inicialmente para evitar errores de integridad
    await apiCreateNucleoSimple(nombreFam, idVivienda, null);
}

export async function uiCreateComunidad(nombre) {
    await apiCreateComunidad(nombre);
}

export async function uiCreateEdificio(nombre, idComunidad) {
    const edificios = await apiGetEdificios();
    const nameLower = nombre.trim().toLowerCase();
    const existe = edificios.some(ed => ed.id_comunidad === idComunidad && ed.nombre_edificio.toLowerCase() === nameLower);
    
    if (existe) {
        throw new Error("Ya existe un edificio/casa con este nombre en esta comunidad.");
    }
    await apiCreateEdificio(nombre, idComunidad);
}

export async function uiCreateVivienda(idComunidad, idEdificio, numero, bloque) {
    const viviendas = await apiGetViviendas();
    const numLower = numero.trim().toLowerCase();
    
    const existe = viviendas.some(v => 
        v.id_comunidad === idComunidad && 
        v.id_edificio === (idEdificio || null) && 
        v.numero_vivienda.toLowerCase() === numLower
    );

    if (existe) {
        throw new Error("Ya existe una vivienda con este número en el edificio o comunidad seleccionada.");
    }
    await apiCreateVivienda(idComunidad, idEdificio, numero, bloque);
}

export async function uiUpdateComunidad(id, nombre) {
    await apiUpdateComunidad(id, nombre);
}

export async function uiDeleteComunidad(id) {
    await apiDeleteComunidad(id);
}

export async function uiUpdateEdificio(id, idComunidad, nombre) {
    const edificios = await apiGetEdificios();
    const nameLower = nombre.trim().toLowerCase();
    const existe = edificios.some(ed => ed.id_comunidad === idComunidad && ed.nombre_edificio.toLowerCase() === nameLower && ed.id_edificio !== id);
    if (existe) throw new Error("Ya existe un edificio/casa con este nombre en esta comunidad.");
    
    await apiUpdateEdificio(id, idComunidad, nombre);
}

export async function uiDeleteEdificio(id) {
    await apiDeleteEdificio(id);
}

export async function uiUpdateVivienda(id, idComunidad, idEdificio, numero, bloque) {
    const viviendas = await apiGetViviendas();
    const numLower = numero.trim().toLowerCase();
    const existe = viviendas.some(v => 
        v.id_comunidad === idComunidad && 
        v.id_edificio === (idEdificio || null) && 
        v.numero_vivienda.toLowerCase() === numLower &&
        v.id_vivienda !== id
    );
    if (existe) throw new Error("Ya existe una vivienda con este número en el edificio o comunidad seleccionada.");
    
    await apiUpdateVivienda(id, idComunidad, idEdificio, numero, bloque);
}

export async function uiDeleteVivienda(id) {
    await apiDeleteVivienda(id);
}

export async function uiAsociarPersonaFamilia(personaId, familiaId) {
    await apiAsociarPersonaNucleo(personaId, familiaId);
}

export async function uiAsociarFamiliaVivienda(familiaId, viviendaId) {
    await apiAsociarNucleoVivienda(familiaId, viviendaId);
}

export async function uiCreateUsuario(usuario) {
    await apiCreateUsuario(usuario);
}

// =========================================================================
// DELETES
// =========================================================================

export async function uiDeletePersona(id) {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    const p = db.personas.find(x => x.id_persona === id);
    if (!p) return;

    if (!canUserModifyPersona(currentUser, p, db)) {
        showAlert("Acción denegada: No tiene permisos para eliminar esta persona.", "warning");
        return;
    }

    // Validar si es jefe de familia
    const isJefe = db.nucleos.some(n => n.id_jefe_familia === id);
    if (isJefe) {
        showAlert("No puede eliminar a esta persona porque es jefe de hogar de un núcleo familiar. Primero asigne un nuevo jefe de familia.", "warning");
        return;
    }

    if (await showConfirm("¿Está seguro de que desea eliminar a esta persona del censo?")) {
        try {
            await apiDeletePersona(id);
            await renderDashboard();
            await renderPersonasTable();
            await populateSelects();
            showAlert("Persona eliminada con éxito.", "success");
        } catch (err) {
            console.error(err);
            showAlert("Error al eliminar la persona: " + err.message, "error");
        }
    }
}

export async function uiDeleteFamilia(id) {
    if (await showConfirm("¿Está seguro de que desea desarmar este núcleo familiar?")) {
        try {
            await apiDeleteNucleo(id);
            await renderDashboard();
            await renderFamilias();
            await renderPersonasTable();
            await populateSelects();
            showAlert("Familia desarmada correctamente.", "success");
        } catch (err) {
            console.error(err);
            showAlert("Error al desarmar familia: " + err.message, "error");
        }
    }
}

export async function uiDeleteUsuario(id) {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    
    const weakRole = db.roles.find(r => r.nombre_rol.toLowerCase() === "administrador_debil");
    const adminRole = db.roles.find(r => r.nombre_rol === "Administrador");

    const targetUser = db.usuarios.find(u => u.id_usuario === id);
    if (!targetUser) return;

    // Verificar restricción: admin débil no puede eliminar administradores
    const currentRoleObj = db.roles.find(r => r.id_rol === currentUser.id_rol);
    const currentRoleName = currentRoleObj ? currentRoleObj.nombre_rol.toLowerCase() : "";
    
    if (currentRoleName === "administrador_debil") {
        const targetRoleObj = db.roles.find(r => r.id_rol === targetUser.id_rol);
        const targetRoleName = targetRoleObj ? targetRoleObj.nombre_rol.toLowerCase() : "";
        if (targetRoleName.includes("administrador") || targetRoleName.includes("admin")) {
            showAlert("Acción denegada: Un administrador débil no puede eliminar cuentas de administrador.", "warning");
            return;
        }
    }

    if (await showConfirm("¿Está seguro de que desea eliminar este usuario del sistema?")) {
        try {
            await apiDeleteUsuario(id);
            await renderUsuariosTable();
            await renderDashboard();
            showAlert("Usuario eliminado correctamente.", "success");
        } catch (err) {
            console.error(err);
            showAlert("Error al eliminar usuario: " + err.message, "error");
        }
    }
}

export async function uiUpdateFamily(id, nombre, viviendaId, jefeId) {
    if (jefeId) {
        const db = await dbFetchAll();
        const person = db.personas.find(p => p.id_persona === jefeId);
        if (person && person.id_nucleo !== id) {
            await apiAsociarPersonaNucleo(jefeId, id);
        }
    }
    await apiUpdateNucleo(id, {
        nombre_familia: nombre,
        id_vivienda: viviendaId || null,
        id_jefe_familia: jefeId || null
    });
}


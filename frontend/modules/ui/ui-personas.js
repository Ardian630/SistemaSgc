import { dbFetchAll, activeCommunity } from "./ui-common.js";
import { getCurrentUser } from "../../auth.js";
import { applyRoleUI_Restrictions } from "./ui-roles.js";
import { uiOpenEditPersonaModal, uiDeletePersona } from "./ui-crud.js";

// =========================================================================
// VERIFICACIÓN DE PERMISOS PARA EDITAR/ELIMINAR PERSONAS
// =========================================================================

export function canUserModifyPersona(currentUser, persona, db) {
    if (!currentUser) return false;

    const userRole = db && db.roles ? db.roles.find(r => r.id_rol === currentUser.id_rol) : null;
    const roleName = (userRole ? userRole.nombre_rol : (currentUser.nombre_rol || "")).toLowerCase();
    const roleId = String(currentUser.id_rol || "");

    // 1. Consultores: No pueden hacer cambios ni eliminar personas
    if (roleName.includes("consultor") || roleId === "73ef3e01-65ac-4891-8df9-91db1f6d364b" || roleId === "3" || roleId === "r-3") {
        return false;
    }

    // 2. Administradores: Tienen acceso total
    if (roleName.includes("administrador") || roleName.includes("admin") || roleId === "eec65b46-ce49-41be-9da7-be001e7ce87e" || roleId === "8c37a94d-7b05-42fc-9fdb-5e4eb8cee87f" || roleId === "1" || roleId === "r-1" || roleId === "r-4") {
        return true;
    }

    // 3. No administradores (ej. Líder de comunidad): deben pertenecer a la misma comunidad
    let personaCommId = null;
    if (persona && persona.id_nucleo && db && db.nucleos) {
        const family = db.nucleos.find(n => n.id_nucleo === persona.id_nucleo);
        if (family && family.id_vivienda && db.viviendas) {
            const housing = db.viviendas.find(v => v.id_vivienda === family.id_vivienda);
            if (housing) {
                personaCommId = housing.id_comunidad;
            }
        }
    }

    if (!currentUser.id_comunidad || !personaCommId || currentUser.id_comunidad !== personaCommId) {
        return false;
    }

    return true;
}

// =========================================================================
// FILTRADO DINÁMICO DE PERSONAS
// =========================================================================

export function getFilteredPersonas(db) {
    const filterText = document.getElementById("filter-cedula")?.value.toLowerCase().trim() || "";
    const filterAgeMin = document.getElementById("filter-edad-min")?.value || "";
    const filterAgeMax = document.getElementById("filter-edad-max")?.value || "";
    const filterGen = document.getElementById("filter-genero")?.value || "all";
    const filterHomeType = document.getElementById("filter-tipo-vivienda")?.value || "all";
    const filterDiscNivel = document.getElementById("filter-discapacidad-nivel")?.value || "all";

    const selectedDisabilities = Array.from(document.querySelectorAll(".filter-discapacidad-type:checked")).map(el => el.value);
    const selectedProfessions = Array.from(document.querySelectorAll(".filter-profesion-item:checked")).map(el => el.value);

    const currentYear = new Date().getFullYear();

    return db.personas.filter(p => {
        if (typeof activeCommunity !== 'undefined' && activeCommunity !== "all") {
            const family = db.nucleos.find(n => n.id_nucleo === p.id_nucleo);
            if (!family) return false;
            const housing = db.viviendas.find(v => v.id_vivienda === family.id_vivienda);
            if (!housing || housing.id_comunidad !== activeCommunity) return false;
        }

        if (filterText) {
            const matchCed = p.cedula_identidad.includes(filterText);
            const matchName = p.nombre_completo.toLowerCase().includes(filterText);
            if (!matchCed && !matchName) return false;
        }

        const birthYear = new Date(p.fecha_nacimiento).getFullYear();
        const age = currentYear - birthYear;
        if (filterAgeMin && age < parseInt(filterAgeMin)) return false;
        if (filterAgeMax && age > parseInt(filterAgeMax)) return false;

        if (filterGen !== "all" && p.genero !== filterGen) return false;

        if (filterHomeType !== "all") {
            const family = db.nucleos.find(n => n.id_nucleo === p.id_nucleo);
            if (!family || !family.id_vivienda) return false;
            const housing = db.viviendas.find(v => v.id_vivienda === family.id_vivienda);
            if (!housing) return false;
            
            if (filterHomeType === "casa" && housing.id_edificio !== null) return false;
            if (filterHomeType === "apartamento" && housing.id_edificio === null) return false;
        }

        if (selectedDisabilities.length > 0) {
            if (p.id_discapacidad === null) return false;
            const discObj = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
            if (!discObj || !selectedDisabilities.includes(discObj.tipo_discapacidad)) return false;
        }

        if (filterDiscNivel !== "all") {
            if (p.id_discapacidad === null) return false;
            const discObj = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
            if (!discObj || discObj.nivel_discapacidad !== filterDiscNivel) return false;
        }

        if (selectedProfessions.length > 0) {
            if (p.id_profesion === null || !selectedProfessions.includes(p.id_profesion)) return false;
        }

        return true;
    });
}

// =========================================================================
// RENDERIZADO DEL CENSO CON FILTROS COMBINADOS
// =========================================================================

export async function renderPersonasTable() {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    
    const body = document.getElementById("personas-table-body");
    const emptyState = document.getElementById("personas-empty-state");
    const table = document.getElementById("personas-table");

    body.innerHTML = "";

    const filtered = getFilteredPersonas(db);

    if (filtered.length === 0) {
        table.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    table.classList.remove("hidden");
    emptyState.classList.add("hidden");

    const currentYear = new Date().getFullYear();

    filtered.forEach(p => {
        const birthYear = new Date(p.fecha_nacimiento).getFullYear();
        const age = currentYear - birthYear;

        const family = db.nucleos.find(n => n.id_nucleo === p.id_nucleo);
        const familyName = family ? family.nombre_familia : "Suelto (Sin familia)";
        
        let housingText = "No asignada";
        let communityName = "Sin comunidad";
        if (family && family.id_vivienda) {
            const housing = db.viviendas.find(v => v.id_vivienda === family.id_vivienda);
            if (housing) {
                const comm = db.comunidades.find(c => c.id_comunidad === housing.id_comunidad);
                communityName = comm ? comm.nombre_comunidad : "Comunidad";
                const edif = housing.id_edificio ? db.edificios.find(e => e.id_edificio === housing.id_edificio) : null;
                housingText = `${housing.numero_vivienda} ${edif ? '(' + edif.nombre_edificio + ')' : '(Casa)'}`;
            }
        }

        const isJefe = family && family.id_jefe_familia === p.id_persona;
        const profObj = db.profesiones.find(prof => prof.id_profesion === p.id_profesion);
        const profName = profObj ? profObj.nombre_profesion : "Ninguno";

        const discObj = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
        let discBadge = "";
        if (discObj) {
            discBadge = `<span class="table-badge orange" title="${discObj.tipo_discapacidad} (${discObj.nivel_discapacidad})">${discObj.tipo_discapacidad}</span>`;
        } else {
            discBadge = `<span class="table-badge green">Saludable</span>`;
        }

        let actionsHtml = "";
        const canModify = canUserModifyPersona(currentUser, p, db);
        if (canModify) {
            actionsHtml = `
                <button class="btn btn-primary btn-edit-person" data-id="${p.id_persona}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Editar
                </button>
                <button class="btn btn-danger btn-delete-person" data-id="${p.id_persona}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Eliminar
                </button>
            `;
        } else {
            actionsHtml = `<span class="table-subtext">Sin permisos</span>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${p.tipo_cedula}-${p.cedula_identidad}</strong></td>
            <td>
                <div>${p.nombre_completo}</div>
                ${isJefe ? '<div style="margin-top: 3px;"><span class="table-badge blue">Jefe Hogar</span></div>' : ''}
            </td>
            <td>${age} años (${p.genero})</td>
            <td>
                <div>${communityName}</div>
                <div class="table-subtext">${housingText}</div>
            </td>
            <td>${familyName}</td>
            <td>
                <div>${profName}</div>
                <div style="margin-top: 3px;">${discBadge}</div>
            </td>
            <td>
                <div class="table-actions">
                    ${actionsHtml}
                </div>
            </td>
        `;
        body.appendChild(tr);
    });

    // Asegurar que el recuadro comience al inicio a la izquierda
    const tableContainer = table?.closest(".table-container");
    if (tableContainer) tableContainer.scrollLeft = 0;

    // Eventos de edición y eliminación
    document.querySelectorAll(".btn-edit-person").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
            uiOpenEditPersonaModal(id);
        });
    });

    document.querySelectorAll(".btn-delete-person").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
            uiDeletePersona(id);
        });
    });
    await applyRoleUI_Restrictions();
}


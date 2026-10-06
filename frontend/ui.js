import { showAlert, showConfirm } from './notifications.js';
import { 
    isSupabaseConnected,
    apiGetRoles,
    apiGetComunidades,
    apiGetEdificios,
    apiGetViviendas,
    apiGetNucleos,
    apiGetProfesiones,
    apiGetDiscapacidades,
    apiGetPersonas,
    apiGetUsuarios,
    apiCreateComunidad,
    apiCreateEdificio,
    apiCreateVivienda,
    apiCreateNucleoYJefe,
    apiCreateNucleoSimple,
    apiDeleteNucleo,
    apiUpdateNucleo,
    apiCreatePersona,
    apiUpdatePersona,
    apiAsociarPersonaNucleo,
    apiAsociarNucleoVivienda,
    apiDeletePersona,
    apiCreateUsuario,
    apiDeleteUsuario,
    apiCreateProfesion,
    apiUpdateProfesion,
    apiDeleteProfesion,
    apiCreateDiscapacidad,
    apiUpdateDiscapacidad,
    apiDeleteDiscapacidad,
    apiResetPasswordForEmail,
    apiUpdatePassword,
    apiUpdateMisDatos as apiUpdateMisDatosClient,
    apiUpdateUserRole as apiUpdateUserRoleClient,
    apiUpdateComunidad,
    apiDeleteComunidad,
    apiUpdateEdificio,
    apiDeleteEdificio,
    apiUpdateVivienda,
    apiDeleteVivienda
} from "./supabase-client.js";

import { getCurrentUser } from "./auth.js";

// Variable global de filtro de comunidad activa
let activeCommunity = "all";

export function getActiveCommunity() {
    return activeCommunity;
}

export function setActiveCommunity(comm) {
    activeCommunity = comm;
}

// =========================================================================
// OBTENCIÓN UNIFICADA DE DATOS (SOLO SUPABASE)
// =========================================================================

export async function dbFetchAll() {
    if (!isSupabaseConnected()) {
        console.error("Supabase no está conectado. Configure las credenciales en supabase-client.js.");
        return { roles: [], comunidades: [], edificios: [], viviendas: [], nucleos: [], profesiones: [], discapacidades: [], personas: [], usuarios: [] };
    }

    const [roles, comunidades, edificios, viviendas, nucleos, profesiones, discapacidades, personas, usuarios] = await Promise.all([
        apiGetRoles(),
        apiGetComunidades(),
        apiGetEdificios(),
        apiGetViviendas(),
        apiGetNucleos(),
        apiGetProfesiones(),
        apiGetDiscapacidades(),
        apiGetPersonas(),
        apiGetUsuarios()
    ]);
    return { roles, comunidades, edificios, viviendas, nucleos, profesiones, discapacidades, personas, usuarios };
}

// =========================================================================
// RENDERIZADO DEL DASHBOARD
// =========================================================================

export async function renderDashboard() {
    const db = await dbFetchAll();
    
    const filteredViviendas = activeCommunity === "all" ? db.viviendas : db.viviendas.filter(v => v.id_comunidad === activeCommunity);
    const filteredViviendasIds = filteredViviendas.map(v => v.id_vivienda);
    
    const filteredNucleos = activeCommunity === "all" ? db.nucleos : db.nucleos.filter(n => filteredViviendasIds.includes(n.id_vivienda));
    const filteredNucleosIds = filteredNucleos.map(n => n.id_nucleo);
    
    const filteredPersonas = activeCommunity === "all" ? db.personas : db.personas.filter(p => filteredNucleosIds.includes(p.id_nucleo));
    const disabledCount = filteredPersonas.filter(p => p.id_discapacidad !== null).length;

    // Actualizar UI
    document.getElementById("stat-total-personas").textContent = filteredPersonas.length;
    document.getElementById("stat-total-familias").textContent = filteredNucleos.length;
    document.getElementById("stat-total-viviendas").textContent = filteredViviendas.length;
    document.getElementById("stat-total-discapacidades").textContent = disabledCount;

    const totalP = filteredPersonas.length || 1;
    const femaleCount = filteredPersonas.filter(p => p.genero === "Femenino").length;
    const maleCount = filteredPersonas.filter(p => p.genero === "Masculino").length;
    
    const femalePct = Math.round((femaleCount / totalP) * 100);
    const malePct = Math.round((maleCount / totalP) * 100);

    document.getElementById("gender-pct-female").textContent = `${femalePct}% (${femaleCount})`;
    document.getElementById("gender-fill-female").style.width = `${femalePct}%`;
    document.getElementById("gender-pct-male").textContent = `${malePct}% (${maleCount})`;
    document.getElementById("gender-fill-male").style.width = `${malePct}%`;

    // Renderizar pirámide demográfica
    const container = document.getElementById("age-bars-container");
    container.innerHTML = "";

    const ranges = [
        { label: "Niños (0-12)", min: 0, max: 12 },
        { label: "Jóvenes (13-25)", min: 13, max: 25 },
        { label: "Adultos (26-59)", min: 26, max: 59 },
        { label: "Adulto Mayor (60+)", min: 60, max: 200 }
    ];

    const currentYear = new Date().getFullYear();

    let counts = ranges.map(range => {
        let count = filteredPersonas.filter(p => {
            const birthYear = new Date(p.fecha_nacimiento).getFullYear();
            const age = currentYear - birthYear;
            return age >= range.min && age <= range.max;
        }).length;
        return { label: range.label, count };
    });

    const maxCount = Math.max(...counts.map(c => c.count), 1);

    counts.forEach(item => {
        const pct = (item.count / maxCount) * 100;
        const row = document.createElement("div");
        row.className = "age-bar-row";
        row.innerHTML = `
            <span class="age-label">${item.label}</span>
            <div class="age-track">
                <div class="age-fill" style="width: ${pct}%;"></div>
            </div>
            <span class="age-count">${item.count}</span>
        `;
        container.appendChild(row);
    });

    // Líderes
    const listContainer = document.getElementById("dashboard-leaders-list");
    listContainer.innerHTML = "";
    
    // Buscar rol con nombre "Líder de comunidad" en db.roles
    const leaderRole = db.roles.find(r => r.nombre_rol.toLowerCase().includes("lider") || r.nombre_rol.toLowerCase().includes("líder"));
    const leaders = db.usuarios.filter(u => u.id_rol === (leaderRole ? leaderRole.id_rol : "r-2"));

    if (leaders.length === 0) {
        listContainer.innerHTML = `<p class="text-muted">No hay líderes asignados registrados.</p>`;
        return;
    }

    leaders.forEach(l => {
        const comm = db.comunidades.find(c => c.id_comunidad === l.id_comunidad);
        const commName = comm ? comm.nombre_comunidad : "Sin asignar";
        const initials = l.nombre_completo.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

        const card = document.createElement("div");
        card.className = "leader-item";
        card.innerHTML = `
            <div class="leader-avatar">${initials}</div>
            <div class="leader-details">
                <span class="leader-name">${l.nombre_completo}</span>
                <span class="leader-comm" style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${commName} | 
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${l.telefono || 'Sin tlf'}
                </span>
            </div>
        `;
        listContainer.appendChild(card);
    });
    
    await applyRoleUI_Restrictions();
}

// =========================================================================
// VERIFICACIÓN DE PERMISOS PARA EDITAR/ELIMINAR PERSONAS
// =========================================================================

export function canUserModifyPersona(currentUser, persona, db) {
    if (!currentUser) return false;

    const userRole = db.roles.find(r => r.id_rol === currentUser.id_rol);
    const roleName = userRole ? userRole.nombre_rol.toLowerCase() : "";

    // 1. Consultores: No pueden hacer cambios ni eliminar personas
    if (roleName.includes("consultor")) {
        return false;
    }

    // 2. Administradores: Tienen acceso total
    if (roleName.includes("administrador") || roleName.includes("admin")) {
        return true;
    }

    // 3. No administradores (ej. Líder de comunidad): deben pertenecer a la misma comunidad
    let personaCommId = null;
    if (persona.id_nucleo) {
        const family = db.nucleos.find(n => n.id_nucleo === persona.id_nucleo);
        if (family && family.id_vivienda) {
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
                <button class="btn btn-primary btn-edit-person" data-id="${p.id_persona}" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;">Editar</button>
                <button class="btn btn-secondary btn-delete-person" data-id="${p.id_persona}" style="padding: 4px 8px; font-size: 11px;">Eliminar</button>
            `;
        } else {
            actionsHtml = `<span style="color: var(--text-muted); font-size: 12px;">Sin permisos</span>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${p.tipo_cedula}-${p.cedula_identidad}</strong></td>
            <td>
                ${p.nombre_completo}
                ${isJefe ? '<span class="table-badge blue" style="font-size: 8px; padding: 2px 4px; margin-left: 6px;">Jefe Hogar</span>' : ''}
            </td>
            <td>${age} años (${p.genero})</td>
            <td>
                <div>${communityName}</div>
                <small style="color: var(--text-secondary);">${housingText}</small>
            </td>
            <td><small>${familyName}</small></td>
            <td>
                <div>${profName}</div>
                <div style="margin-top: 4px;">${discBadge}</div>
            </td>
            <td class="table-actions">
                ${actionsHtml}
            </td>
        `;
        body.appendChild(tr);
    });

    // Eventos de edición y eliminación
    document.querySelectorAll(".btn-edit-person").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            uiOpenEditPersonaModal(id);
        });
    });

    document.querySelectorAll(".btn-delete-person").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            uiDeletePersona(id);
        });
    });
    await applyRoleUI_Restrictions();
}

// =========================================================================
// RENDERIZADO DE FAMILIAS Y VIVIENDAS
// =========================================================================

export async function renderFamilias() {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    
    const grid = document.getElementById("families-cards-grid");
    grid.innerHTML = "";

    const filteredViviendas = activeCommunity === "all" ? db.viviendas : db.viviendas.filter(v => v.id_comunidad === activeCommunity);
    const filteredViviendasIds = filteredViviendas.map(v => v.id_vivienda);
    const filteredNucleos = activeCommunity === "all" ? db.nucleos : db.nucleos.filter(n => filteredViviendasIds.includes(n.id_vivienda));

    if (filteredNucleos.length === 0) {
        grid.innerHTML = `<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 48px;">No hay núcleos familiares registrados en esta comunidad.</p>`;
        return;
    }

    const adminRole = db.roles.find(r => r.nombre_rol === "Administrador");
    const weakRole = db.roles.find(r => r.nombre_rol === "administrador_debil");
    const leaderRole = db.roles.find(r => r.nombre_rol === "Líder de comunidad");

    filteredNucleos.forEach(n => {
        const housing = db.viviendas.find(v => v.id_vivienda === n.id_vivienda);
        let locationText = "Sin vivienda asignada";
        if (housing) {
            const edif = housing.id_edificio ? db.edificios.find(e => e.id_edificio === housing.id_edificio) : null;
            const comm = db.comunidades.find(c => c.id_comunidad === housing.id_comunidad);
            locationText = `${comm ? comm.nombre_comunidad : 'Comunidad'} - ${housing.numero_vivienda} ${edif ? '(' + edif.nombre_edificio + ')' : '(Casa)'}`;
        }

        const members = db.personas.filter(p => p.id_nucleo === n.id_nucleo);

        let membersHtml = "";
        members.forEach(m => {
            const isJefe = n.id_jefe_familia === m.id_persona;
            membersHtml += `
                <div class="member-row">
                    <span class="member-name">${m.nombre_completo}</span>
                    <span class="member-role-badge ${isJefe ? 'jefe' : ''}">${isJefe ? 'Jefe' : 'Carga'}</span>
                </div>
            `;
        });

        if (members.length === 0) {
            membersHtml = `<div class="member-row" style="color: var(--text-muted);">Sin miembros registrados</div>`;
        }

        let deleteBtnHtml = "";
        const roleId = currentUser.id_rol;
        let editBtnHtml = "";
        if (roleId === adminRole?.id_rol || roleId === weakRole?.id_rol || roleId === leaderRole?.id_rol || roleId === "r-1") {
            deleteBtnHtml = `<button class="btn btn-secondary btn-delete-family" data-id="${n.id_nucleo}" style="padding: 4px 8px; font-size: 11px;">Desarmar</button>`;
            editBtnHtml = `<button class="btn btn-primary btn-edit-family" data-id="${n.id_nucleo}" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;">Editar</button>`;
        }

        const hasNoJefe = !n.id_jefe_familia;
        const warningIconHtml = hasNoJefe ? `<span class="no-jefe-warning" title="Ausencia de jefe de familia en ese núcleo familiar" style="cursor: help; margin-left: 6px; font-weight: bold;">!</span>` : '';

        const card = document.createElement("div");
        card.className = "family-card";
        card.innerHTML = `
            <div class="family-card-header">
                <div class="family-title-box">
                    <span class="family-name" style="display: flex; align-items: center;">${n.nombre_familia} ${warningIconHtml}</span>
                    <span class="family-house">Ubicación: ${locationText}</span>
                </div>
                <div>
                    ${editBtnHtml}
                    ${deleteBtnHtml}
                </div>
            </div>
            <div class="family-card-body">
                <div class="members-list">
                    ${membersHtml}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Wire desarmar
    document.querySelectorAll(".btn-delete-family").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            uiDeleteFamilia(id);
        });
    });

    // Wire editar
    document.querySelectorAll(".btn-edit-family").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            uiOpenEditFamilyModal(id);
        });
    });

    populateSelects();
    await applyRoleUI_Restrictions();
}

export async function renderViviendasTree() {
    const db = await dbFetchAll();
    const tree = document.getElementById("geography-tree-view");
    tree.innerHTML = "";

    const activeComs = activeCommunity === "all" ? db.comunidades : db.comunidades.filter(c => c.id_comunidad === activeCommunity);

    if (activeComs.length === 0) {
        tree.innerHTML = `<p class="text-muted">No hay comunidades registradas.</p>`;
        return;
    }

    activeComs.forEach(c => {
        const comNode = document.createElement("div");
        comNode.className = "tree-node root";
        comNode.innerHTML = `
            <span class="tree-node-title">Comunidad: ${c.nombre_comunidad}
                <span style="margin-left: 10px; font-weight: normal;">
                    <a href="#" onclick="event.preventDefault(); window.editComunidad('${c.id_comunidad}')" style="color: var(--primary); margin-right: 8px; text-decoration: none; font-size: 18px;" title="Editar">✎</a>
                    <a href="#" onclick="event.preventDefault(); window.deleteComunidad('${c.id_comunidad}')" style="color: #dc2626; text-decoration: none; font-size: 18px;" title="Borrar">🗑</a>
                </span>
            </span>`;

        const commEdifs = db.edificios.filter(e => e.id_comunidad === c.id_comunidad);
        commEdifs.forEach(e => {
            const edifNode = document.createElement("div");
            edifNode.className = "tree-node";
            edifNode.innerHTML = `
                <span class="tree-node-title">Edificio: ${e.nombre_edificio}
                    <span style="margin-left: 10px; font-weight: normal;">
                        <a href="#" onclick="event.preventDefault(); window.editEdificio('${e.id_edificio}')" style="color: var(--primary); margin-right: 8px; text-decoration: none; font-size: 18px;" title="Editar">✎</a>
                        <a href="#" onclick="event.preventDefault(); window.deleteEdificio('${e.id_edificio}')" style="color: #dc2626; text-decoration: none; font-size: 18px;" title="Borrar">🗑</a>
                    </span>
                </span>`;

            const edifViviendas = db.viviendas.filter(v => v.id_edificio === e.id_edificio);
            edifViviendas.forEach(v => {
                const vivNode = document.createElement("div");
                vivNode.className = "tree-node";
                
                const vFamilies = db.nucleos.filter(n => n.id_vivienda === v.id_vivienda);
                const famNames = vFamilies.map(n => n.nombre_familia).join(", ") || "Desocupada";
                
                vivNode.innerHTML = `
                    <span class="tree-node-title" style="font-weight: normal;">Vivienda: ${v.numero_vivienda} (${famNames})
                        <span style="margin-left: 10px; font-weight: normal;">
                            <a href="#" onclick="event.preventDefault(); window.editVivienda('${v.id_vivienda}')" style="color: var(--primary); margin-right: 8px; text-decoration: none; font-size: 18px;" title="Editar">✎</a>
                            <a href="#" onclick="event.preventDefault(); window.deleteVivienda('${v.id_vivienda}')" style="color: #dc2626; text-decoration: none; font-size: 18px;" title="Borrar">🗑</a>
                        </span>
                    </span>`;
                edifNode.appendChild(vivNode);
            });

            comNode.appendChild(edifNode);
        });

        const houses = db.viviendas.filter(v => v.id_comunidad === c.id_comunidad && v.id_edificio === null);
        houses.forEach(v => {
            const houseNode = document.createElement("div");
            houseNode.className = "tree-node";
            
            const vFamilies = db.nucleos.filter(n => n.id_vivienda === v.id_vivienda);
            const famNames = vFamilies.map(n => n.nombre_familia).join(", ") || "Desocupada";
            
            houseNode.innerHTML = `
                <span class="tree-node-title" style="font-weight: normal; background-color: rgba(16, 185, 129, 0.05);">Casa: ${v.numero_vivienda} (${famNames})
                    <span style="margin-left: 10px; font-weight: normal;">
                        <a href="#" onclick="event.preventDefault(); window.editVivienda('${v.id_vivienda}')" style="color: var(--primary); margin-right: 8px; text-decoration: none; font-size: 18px;" title="Editar">✎</a>
                        <a href="#" onclick="event.preventDefault(); window.deleteVivienda('${v.id_vivienda}')" style="color: #dc2626; text-decoration: none; font-size: 18px;" title="Borrar">🗑</a>
                    </span>
                </span>`;
            comNode.appendChild(houseNode);
        });

        tree.appendChild(comNode);
    });

    await applyRoleUI_Restrictions();
}

// =========================================================================
// RENDERIZADO TABLA USUARIOS (ADMIN PANEL)
// =========================================================================

export async function renderUsuariosTable() {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    
    // Lider no puede ver o administrar usuarios
    if (currentUser?.nombre_rol?.toLowerCase().includes("lider")) {
        return;
    }
    
    const body = document.getElementById("usuarios-table-body");
    if (!body) return;
    body.innerHTML = "";

    const filteredUsrs = activeCommunity === "all" ? db.usuarios : db.usuarios.filter(u => u.id_comunidad === activeCommunity || u.id_comunidad === null);

    // Obtener roles de admin
    const adminRole = db.roles.find(r => r.nombre_rol === "Administrador");
    const weakRole = db.roles.find(r => r.nombre_rol === "administrador_debil");

    filteredUsrs.forEach(u => {
        const roleObj = db.roles.find(r => r.id_rol === u.id_rol);
        const roleName = roleObj ? roleObj.nombre_rol : "Desconocido";

        const comm = db.comunidades.find(c => c.id_comunidad === u.id_comunidad);
        const commName = comm ? comm.nombre_comunidad : "Global / Todo";

        let showDelete = true;
        let deleteDisabled = false;
        let tooltipText = "";

        if (currentUser.id_usuario === u.id_usuario) {
            showDelete = false;
        } else if (currentUser.id_rol === weakRole?.id_rol || currentUser.id_rol === "r-4") {
            if (u.id_rol === adminRole?.id_rol || u.id_rol === weakRole?.id_rol || u.id_rol === "r-1") {
                deleteDisabled = true;
                tooltipText = "Débil no puede borrar administradores";
            }
        }

        let showEditRole = false;
        if (currentUser.id_rol === adminRole?.id_rol || currentUser.id_rol === "r-1") {
            if (u.id_usuario !== currentUser.id_usuario) showEditRole = true;
        } else if (currentUser.id_rol === weakRole?.id_rol || currentUser.id_rol === "r-4") {
            if (u.id_rol !== adminRole?.id_rol && u.id_rol !== "r-1" && u.id_rol !== weakRole?.id_rol && u.id_rol !== "r-4") {
                showEditRole = true;
            }
        }

        let buttonHtml = "";
        if (showDelete) {
            buttonHtml += `<button class="btn btn-secondary btn-delete-user" data-id="${u.id_usuario}"
                            ${deleteDisabled ? 'disabled title="' + tooltipText + '" style="opacity: 0.5; cursor: not-allowed;"' : ''}>Eliminar</button>`;
        } else {
            buttonHtml += `<span style="color: var(--text-muted); font-size: 11px;">Sesión Activa</span>`;
        }

        if (showEditRole) {
            buttonHtml += ` <button class="btn btn-outline btn-edit-user-role" data-id="${u.id_usuario}" style="padding: 4px 8px; font-size: 11px; margin-left: 4px;">Editar Rol</button>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${u.nombre_completo}</strong></td>
            <td>
                <div>${u.email}</div>
                <small style="color: var(--text-secondary);">${u.telefono || 'Sin tlf'}</small>
            </td>
            <td><span class="table-badge ${u.id_rol === adminRole?.id_rol || u.id_rol === 'r-1' ? 'blue' : 'green'}">${roleName}</span></td>
            <td>${commName}</td>
            <td class="table-actions">
                ${buttonHtml}
            </td>
        `;
        body.appendChild(tr);
    });

    // Wire delete
    document.querySelectorAll(".btn-delete-user").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            uiDeleteUsuario(id);
        });
    });

    // Wire edit role
    document.querySelectorAll(".btn-edit-user-role").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            uiOpenEditRoleModal(id);
        });
    });
    await applyRoleUI_Restrictions();
}

// =========================================================================
// MÉTODOS DE LLENADO DE CONTROLES E INPUTS
// =========================================================================

export async function populateSelects() {
    const db = await dbFetchAll();
    
    const currentUser = getCurrentUser();
    const userRole = db.roles.find(r => r.id_rol === currentUser?.id_rol);
    const roleName = userRole ? userRole.nombre_rol.toLowerCase() : "";
    const isLider = roleName.includes("lider") || roleName.includes("líder");

    const activeCommSelect = document.getElementById("active-community-select");
    const currentVal = activeCommSelect.value;
    
    if (isLider && currentUser.id_comunidad) {
        activeCommSelect.innerHTML = "";
        const c = db.comunidades.find(x => x.id_comunidad === currentUser.id_comunidad);
        if (c) activeCommSelect.innerHTML = `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
        activeCommSelect.value = currentUser.id_comunidad;
        activeCommSelect.disabled = true;
        window.activeCommunity = currentUser.id_comunidad;
    } else {
        activeCommSelect.innerHTML = `<option value="all">Todas las Comunidades</option>`;
        db.comunidades.forEach(c => {
            activeCommSelect.innerHTML += `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
        });
        activeCommSelect.value = currentVal || "all";
        activeCommSelect.disabled = false;
    }

    const usrCommSelect = document.getElementById("usr-comunidad");
    if (usrCommSelect) {
        usrCommSelect.innerHTML = `<option value="">Sin comunidad</option>`;
        db.comunidades.forEach(c => {
            usrCommSelect.innerHTML += `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
        });
    }

    const regCommSelect = document.getElementById("reg-comunidad");
    if(regCommSelect) {
        regCommSelect.innerHTML = `<option value="">Ninguna / No aplica</option>`;
        db.comunidades.forEach(c => {
            regCommSelect.innerHTML += `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
        });
    }

    const edfCommSelect = document.getElementById("edf-comunidad");
    if(edfCommSelect) {
        edfCommSelect.innerHTML = `<option value="">Seleccione comunidad...</option>`;
        db.comunidades.forEach(c => {
            if (isLider && currentUser.id_comunidad && c.id_comunidad !== currentUser.id_comunidad) return;
            edfCommSelect.innerHTML += `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
        });
        if (isLider && currentUser.id_comunidad) {
            edfCommSelect.value = currentUser.id_comunidad;
            edfCommSelect.disabled = true;
        } else {
            edfCommSelect.disabled = false;
        }
    }

    const assocPersonaSelect = document.getElementById("asociar-persona-select");
    assocPersonaSelect.innerHTML = `<option value="">Seleccione una persona...</option>`;
    db.personas.filter(p => p.id_nucleo === null).forEach(p => {
        assocPersonaSelect.innerHTML += `<option value="${p.id_persona}">${p.tipo_cedula}-${p.cedula_identidad} - ${p.nombre_completo}</option>`;
    });

    const assocFamSelect = document.getElementById("asociar-familia-select");
    assocFamSelect.innerHTML = `<option value="">Seleccione una familia...</option>`;
    db.nucleos.forEach(n => {
        assocFamSelect.innerHTML += `<option value="${n.id_nucleo}">${n.nombre_familia}</option>`;
    });

    const assocFamVivSelect = document.getElementById("vivienda-asoc-familia");
    assocFamVivSelect.innerHTML = `<option value="">Seleccione núcleo o persona suelta...</option>`;
    
    let filteredNucleosForAssoc = db.nucleos;
    if (isLider) {
        if (currentUser.id_comunidad) {
            filteredNucleosForAssoc = db.nucleos.filter(n => {
                if (!n.id_vivienda) return true;
                const viv = db.viviendas.find(v => v.id_vivienda === n.id_vivienda);
                return viv && viv.id_comunidad === currentUser.id_comunidad;
            });
        } else {
            filteredNucleosForAssoc = [];
        }
    }

    const optGroupFam = document.createElement("optgroup");
    optGroupFam.label = "Núcleos Familiares";
    filteredNucleosForAssoc.forEach(n => {
        optGroupFam.innerHTML += `<option value="fam_${n.id_nucleo}">${n.nombre_familia}</option>`;
    });
    assocFamVivSelect.appendChild(optGroupFam);

    const optGroupPers = document.createElement("optgroup");
    optGroupPers.label = "Personas sueltas (Creará núcleo de 1)";
    db.personas.filter(p => p.id_nucleo === null).forEach(p => {
        optGroupPers.innerHTML += `<option value="per_${p.id_persona}">${p.nombre_completo}</option>`;
    });
    assocFamVivSelect.appendChild(optGroupPers);

    const assocVivSelect = document.getElementById("vivienda-asoc-vivienda");
    assocVivSelect.innerHTML = `<option value="">Seleccione vivienda...</option>`;
    
    let filteredViviendasForAssoc = db.viviendas;
    if (isLider) {
        if (currentUser.id_comunidad) {
            filteredViviendasForAssoc = db.viviendas.filter(v => v.id_comunidad === currentUser.id_comunidad);
        } else {
            filteredViviendasForAssoc = [];
        }
    }
    
    filteredViviendasForAssoc.forEach(v => {
        const comm = db.comunidades.find(c => c.id_comunidad === v.id_comunidad);
        const edif = v.id_edificio ? db.edificios.find(e => e.id_edificio === v.id_edificio) : null;
        const text = `${comm ? comm.nombre_comunidad : 'S/C'} - ${v.numero_vivienda} ${edif ? '(' + edif.nombre_edificio + ')' : '(Casa)'}`;
        assocVivSelect.innerHTML += `<option value="${v.id_vivienda}">${text}</option>`;
    });
}

export async function populateProfessionsChecklist() {
    const db = await dbFetchAll();
    const listContainer = document.getElementById("filter-profesiones-list");
    listContainer.innerHTML = "";

    db.profesiones.forEach(p => {
        const label = document.createElement("label");
        label.className = "checkbox-item";
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "6px";
        label.style.fontSize = "12px";
        label.style.fontWeight = "500";
        label.innerHTML = `<input type="checkbox" value="${p.id_profesion}" class="filter-profesion-item"> ${p.nombre_profesion}`;
        listContainer.appendChild(label);
        
        label.querySelector("input").addEventListener("change", renderPersonasTable);
    });
}

export async function populatePersonaModalSelects() {
    const db = await dbFetchAll();
    
    const profSelect = document.getElementById("persona-profesion");
    profSelect.innerHTML = `<option value="">Ninguna / Desempleado</option>`;
    db.profesiones.forEach(p => {
        profSelect.innerHTML += `<option value="${p.id_profesion}">${p.nombre_profesion}</option>`;
    });

    const discSelect = document.getElementById("persona-discapacidad");
    discSelect.innerHTML = `<option value="">Ninguna</option>`;
    db.discapacidades.forEach(d => {
        discSelect.innerHTML += `<option value="${d.id_discapacidad}">${d.tipo_discapacidad} (${d.nivel_discapacidad})</option>`;
    });

    const nucSelect = document.getElementById("persona-nucleo");
    nucSelect.innerHTML = "";
    
    const { getCurrentUser } = await import('./auth.js').catch(() => window);
    const currentUser = getCurrentUser ? getCurrentUser() : null;
    const userRole = currentUser ? db.roles.find(r => r.id_rol === currentUser.id_rol) : null;
    const roleName = userRole ? userRole.nombre_rol.toLowerCase() : "";
    const isLider = roleName.includes("lider");

    if (!isLider) {
        nucSelect.innerHTML += `<option value="">Ninguno - Registrar suelto</option>`;
        nucSelect.required = false;
    } else {
        nucSelect.innerHTML += `<option value="">Seleccione a dónde asociar...</option>`;
        nucSelect.required = true;
    }

    let filteredNucleos = db.nucleos;
    let filteredViviendas = db.viviendas;

    if (isLider) {
        if (currentUser.id_comunidad) {
            filteredViviendas = db.viviendas.filter(v => v.id_comunidad === currentUser.id_comunidad);
            filteredNucleos = db.nucleos.filter(n => {
                if (!n.id_vivienda) return true;
                const viv = db.viviendas.find(v => v.id_vivienda === n.id_vivienda);
                return viv && viv.id_comunidad === currentUser.id_comunidad;
            });
        } else {
            filteredViviendas = [];
            filteredNucleos = [];
        }
    }

    const optGroupFam = document.createElement("optgroup");
    optGroupFam.label = "Núcleos Familiares";
    filteredNucleos.forEach(n => {
        optGroupFam.innerHTML += `<option value="fam_${n.id_nucleo}">${n.nombre_familia}</option>`;
    });
    nucSelect.appendChild(optGroupFam);

    const optGroupViv = document.createElement("optgroup");
    optGroupViv.label = "Viviendas (Creará núcleo propio)";
    filteredViviendas.forEach(v => {
        const comm = db.comunidades.find(c => c.id_comunidad === v.id_comunidad);
        const edif = v.id_edificio ? db.edificios.find(e => e.id_edificio === v.id_edificio) : null;
        const text = `${comm ? comm.nombre_comunidad : 'S/C'} - ${v.numero_vivienda} ${edif ? '(' + edif.nombre_edificio + ')' : '(Casa)'}`;
        optGroupViv.innerHTML += `<option value="viv_${v.id_vivienda}">${text}</option>`;
    });
    nucSelect.appendChild(optGroupViv);
}

export async function populateFamiliaModalSelects() {
    const db = await dbFetchAll();
    
    const jefeSelect = document.getElementById("fam-jefe");
    if (jefeSelect) {
        jefeSelect.innerHTML = `<option value="">Sin Jefe de Familia</option>`;
        db.personas.filter(p => p.id_nucleo === null).forEach(p => {
            jefeSelect.innerHTML += `<option value="${p.id_persona}">${p.tipo_cedula}-${p.cedula_identidad} - ${p.nombre_completo}</option>`;
        });
    }

    const vivSelect = document.getElementById("fam-vivienda");
    if (vivSelect) {
        vivSelect.innerHTML = `<option value="">Sin Vivienda Asignada</option>`;
        db.viviendas.forEach(v => {
            const comm = db.comunidades.find(c => c.id_comunidad === v.id_comunidad);
            const edif = v.id_edificio ? db.edificios.find(e => e.id_edificio === v.id_edificio) : null;
            const text = `${comm ? comm.nombre_comunidad : 'S/C'} - ${v.numero_vivienda} ${edif ? '(' + edif.nombre_edificio + ')' : '(Casa)'}`;
            vivSelect.innerHTML += `<option value="${v.id_vivienda}">${text}</option>`;
        });
    }
}

export async function populateViviendaModalSelects() {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    const userRole = db.roles.find(r => r.id_rol === currentUser?.id_rol);
    const roleName = userRole ? userRole.nombre_rol.toLowerCase() : "";
    const isLider = roleName.includes("lider") || roleName.includes("líder");

    const comSelectViv = document.getElementById("viv-comunidad");
    const edSelectViv = document.getElementById("viv-edificio");
    
    comSelectViv.innerHTML = `<option value="">Seleccione comunidad...</option>`;
    db.comunidades.forEach(c => {
        if (isLider && currentUser.id_comunidad && c.id_comunidad !== currentUser.id_comunidad) return;
        comSelectViv.innerHTML += `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
    });

    if (isLider && currentUser.id_comunidad) {
        comSelectViv.value = currentUser.id_comunidad;
        comSelectViv.disabled = true;
    } else {
        comSelectViv.disabled = false;
    }

    comSelectViv.onchange = (e) => {
        const selComId = e.target.value;
        edSelectViv.innerHTML = `<option value="">Ninguno (Es una Casa)</option>`;
        if (selComId) {
            db.edificios.filter(edf => edf.id_comunidad === selComId).forEach(edf => {
                edSelectViv.innerHTML += `<option value="${edf.id_edificio}">${edf.nombre_edificio}</option>`;
            });
        }
    };
    // Disparar para cargar los edificios iniciales
    comSelectViv.dispatchEvent(new Event("change"));
}

// =========================================================================
// OPERACIONES DE ESCRITURA (SOLO SUPABASE)
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

// =========================================================================
// MÉTODOS ADICIONALES (EDICIÓN FAMILIAR, PARÁMETROS, CLAVE Y REPORTES)
// =========================================================================

export async function uiOpenEditFamilyModal(id) {
    const db = await dbFetchAll();
    const n = db.nucleos.find(x => x.id_nucleo === id);
    if (!n) return;

    document.getElementById("edit-fam-id").value = id;
    document.getElementById("edit-fam-nombre").value = n.nombre_familia;

    // Viviendas
    const vivSelect = document.getElementById("edit-fam-vivienda");
    vivSelect.innerHTML = `<option value="">Sin Vivienda Asignada</option>`;
    db.viviendas.forEach(v => {
        const comm = db.comunidades.find(c => c.id_comunidad === v.id_comunidad);
        const edif = v.id_edificio ? db.edificios.find(e => e.id_edificio === v.id_edificio) : null;
        const text = `${comm ? comm.nombre_comunidad : 'S/C'} - ${v.numero_vivienda} ${edif ? '(' + edif.nombre_edificio + ')' : '(Casa)'}`;
        vivSelect.innerHTML += `<option value="${v.id_vivienda}">${text}</option>`;
    });
    vivSelect.value = n.id_vivienda || "";

    // Jefe de Familia (Miembros del núcleo actual + personas sin núcleo)
    const jefeSelect = document.getElementById("edit-fam-jefe");
    jefeSelect.innerHTML = `<option value="">Sin Jefe de Familia</option>`;
    
    // Miembros actuales del núcleo
    const members = db.personas.filter(p => p.id_nucleo === id);
    members.forEach(p => {
        jefeSelect.innerHTML += `<option value="${p.id_persona}">${p.tipo_cedula}-${p.cedula_identidad} - ${p.nombre_completo} (Miembro)</option>`;
    });

    // Personas sin núcleo
    const noFamily = db.personas.filter(p => p.id_nucleo === null);
    noFamily.forEach(p => {
        jefeSelect.innerHTML += `<option value="${p.id_persona}">${p.tipo_cedula}-${p.cedula_identidad} - ${p.nombre_completo} (Sin Familia)</option>`;
    });

    jefeSelect.value = n.id_jefe_familia || "";

    document.getElementById("modal-editar-familia").classList.remove("hidden");
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

// Parámetros
export async function renderParametros() {
    const db = await dbFetchAll();
    
    // Profesiones
    const bodyProf = document.getElementById("table-body-profesiones");
    bodyProf.innerHTML = "";
    db.profesiones.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${p.nombre_profesion}</strong></td>
            <td style="text-align: right;">
                <button class="btn btn-secondary btn-edit-prof" data-id="${p.id_profesion}" data-nombre="${p.nombre_profesion}" style="padding: 4px 8px; font-size: 11px;">Editar</button>
                <button class="btn btn-secondary btn-delete-prof" data-id="${p.id_profesion}" style="padding: 4px 8px; font-size: 11px; margin-left: 4px; background: var(--error-color) !important; color: white;">Eliminar</button>
            </td>
        `;
        bodyProf.appendChild(tr);
    });

    // Discapacidades
    const bodyDisc = document.getElementById("table-body-discapacidades");
    bodyDisc.innerHTML = "";
    db.discapacidades.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${d.tipo_discapacidad}</strong> (${d.nivel_discapacidad})</td>
            <td style="text-align: right;">
                <button class="btn btn-secondary btn-edit-disc" data-id="${d.id_discapacidad}" data-tipo="${d.tipo_discapacidad}" data-nivel="${d.nivel_discapacidad}" style="padding: 4px 8px; font-size: 11px;">Editar</button>
                <button class="btn btn-secondary btn-delete-disc" data-id="${d.id_discapacidad}" style="padding: 4px 8px; font-size: 11px; margin-left: 4px; background: var(--error-color) !important; color: white;">Eliminar</button>
            </td>
        `;
        bodyDisc.appendChild(tr);
    });

    // Wire events
    document.querySelectorAll(".btn-edit-prof").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.getElementById("param-profesion-id").value = e.target.getAttribute("data-id");
            document.getElementById("param-profesion-nombre").value = e.target.getAttribute("data-nombre");
        });
    });

    document.querySelectorAll(".btn-delete-prof").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (await showConfirm("¿Desea eliminar esta profesión?")) {
                try {
                    await apiDeleteProfesion(id);
                    await renderParametros();
                    await populateSelects();
                    await populateProfessionsChecklist();
                    showAlert("Profesión eliminada con éxito.", "success");
                } catch (err) {
                    showAlert("Error: " + err.message, "error");
                }
            }
        });
    });

    document.querySelectorAll(".btn-edit-disc").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.getElementById("param-discapacidad-id").value = e.target.getAttribute("data-id");
            document.getElementById("param-discapacidad-tipo").value = e.target.getAttribute("data-tipo");
            document.getElementById("param-discapacidad-nivel").value = e.target.getAttribute("data-nivel");
        });
    });

    document.querySelectorAll(".btn-delete-disc").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (await showConfirm("¿Desea eliminar esta discapacidad?")) {
                try {
                    await apiDeleteDiscapacidad(id);
                    await renderParametros();
                    await populateSelects();
                    await populatePersonaModalSelects();
                    showAlert("Discapacidad eliminada con éxito.", "success");
                } catch (err) {
                    showAlert("Error: " + err.message, "error");
                }
            }
        });
    });
    await applyRoleUI_Restrictions();
}

export async function uiSaveProfesion(id, nombre) {
    if (id) {
        await apiUpdateProfesion(id, nombre);
    } else {
        await apiCreateProfesion(nombre);
    }
}

export async function uiSaveDiscapacidad(id, tipo, nivel) {
    if (id) {
        await apiUpdateDiscapacidad(id, tipo, nivel);
    } else {
        await apiCreateDiscapacidad(tipo, nivel);
    }
}

// Reportes Gráficos
let chartProf = null;
let chartDisc = null;
let chartAge = null;

export async function renderCharts() {
    const db = await dbFetchAll();
    
    const filterText = document.getElementById("filter-cedula").value.toLowerCase().trim();
    const filterAgeMin = document.getElementById("filter-edad-min").value;
    const filterAgeMax = document.getElementById("filter-edad-max").value;
    const filterGen = document.getElementById("filter-genero").value;
    const filterHomeType = document.getElementById("filter-tipo-vivienda").value;
    const filterDiscNivel = document.getElementById("filter-discapacidad-nivel").value;

    const selectedDisabilities = Array.from(document.querySelectorAll(".filter-discapacidad-type:checked")).map(el => el.value);
    const selectedProfessions = Array.from(document.querySelectorAll(".filter-profesion-item:checked")).map(el => el.value);

    const currentYear = new Date().getFullYear();

    const filtered = db.personas.filter(p => {
        if (activeCommunity !== "all") {
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

    // 1. Profesiones
    const profCounts = {};
    filtered.forEach(p => {
        const profObj = db.profesiones.find(prof => prof.id_profesion === p.id_profesion);
        const name = profObj ? profObj.nombre_profesion : "Ninguno / Desempleado";
        profCounts[name] = (profCounts[name] || 0) + 1;
    });

    // 2. Discapacidades
    const discCounts = {};
    filtered.forEach(p => {
        const discObj = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
        const label = discObj ? `${discObj.tipo_discapacidad} (${discObj.nivel_discapacidad})` : "Sin discapacidad";
        discCounts[label] = (discCounts[label] || 0) + 1;
    });

    // 3. Edades
    const ageCounts = {
        "Niños (0-12)": 0,
        "Jóvenes (13-25)": 0,
        "Adultos (26-59)": 0,
        "Adulto Mayor (60+)": 0
    };
    filtered.forEach(p => {
        const birthYear = new Date(p.fecha_nacimiento).getFullYear();
        const age = currentYear - birthYear;
        if (age <= 12) ageCounts["Niños (0-12)"]++;
        else if (age <= 25) ageCounts["Jóvenes (13-25)"]++;
        else if (age <= 59) ageCounts["Adultos (26-59)"]++;
        else ageCounts["Adulto Mayor (60+)"]++;
    });

    if (chartProf) chartProf.destroy();
    if (chartDisc) chartDisc.destroy();
    if (chartAge) chartAge.destroy();

    const ctxProf = document.getElementById("chart-profesiones").getContext("2d");
    chartProf = new Chart(ctxProf, {
        type: 'bar',
        data: {
            labels: Object.keys(profCounts),
            datasets: [{
                label: 'Habitantes',
                data: Object.values(profCounts),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });

    const ctxDisc = document.getElementById("chart-discapacidades").getContext("2d");
    chartDisc = new Chart(ctxDisc, {
        type: 'pie',
        data: {
            labels: Object.keys(discCounts),
            datasets: [{
                data: Object.values(discCounts),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(139, 92, 246, 0.6)',
                    'rgba(107, 114, 128, 0.6)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true
        }
    });

    const ctxAge = document.getElementById("chart-edades").getContext("2d");
    chartAge = new Chart(ctxAge, {
        type: 'bar',
        data: {
            labels: Object.keys(ageCounts),
            datasets: [{
                label: 'Habitantes',
                data: Object.values(ageCounts),
                backgroundColor: 'rgba(236, 72, 153, 0.6)',
                borderColor: 'rgba(236, 72, 153, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

// Exportar Reportes Gráficos a PDF
export async function exportarReportesPDF() {
    if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
        showAlert("Las librerías jsPDF o html2canvas no se han cargado.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const panel = document.getElementById("panel-reportes");
    
    // Ocultar botones de acciones temporalmente
    const headerActions = panel.querySelector(".panel-header-actions");
    const originalDisplay = headerActions ? headerActions.style.display : "";
    if (headerActions) headerActions.style.display = "none";

    try {
        // Capturar el panel completo con html2canvas
        const canvas = await window.html2canvas(panel, {
            scale: 2, // Mayor calidad
            backgroundColor: "#1e1e2d", // Fondo oscuro para que coincida con el tema
            useCORS: true
        });

        // Restaurar botones
        if (headerActions) headerActions.style.display = originalDisplay;

        const imgData = canvas.toDataURL("image/jpeg", 0.95); // Usar JPEG es más seguro y menos propenso a corromper PDFs
        
        // Crear documento PDF
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;
        
        // Calcular alto proporcional
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        // Añadir encabezado
        doc.setFillColor(30, 30, 50);
        doc.rect(0, 0, pageWidth, 25, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text("SGC - Reportes y Análisis Gráfico", margin, 12);
        
        const now = new Date();
        const dateStr = now.toLocaleDateString("es-VE");
        doc.setFontSize(10);
        doc.setTextColor(200, 200, 220);
        doc.text(`Generado: ${dateStr}`, margin, 19);

        let heightLeft = imgHeight;
        let position = 30; // Empezar debajo del encabezado

        // Añadir primera página de la imagen
        doc.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
        heightLeft -= (pageHeight - position);

        // Si la imagen es más larga que una página, añadir páginas adicionales
        while (heightLeft > 0) {
            position = heightLeft - imgHeight; 
            doc.addPage();
            doc.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const fileName = `Reportes_SGC_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.pdf`;
        doc.save(fileName);
        showAlert("Reporte PDF generado exitosamente.", "success");
    } catch (error) {
        if (headerActions) headerActions.style.display = originalDisplay;
        console.error("Error generating PDF:", error);
        showAlert("Hubo un error al generar el PDF.", "error");
    }
}

// Exportado desde ui.js para que app.js lo pueda usar si es necesario
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

export async function exportarPersonasExcel() {
    const db = await dbFetchAll();
    const personasFiltradas = getFilteredPersonas(db);
    
    if (personasFiltradas.length === 0) {
        if(window.showNotification) window.showNotification("No hay datos para exportar con los filtros actuales.", "warning");
        else alert("No hay datos para exportar con los filtros actuales.");
        return;
    }

    const currentYear = new Date().getFullYear();

    // Mapear los datos para que el Excel tenga las columnas limpias y legibles
    const datosExcel = personasFiltradas.map(p => {
        const profesion = db.profesiones.find(pr => pr.id_profesion === p.id_profesion)?.nombre_profesion || 'Ninguna';
        
        let discapacidadTxt = 'Ninguna';
        if (p.id_discapacidad) {
            const disc = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
            if (disc) discapacidadTxt = `${disc.tipo_discapacidad} (${disc.nivel_discapacidad})`;
        }

        let viviendaTxt = 'Sin Vivienda';
        let comunidadTxt = 'Sin Comunidad';
        if (p.id_nucleo) {
            const nucleo = db.nucleos.find(n => n.id_nucleo === p.id_nucleo);
            if (nucleo && nucleo.id_vivienda) {
                const vivienda = db.viviendas.find(v => v.id_vivienda === nucleo.id_vivienda);
                if (vivienda) {
                    viviendaTxt = `Casa/Apto ${vivienda.numero_vivienda}`;
                    const comunidad = db.comunidades.find(c => c.id_comunidad === vivienda.id_comunidad);
                    if (comunidad) comunidadTxt = comunidad.nombre_comunidad;
                }
            }
        }

        const birthYear = new Date(p.fecha_nacimiento).getFullYear();
        const edad = currentYear - birthYear;
        
        return {
            "Cédula": `${p.tipo_cedula}-${p.cedula_identidad}`,
            "Nombre Completo": p.nombre_completo,
            "Edad": edad,
            "Género": p.genero,
            "Teléfono": p.telefono || 'N/A',
            "Email": p.email || 'N/A',
            "Profesión/Oficio": profesion,
            "Condición de Salud": discapacidadTxt,
            "Comunidad": comunidadTxt,
            "Vivienda": viviendaTxt
        };
    });

    if (typeof XLSX === "undefined") {
        if(window.showNotification) window.showNotification("La librería para exportar Excel no está cargada.", "error");
        else alert("La librería para exportar Excel no está cargada.");
        return;
    }

    // Crear la hoja de trabajo y el libro de Excel
    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    
    // Ajustar el ancho de cada columna para que el texto encaje
    worksheet['!cols'] = [
        { wch: 15 }, // Cédula
        { wch: 35 }, // Nombre Completo
        { wch: 8 },  // Edad
        { wch: 12 }, // Género
        { wch: 15 }, // Teléfono
        { wch: 30 }, // Email
        { wch: 30 }, // Profesión/Oficio
        { wch: 35 }, // Condición de Salud
        { wch: 30 }, // Comunidad
        { wch: 25 }  // Vivienda
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Censo de Habitantes");

    // Forzar la descarga del archivo
    XLSX.writeFile(workbook, "Censo_Habitantes_Filtrado.xlsx");
}

// =========================================================================
// EDICIÓN DE PERFIL Y ROLES
// =========================================================================

export async function uiUpdateMisDatos(nombre, telefono) {
    const { getCurrentUser, dbFetchAll } = await import('./auth.js').catch(() => window);
    const currentUser = getCurrentUser ? getCurrentUser() : null; // auth.js exporta getCurrentUser o lo obtenemos del store
    
    if (!currentUser) throw new Error("No hay usuario autenticado.");

    await apiUpdateMisDatosClient(currentUser.id_usuario, nombre, telefono);
        
    // Actualizamos currentUser en el DOM
    const nameEl = document.getElementById("current-user-name");
    if (nameEl) nameEl.textContent = nombre;
}

export async function uiOpenEditRoleModal(id_usuario) {
    const db = await dbFetchAll(); // dbFetchAll es global o importado en app.js pero acá no lo tengo directo a menos que lo exporte, pero ya lo tengo arriba (dbFetchAll es una funcion exportada en ui.js? No, está en auth.js o data.js. Arriba se usó dbFetchAll).
    const currentUser = getCurrentUser();
    
    const u = db.usuarios.find(x => x.id_usuario === id_usuario);
    if(!u) return;

    document.getElementById("edit-usr-id").value = u.id_usuario;
    document.getElementById("edit-usr-nombre").textContent = u.nombre_completo;

    const selectRole = document.getElementById("edit-usr-rol");
    selectRole.innerHTML = '<option value="">Seleccione un rol...</option>';
    
    const adminRole = db.roles.find(r => r.nombre_rol === "Administrador");
    const weakRole = db.roles.find(r => r.nombre_rol === "administrador_debil");

    db.roles.forEach(r => {
        // Lógica jerárquica para las opciones del select
        if (currentUser.id_rol === weakRole?.id_rol || currentUser.id_rol === "r-4") {
            if (r.id_rol === adminRole?.id_rol || r.id_rol === "r-1" || r.id_rol === weakRole?.id_rol || r.id_rol === "r-4") {
                return; // Admin_debil no puede asignar rol de Administrador ni otro Administrador_debil
            }
        }
        selectRole.innerHTML += `<option value="${r.id_rol}">${r.nombre_rol}</option>`;
    });

    selectRole.value = u.id_rol;

    document.getElementById("modal-editar-rol").classList.remove("hidden");
}

export async function uiUpdateUserRole(id_usuario, new_role_id) {
    await apiUpdateUserRoleClient(id_usuario, new_role_id);
    
    document.getElementById("modal-editar-rol").classList.add("hidden");
    showAlert("Rol actualizado correctamente.", "success");
    
    if (window.renderUsuariosTable) await window.renderUsuariosTable();
}
// =========================================================================
// RESTRICCIONES VISUALES (CONSULTOR / LÍDER)
// =========================================================================

export async function applyRoleUI_Restrictions() {
    const db = await dbFetchAll();
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const userRole = db.roles.find(r => r.id_rol === currentUser.id_rol);
    const roleName = userRole ? userRole.nombre_rol.toLowerCase() : "";

    const isConsultor = roleName.includes("consultor");
    const isLider = roleName.includes("lider") || roleName.includes("líder");

    if (isConsultor) {
        // Ocultar botones de registro globales
        const createBtns = [
            "btn-open-persona-modal",
            "btn-open-family-modal",
            "btn-open-comunidad-modal",
            "btn-open-edificio-modal",
            "btn-open-vivienda-modal"
        ];
        createBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = "none";
        });

        // Ocultar formularios de carga y asignación (las tarjetas completas)
        const cardsToHide = document.querySelectorAll(".family-form-card, .viviendas-action-card");
        cardsToHide.forEach(card => card.style.display = "none");

        // Ocultar botones de edición y eliminación (enlaces ✎ y 🗑)
        const actionLinks = document.querySelectorAll("a[onclick*='edit'], a[onclick*='delete'], button[onclick*='uiDelete'], button[onclick*='uiOpenEdit']");
        actionLinks.forEach(el => el.style.display = "none");

        const actionBtns = document.querySelectorAll(".btn-delete-user, .btn-edit-user-role");
        actionBtns.forEach(el => el.style.display = "none");
    }

    if (isLider) {
        // Un líder no puede crear ni editar comunidades globales
        const comBtn = document.getElementById("btn-open-comunidad-modal");
        if (comBtn) comBtn.style.display = "none";
        
        const deleteComLinks = document.querySelectorAll("a[onclick*='deleteComunidad']");
        deleteComLinks.forEach(el => el.style.display = "none");

        const editComLinks = document.querySelectorAll("a[onclick*='editComunidad']");
        editComLinks.forEach(el => el.style.display = "none");
    }
}

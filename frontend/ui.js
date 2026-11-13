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

    const genderCountFemaleEl = document.getElementById("gender-count-female");
    const genderCountMaleEl = document.getElementById("gender-count-male");
    if (genderCountFemaleEl) genderCountFemaleEl.textContent = femaleCount;
    if (genderCountMaleEl) genderCountMaleEl.textContent = maleCount;

    // Renderizar pirámide demográfica bilateral auténtica (8 cohortes de edad continuas)
    const container = document.getElementById("age-bars-container");
    container.innerHTML = "";

    if (filteredPersonas.length === 0) {
        container.innerHTML = `
            <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
                No se registran habitantes censados en esta comunidad.
            </div>
        `;
    } else {
        const ageRanges = [
            { label: "60+ años", min: 60, max: 200, key: "De 60 a + años" },
            { label: "55 - 59", min: 55, max: 59, key: "De 55 a 59 años" },
            { label: "36 - 54", min: 36, max: 54, key: "De 36 a 54 años" },
            { label: "18 - 35", min: 18, max: 35, key: "De 18 a 35 años" },
            { label: "14 - 17", min: 14, max: 17, key: "De 14 a 17 años" },
            { label: "6 - 13", min: 6, max: 13, key: "De 6 a 13 años" },
            { label: "2 - 5", min: 2, max: 5, key: "De 2 a 5 años" },
            { label: "0 - 1 año", min: 0, max: 1, key: "De 0 a 1 año" }
        ];

        const today = new Date();

        const pyramidData = ageRanges.map(range => {
            let male = 0;
            let female = 0;
            filteredPersonas.forEach(p => {
                if (!p.fecha_nacimiento) return;
                const birthDate = new Date(p.fecha_nacimiento);
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                age = Math.max(0, age);
                if (age >= range.min && age <= range.max) {
                    if (p.genero === "Masculino") male++;
                    else if (p.genero === "Femenino") female++;
                }
            });
            return { ...range, male, female, total: male + female };
        });

        const maxSideCount = Math.max(...pyramidData.map(d => Math.max(d.male, d.female)), 1);

        // Leyenda superior de la Pirámide
        const legendEl = document.createElement("div");
        legendEl.className = "pyramid-legend";
        legendEl.innerHTML = `
            <span class="pyramid-legend-male">
                <span class="dot-indicator dot-male"></span>
                Hombres (${maleCount} - ${malePct}%)
            </span>
            <span class="pyramid-legend-center">Cohortes de Edad</span>
            <span class="pyramid-legend-female">
                Mujeres (${femaleCount} - ${femalePct}%)
                <span class="dot-indicator dot-female"></span>
            </span>
        `;
        container.appendChild(legendEl);

        // Filas de cada cohorte (de 60+ a 0-1)
        pyramidData.forEach(item => {
            const malePctBar = Math.round((item.male / maxSideCount) * 100);
            const femalePctBar = Math.round((item.female / maxSideCount) * 100);

            const row = document.createElement("div");
            row.className = "pyramid-row";
            row.title = `${item.key}: ${item.male} hombres, ${item.female} mujeres (Total: ${item.total} hab.)`;
            row.innerHTML = `
                <div class="pyramid-side-male">
                    <span class="pyramid-num">${item.male}</span>
                    <div class="pyramid-bar-track-male">
                        <div class="pyramid-bar-fill-male" style="width: ${malePctBar}%;"></div>
                    </div>
                </div>
                <span class="pyramid-label">${item.label}</span>
                <div class="pyramid-side-female">
                    <div class="pyramid-bar-track-female">
                        <div class="pyramid-bar-fill-female" style="width: ${femalePctBar}%;"></div>
                    </div>
                    <span class="pyramid-num">${item.female}</span>
                </div>
            `;
            container.appendChild(row);
        });
    }

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
            deleteBtnHtml = `
                <button class="btn btn-danger btn-delete-family" data-id="${n.id_nucleo}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Desarmar
                </button>
            `;
            editBtnHtml = `
                <button class="btn btn-primary btn-edit-family" data-id="${n.id_nucleo}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Editar
                </button>
            `;
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
                <div class="family-card-actions">
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
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
            uiDeleteFamilia(id);
        });
    });

    // Wire editar
    document.querySelectorAll(".btn-edit-family").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
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

    const treeEditIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const treeDeleteIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    activeComs.forEach(c => {
        const comNode = document.createElement("div");
        comNode.className = "tree-node root";
        comNode.innerHTML = `
            <div class="tree-node-title">
                <span>Comunidad: <strong>${c.nombre_comunidad}</strong></span>
                <div class="tree-node-actions">
                    <a href="#" class="btn-tree-edit" onclick="event.preventDefault(); window.editComunidad('${c.id_comunidad}')" title="Editar">${treeEditIcon}</a>
                    <a href="#" class="btn-tree-delete" onclick="event.preventDefault(); window.deleteComunidad('${c.id_comunidad}')" title="Borrar">${treeDeleteIcon}</a>
                </div>
            </div>`;

        const commEdifs = db.edificios.filter(e => e.id_comunidad === c.id_comunidad);
        commEdifs.forEach(e => {
            const edifNode = document.createElement("div");
            edifNode.className = "tree-node";
            edifNode.innerHTML = `
                <div class="tree-node-title">
                    <span>Edificio: <strong>${e.nombre_edificio}</strong></span>
                    <div class="tree-node-actions">
                        <a href="#" class="btn-tree-edit" onclick="event.preventDefault(); window.editEdificio('${e.id_edificio}')" title="Editar">${treeEditIcon}</a>
                        <a href="#" class="btn-tree-delete" onclick="event.preventDefault(); window.deleteEdificio('${e.id_edificio}')" title="Borrar">${treeDeleteIcon}</a>
                    </div>
                </div>`;

            const edifViviendas = db.viviendas.filter(v => v.id_edificio === e.id_edificio);
            edifViviendas.forEach(v => {
                const vivNode = document.createElement("div");
                vivNode.className = "tree-node";
                
                const vFamilies = db.nucleos.filter(n => n.id_vivienda === v.id_vivienda);
                const famNames = vFamilies.map(n => n.nombre_familia).join(", ") || "Desocupada";
                
                vivNode.innerHTML = `
                    <div class="tree-node-title" style="background-color: var(--bg-tertiary);">
                        <span>Vivienda: <strong>${v.numero_vivienda}</strong> <span class="table-subtext" style="display: inline; margin-left: 6px;">(${famNames})</span></span>
                        <div class="tree-node-actions">
                            <a href="#" class="btn-tree-edit" onclick="event.preventDefault(); window.editVivienda('${v.id_vivienda}')" title="Editar">${treeEditIcon}</a>
                            <a href="#" class="btn-tree-delete" onclick="event.preventDefault(); window.deleteVivienda('${v.id_vivienda}')" title="Borrar">${treeDeleteIcon}</a>
                        </div>
                    </div>`;
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
                <div class="tree-node-title" style="background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2);">
                    <span>Casa: <strong>${v.numero_vivienda}</strong> <span class="table-subtext" style="display: inline; margin-left: 6px;">(${famNames})</span></span>
                    <div class="tree-node-actions">
                        <a href="#" class="btn-tree-edit" onclick="event.preventDefault(); window.editVivienda('${v.id_vivienda}')" title="Editar">${treeEditIcon}</a>
                        <a href="#" class="btn-tree-delete" onclick="event.preventDefault(); window.deleteVivienda('${v.id_vivienda}')" title="Borrar">${treeDeleteIcon}</a>
                    </div>
                </div>`;
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
            buttonHtml += `<button class="btn btn-danger btn-delete-user" data-id="${u.id_usuario}"
                            ${deleteDisabled ? 'disabled title="' + tooltipText + '" style="opacity: 0.45; cursor: not-allowed;"' : ''}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Eliminar
                        </button>`;
        } else {
            buttonHtml += `<span class="table-subtext" style="font-weight: 500;">Sesión Activa</span>`;
        }

        if (showEditRole) {
            buttonHtml += `<button class="btn btn-outline btn-edit-user-role" data-id="${u.id_usuario}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Editar Rol
                        </button>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${u.nombre_completo}</strong></td>
            <td>
                <div>${u.email}</div>
                <div class="table-subtext">${u.telefono || 'Sin tlf'}</div>
            </td>
            <td><span class="table-badge ${u.id_rol === adminRole?.id_rol || u.id_rol === 'r-1' ? 'blue' : 'green'}">${roleName}</span></td>
            <td>${commName}</td>
            <td>
                <div class="table-actions">
                    ${buttonHtml}
                </div>
            </td>
        `;
        body.appendChild(tr);
    });

    // Asegurar que el recuadro comience al inicio a la izquierda
    const usrTable = document.getElementById("usuarios-table");
    const usrContainer = usrTable?.closest(".table-container");
    if (usrContainer) usrContainer.scrollLeft = 0;

    // Wire delete
    document.querySelectorAll(".btn-delete-user").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
            uiDeleteUsuario(id);
        });
    });

    // Wire edit role
    document.querySelectorAll(".btn-edit-user-role").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
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
    const userRole = db && db.roles ? db.roles.find(r => r.id_rol === currentUser?.id_rol) : null;
    const roleName = (userRole ? userRole.nombre_rol : (currentUser?.nombre_rol || "")).toLowerCase();
    const roleId = String(currentUser?.id_rol || "");
    const isLider = roleName.includes("lider") || roleName.includes("líder") || roleId === "6a97aa3d-0b9f-4ea8-9ae8-a9215abf68c3" || roleId === "2" || roleId === "r-2";

    const activeCommSelect = document.getElementById("active-community-select");
    const currentVal = activeCommSelect ? activeCommSelect.value : "all";
    
    if (activeCommSelect) {
        if (isLider && currentUser?.id_comunidad) {
            activeCommSelect.innerHTML = "";
            const c = db.comunidades.find(x => x.id_comunidad === currentUser.id_comunidad);
            if (c) activeCommSelect.innerHTML = `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
            activeCommSelect.value = currentUser.id_comunidad;
            activeCommSelect.disabled = true;
            setActiveCommunity(currentUser.id_comunidad);
            window.activeCommunity = currentUser.id_comunidad;
        } else {
            activeCommSelect.innerHTML = `<option value="all">Todas las Comunidades</option>`;
            db.comunidades.forEach(c => {
                activeCommSelect.innerHTML += `<option value="${c.id_comunidad}">${c.nombre_comunidad}</option>`;
            });
            activeCommSelect.value = currentVal || "all";
            activeCommSelect.disabled = false;
        }
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
            <td>
                <div class="table-actions" style="justify-content: flex-end;">
                    <button class="btn btn-outline btn-edit-prof" data-id="${p.id_profesion}" data-nombre="${p.nombre_profesion}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-danger btn-delete-prof" data-id="${p.id_profesion}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Eliminar
                    </button>
                </div>
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
            <td>
                <div class="table-actions" style="justify-content: flex-end;">
                    <button class="btn btn-outline btn-edit-disc" data-id="${d.id_discapacidad}" data-tipo="${d.tipo_discapacidad}" data-nivel="${d.nivel_discapacidad}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-danger btn-delete-disc" data-id="${d.id_discapacidad}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Eliminar
                    </button>
                </div>
            </td>
        `;
        bodyDisc.appendChild(tr);
    });

    // Wire events
    document.querySelectorAll(".btn-edit-prof").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            document.getElementById("param-profesion-id").value = targetBtn.getAttribute("data-id");
            document.getElementById("param-profesion-nombre").value = targetBtn.getAttribute("data-nombre");
        });
    });

    document.querySelectorAll(".btn-delete-prof").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
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
            const targetBtn = e.currentTarget || e.target.closest("button");
            document.getElementById("param-discapacidad-id").value = targetBtn.getAttribute("data-id");
            document.getElementById("param-discapacidad-tipo").value = targetBtn.getAttribute("data-tipo");
            document.getElementById("param-discapacidad-nivel").value = targetBtn.getAttribute("data-nivel");
        });
    });

    document.querySelectorAll(".btn-delete-disc").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const targetBtn = e.currentTarget || e.target.closest("button");
            const id = targetBtn.getAttribute("data-id");
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
export let activeReportesSex = "all";

export function setReportesSexFilter(sex) {
    activeReportesSex = sex || "all";
    const buttons = document.querySelectorAll("#reportes-sexo-filter-group .btn-segment");
    buttons.forEach(btn => {
        if (btn.dataset.sex === activeReportesSex) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

export async function renderCharts() {
    const db = await dbFetchAll();
    
    const filterText = document.getElementById("filter-cedula")?.value.toLowerCase().trim() || "";
    const filterAgeMin = document.getElementById("filter-edad-min")?.value || "";
    const filterAgeMax = document.getElementById("filter-edad-max")?.value || "";
    const filterGen = document.getElementById("filter-genero")?.value || "all";
    const filterHomeType = document.getElementById("filter-tipo-vivienda")?.value || "all";
    const filterDiscNivel = document.getElementById("filter-discapacidad-nivel")?.value || "all";

    const selectedDisabilities = Array.from(document.querySelectorAll(".filter-discapacidad-type:checked")).map(el => el.value);
    const selectedProfessions = Array.from(document.querySelectorAll(".filter-profesion-item:checked")).map(el => el.value);

    const currentYear = new Date().getFullYear();

    const baseFiltered = db.personas.filter(p => {
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

    // 1. Métricas base de proporción de sexos sobre el conjunto censado filtrado
    const baseTotal = baseFiltered.length;
    const baseFemales = baseFiltered.filter(p => p.genero === "Femenino").length;
    const baseMales = baseFiltered.filter(p => p.genero === "Masculino").length;
    const pctFem = baseTotal > 0 ? Math.round((baseFemales / baseTotal) * 100) : 0;
    const pctMasc = baseTotal > 0 ? Math.round((baseMales / baseTotal) * 100) : 0;

    // Actualizar contadores en los botones del segmented control
    const badgeAll = document.getElementById("badge-sex-all");
    const badgeFem = document.getElementById("badge-sex-female");
    const badgeMasc = document.getElementById("badge-sex-male");
    if (badgeAll) badgeAll.textContent = baseTotal;
    if (badgeFem) badgeFem.textContent = baseFemales;
    if (badgeMasc) badgeMasc.textContent = baseMales;

    // Actualizar barra de gráfica de proporción de sexos
    const txtFem = document.getElementById("sex-ratio-female-txt");
    const txtMasc = document.getElementById("sex-ratio-male-txt");
    const fillFem = document.getElementById("sex-ratio-fill-female");
    const fillMasc = document.getElementById("sex-ratio-fill-male");
    if (txtFem) txtFem.textContent = `Femenino: ${pctFem}% (${baseFemales})`;
    if (txtMasc) txtMasc.textContent = `Masculino: ${pctMasc}% (${baseMales})`;
    if (fillFem) fillFem.style.width = `${pctFem}%`;
    if (fillMasc) fillMasc.style.width = `${pctMasc}%`;

    // Sincronizar clases activas en los botones del segmented control
    const currentSegmentBtn = document.querySelector(`#reportes-sexo-filter-group .btn-segment[data-sex="${activeReportesSex}"]`);
    if (currentSegmentBtn && !currentSegmentBtn.classList.contains("active")) {
        document.querySelectorAll("#reportes-sexo-filter-group .btn-segment").forEach(b => b.classList.remove("active"));
        currentSegmentBtn.classList.add("active");
    }

    // 2. Aplicar el filtro de sexo a las gráficas existentes
    const filtered = activeReportesSex !== "all" 
        ? baseFiltered.filter(p => p.genero === activeReportesSex) 
        : baseFiltered;

    const totalHabitantes = filtered.length;

    // 1. Profesiones (Ordenadas descendentemente por frecuencia)
    const rawProfCounts = {};
    filtered.forEach(p => {
        const profObj = db.profesiones ? db.profesiones.find(prof => prof.id_profesion === p.id_profesion) : null;
        const name = profObj ? profObj.nombre_profesion : "Sin oficio / Estudiante / Hogar";
        rawProfCounts[name] = (rawProfCounts[name] || 0) + 1;
    });

    const sortedProfs = Object.entries(rawProfCounts).sort((a, b) => b[1] - a[1]);
    const profCounts = {};
    let otherProfCount = 0;
    sortedProfs.forEach(([name, count], index) => {
        if (sortedProfs.length > 7 && index >= 6) {
            otherProfCount += count;
        } else {
            profCounts[name] = count;
        }
    });
    if (otherProfCount > 0) {
        profCounts["Otras profesiones"] = otherProfCount;
    }

    const profBadge = document.getElementById("prof-macro-badge");
    if (profBadge) {
        const totalCategorias = Object.keys(rawProfCounts).length;
        const sexTag = activeReportesSex === "Femenino" ? " (Mujeres)" : (activeReportesSex === "Masculino" ? " (Hombres)" : "");
        profBadge.innerHTML = `<span class="table-badge blue" style="font-size: 11px; padding: 4px 8px;">${totalCategorias} ocupaciones${sexTag}</span>`;
    }

    // 2. Discapacidades (Enfocado en prevalencia real de condiciones especiales)
    const discCounts = {};
    let totalConDiscapacidad = 0;
    filtered.forEach(p => {
        if (p.id_discapacidad && db.discapacidades) {
            const discObj = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
            const label = discObj ? `${discObj.tipo_discapacidad} (${discObj.nivel_discapacidad})` : "Condición no especificada";
            discCounts[label] = (discCounts[label] || 0) + 1;
            totalConDiscapacidad++;
        }
    });

    const discBadge = document.getElementById("disc-macro-badge");
    if (discBadge) {
        const pctDisc = totalHabitantes > 0 ? ((totalConDiscapacidad / totalHabitantes) * 100).toFixed(1) : 0;
        const personaWord = activeReportesSex === "Femenino" ? "mujeres" : (activeReportesSex === "Masculino" ? "hombres" : "personas");
        discBadge.innerHTML = `<span class="table-badge ${totalConDiscapacidad > 0 ? 'orange' : 'green'}" style="font-size: 11px; padding: 4px 8px;">${totalConDiscapacidad} ${personaWord} (${pctDisc}%)</span>`;
    }

    // 3. Rangos de Edad (8 Categorizaciones Oficiales)
    const ageCounts = {
        "De 0 a 1 año": 0,
        "De 2 a 5 años": 0,
        "De 6 a 13 años": 0,
        "De 14 a 17 años": 0,
        "De 18 a 35 años": 0,
        "De 36 a 54 años": 0,
        "De 55 a 59 años": 0,
        "De 60 a + años": 0
    };

    filtered.forEach(p => {
        if (!p.fecha_nacimiento) return;
        const today = new Date();
        const birthDate = new Date(p.fecha_nacimiento);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        age = Math.max(0, age);

        if (age <= 1) ageCounts["De 0 a 1 año"]++;
        else if (age <= 5) ageCounts["De 2 a 5 años"]++;
        else if (age <= 13) ageCounts["De 6 a 13 años"]++;
        else if (age <= 17) ageCounts["De 14 a 17 años"]++;
        else if (age <= 35) ageCounts["De 18 a 35 años"]++;
        else if (age <= 54) ageCounts["De 36 a 54 años"]++;
        else if (age <= 59) ageCounts["De 55 a 59 años"]++;
        else ageCounts["De 60 a + años"]++;
    });

    const menores = ageCounts["De 0 a 1 año"] + ageCounts["De 2 a 5 años"] + ageCounts["De 6 a 13 años"] + ageCounts["De 14 a 17 años"];
    const adultos = ageCounts["De 18 a 35 años"] + ageCounts["De 36 a 54 años"] + ageCounts["De 55 a 59 años"];
    const adultosMayores = ageCounts["De 60 a + años"];

    const ageBadgeContainer = document.getElementById("age-macro-badges");
    if (ageBadgeContainer) {
        const pctMen = totalHabitantes > 0 ? ((menores / totalHabitantes) * 100).toFixed(0) : 0;
        const pctAdu = totalHabitantes > 0 ? ((adultos / totalHabitantes) * 100).toFixed(0) : 0;
        const pctMay = totalHabitantes > 0 ? ((adultosMayores / totalHabitantes) * 100).toFixed(0) : 0;

        ageBadgeContainer.innerHTML = `
            <span class="table-badge blue" style="font-size: 11px; padding: 4px 8px;" title="0 a 17 años">Menores (0-17): ${menores} (${pctMen}%)</span>
            <span class="table-badge green" style="font-size: 11px; padding: 4px 8px;" title="18 a 59 años">Adultos (18-59): ${adultos} (${pctAdu}%)</span>
            <span class="table-badge orange" style="font-size: 11px; padding: 4px 8px;" title="60 años o más">Adultos Mayores (60+): ${adultosMayores} (${pctMay}%)</span>
        `;
    }

    if (chartProf) chartProf.destroy();
    if (chartDisc) chartDisc.destroy();
    if (chartAge) chartAge.destroy();

    // Unificación tipográfica estricta para Chart.js
    if (window.Chart) {
        Chart.defaults.font.family = "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }

    // Colores dinámicos según el tema activo para legibilidad total y evitar textos en blanco
    const isLight = document.body.classList.contains("light-theme");
    const chartAxisTextColor = isLight ? "#0f172a" : "rgba(240, 240, 255, 0.95)";
    const chartLegendTextColor = isLight ? "#0f172a" : "rgba(240, 240, 255, 0.85)";
    const chartTicksMutedColor = isLight ? "#475569" : "rgba(160, 174, 192, 0.8)";
    const chartGridLineColor = isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.05)";

    // Gráfico 1: Profesiones (Barras Horizontales para evitar solapamiento de nombres)
    const ctxProf = document.getElementById("chart-profesiones").getContext("2d");
    chartProf = new Chart(ctxProf, {
        type: 'bar',
        data: {
            labels: Object.keys(profCounts),
            datasets: [{
                label: 'Habitantes',
                data: Object.values(profCounts),
                backgroundColor: 'rgba(99, 102, 241, 0.75)',
                borderColor: '#6366f1',
                borderWidth: 1.5,
                borderRadius: 5,
                barPercentage: 0.7
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                    bodyFont: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw || 0;
                            const pct = totalHabitantes > 0 ? ((val / totalHabitantes) * 100).toFixed(1) : 0;
                            return ` ${val} habitantes (${pct}%)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: chartTicksMutedColor,
                        font: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 11 }
                    },
                    grid: { color: chartGridLineColor }
                },
                y: {
                    ticks: {
                        color: chartAxisTextColor,
                        font: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 12, weight: '600' }
                    },
                    grid: { display: false }
                }
            }
        }
    });

    // Gráfico 2: Discapacidades (Dona moderna enfocada)
    const ctxDisc = document.getElementById("chart-discapacidades").getContext("2d");
    const discLabels = Object.keys(discCounts);
    const hasConditions = discLabels.length > 0;
    
    chartDisc = new Chart(ctxDisc, {
        type: 'doughnut',
        data: {
            labels: hasConditions ? discLabels : ["Sin personas con discapacidad"],
            datasets: [{
                data: hasConditions ? Object.values(discCounts) : [1],
                backgroundColor: hasConditions ? [
                    'rgba(239, 68, 68, 0.75)',
                    'rgba(245, 158, 11, 0.75)',
                    'rgba(160, 185, 129, 0.75)',
                    'rgba(99, 102, 241, 0.75)',
                    'rgba(236, 72, 153, 0.75)',
                    'rgba(14, 165, 233, 0.75)'
                ] : ['rgba(16, 185, 129, 0.3)'],
                borderColor: hasConditions ? [
                    '#ef4444',
                    '#f59e0b',
                    '#10b981',
                    '#6366f1',
                    '#ec4899',
                    '#0ea5e9'
                ] : ['#10b981'],
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartLegendTextColor,
                        font: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 11, weight: '500' },
                        padding: 10,
                        boxWidth: 12
                    }
                },
                tooltip: {
                    titleFont: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                    bodyFont: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                    callbacks: {
                        label: (ctx) => {
                            if (!hasConditions) return " No se registran discapacidades";
                            const val = ctx.raw || 0;
                            const pct = totalConDiscapacidad > 0 ? ((val / totalConDiscapacidad) * 100).toFixed(1) : 0;
                            return ` ${ctx.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '62%'
        }
    });

    // Gráfico 3: Distribución por Rangos de Edad (Barras Horizontales con Paleta de Ciclo de Vida)
    const ctxAge = document.getElementById("chart-edades").getContext("2d");
    chartAge = new Chart(ctxAge, {
        type: 'bar',
        data: {
            labels: Object.keys(ageCounts),
            datasets: [{
                label: 'Habitantes',
                data: Object.values(ageCounts),
                backgroundColor: [
                    'rgba(56, 189, 248, 0.75)',   // 0 a 1 año (Celeste lactante)
                    'rgba(14, 165, 233, 0.75)',   // 2 a 5 años (Azul cielo preescolar)
                    'rgba(16, 185, 129, 0.75)',   // 6 a 13 años (Verde escolar)
                    'rgba(99, 102, 241, 0.75)',   // 14 a 17 años (Índigo adolescente)
                    'rgba(139, 92, 246, 0.75)',   // 18 a 35 años (Violeta juventud)
                    'rgba(168, 85, 247, 0.75)',   // 36 a 54 años (Púrpura adultez)
                    'rgba(245, 158, 11, 0.75)',   // 55 a 59 años (Ámbar pre-mayor)
                    'rgba(239, 68, 68, 0.75)'     // 60+ años (Coral adulto mayor)
                ],
                borderColor: [
                    '#38bdf8',
                    '#0ea5e9',
                    '#10b981',
                    '#6366f1',
                    '#8b5cf6',
                    '#a855f7',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 1.5,
                borderRadius: 5,
                barPercentage: 0.75
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                    bodyFont: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw || 0;
                            const pct = totalHabitantes > 0 ? ((val / totalHabitantes) * 100).toFixed(1) : 0;
                            return ` ${val} habitantes (${pct}%)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: chartTicksMutedColor,
                        font: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 11 }
                    },
                    grid: { color: chartGridLineColor }
                },
                y: {
                    ticks: {
                        color: chartAxisTextColor,
                        font: { family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 12, weight: '600' }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Exportar Reportes Gráficos a PDF (Informe Oficial Ejecutivo con Soporte Multipágina)
export async function exportarReportesPDF() {
    if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
        showAlert("Las librerías jsPDF o html2canvas no se han cargado.", "error");
        return;
    }

    showAlert("Generando informe demográfico oficial en PDF...", "info");

    const { jsPDF } = window.jspdf;
    const db = await dbFetchAll();
    const baseFiltered = getFilteredPersonas(db);
    const filtered = activeReportesSex !== "all" 
        ? baseFiltered.filter(p => p.genero === activeReportesSex) 
        : baseFiltered;
    const totalPersonas = filtered.length;

    const baseFemales = baseFiltered.filter(p => p.genero === "Femenino").length;
    const baseMales = baseFiltered.filter(p => p.genero === "Masculino").length;
    const pctFem = baseFiltered.length > 0 ? Math.round((baseFemales / baseFiltered.length) * 100) : 0;
    const pctMasc = baseFiltered.length > 0 ? Math.round((baseMales / baseFiltered.length) * 100) : 0;

    // Metadatos de la comunidad y del usuario emisor
    let commName = "Todas las Comunidades (Consolidado General)";
    if (typeof activeCommunity !== "undefined" && activeCommunity !== "all") {
        const c = db.comunidades.find(x => x.id_comunidad === activeCommunity);
        if (c) commName = c.nombre_comunidad;
    }

    const currentUser = getCurrentUser();
    const userName = currentUser ? (currentUser.nombre_completo || currentUser.email) : "Usuario del Sistema";
    const userRole = currentUser ? (currentUser.nombre_rol || "Administrador") : "Administrador";

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("es-VE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
    const timeFormatted = now.toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit"
    });

    // Familias y viviendas censadas
    const familyIds = new Set(filtered.map(p => p.id_nucleo).filter(Boolean));
    const totalFamilias = familyIds.size;
    const housingIds = new Set(db.nucleos.filter(n => familyIds.has(n.id_nucleo)).map(n => n.id_vivienda).filter(Boolean));
    const totalViviendas = housingIds.size;

    // 1. Rangos de Edad Oficiales (8 Categorías Continuas)
    const ageBrackets = [
        { label: "De 0 a 1 año", etapa: "Lactantes", min: 0, max: 1, color: "#0ea5e9" },
        { label: "De 2 a 5 años", etapa: "Primera Infancia", min: 2, max: 5, color: "#38bdf8" },
        { label: "De 6 a 13 años", etapa: "Niñez / Edad Escolar", min: 6, max: 13, color: "#10b981" },
        { label: "De 14 a 17 años", etapa: "Adolescencia", min: 14, max: 17, color: "#6366f1" },
        { label: "De 18 a 35 años", etapa: "Juventud y Adultez Temprana", min: 18, max: 35, color: "#8b5cf6" },
        { label: "De 36 a 54 años", etapa: "Adultez Media", min: 36, max: 54, color: "#a855f7" },
        { label: "De 55 a 59 años", etapa: "Adultos Pre-Tercera Edad", min: 55, max: 59, color: "#f59e0b" },
        { label: "De 60 a + años", etapa: "Adultos Mayores (60+)", min: 60, max: 150, color: "#ef4444" }
    ];

    const ageData = ageBrackets.map(b => {
        let count = 0;
        filtered.forEach(p => {
            if (!p.fecha_nacimiento) return;
            const today = new Date();
            const birthDate = new Date(p.fecha_nacimiento);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            age = Math.max(0, age);
            if (age >= b.min && age <= b.max) count++;
        });
        const pct = totalPersonas > 0 ? ((count / totalPersonas) * 100).toFixed(1) : "0.0";
        return { ...b, count, pct };
    });

    const menoresCount = ageData.slice(0, 4).reduce((sum, b) => sum + b.count, 0);
    const adultosCount = ageData.slice(4, 7).reduce((sum, b) => sum + b.count, 0);
    const mayoresCount = ageData[7].count;
    const menoresPct = totalPersonas > 0 ? ((menoresCount / totalPersonas) * 100).toFixed(1) : "0.0";
    const adultosPct = totalPersonas > 0 ? ((adultosCount / totalPersonas) * 100).toFixed(1) : "0.0";
    const mayoresPct = totalPersonas > 0 ? ((mayoresCount / totalPersonas) * 100).toFixed(1) : "0.0";

    // Filas HTML de Rangos de Edad (Página 1)
    const ageTableRowsHtml = ageData.map((d, index) => {
        const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
        return `
            <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px; font-weight: 700; color: #0f172a;">${d.label}</td>
                <td style="padding: 7px 10px; color: #475569;">${d.etapa}</td>
                <td style="padding: 7px 10px; text-align: center; font-weight: 700; color: #0f172a;">${d.count}</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #334155;">${d.pct}%</td>
                <td style="padding: 7px 10px;">
                    <div style="background: #e2e8f0; height: 9px; border-radius: 5px; overflow: hidden; width: 100%;">
                        <div style="width: ${d.pct}%; background: ${d.color}; height: 100%; border-radius: 5px;"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    // Contenido central de Página 1
    const page1BodyHtml = `
        <!-- Ficha Técnica de la Emisión -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-bottom: 18px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px 16px; font-size: 11px;">
            <div><span style="color: #64748b; font-weight: 600;">Comunidad:</span> <strong style="color: #0f172a;">${commName}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Fecha y Hora:</span> <span style="color: #0f172a; font-weight: 600;">${dateFormatted} (${timeFormatted})</span></div>
            <div><span style="color: #64748b; font-weight: 600;">Emitido por:</span> <span style="color: #0f172a;">${userName} (${userRole})</span></div>
            <div><span style="color: #64748b; font-weight: 600;">Población Analizada:</span> <strong style="color: #0284c7;">${totalPersonas} habitantes ${activeReportesSex === 'all' ? `(Mujeres: ${baseFemales} [${pctFem}%] | Hombres: ${baseMales} [${pctMasc}%])` : `(${activeReportesSex})`}</strong></div>
        </div>

        <!-- Cifras Vitales del Censo (4 KPIs) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #0284c7; border-radius: 6px; padding: 10px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Población Total</div>
                <div style="font-size: 20px; font-weight: 800; color: #0284c7; margin-top: 2px;">${totalPersonas}</div>
                <div style="font-size: 9px; color: #64748b;">100% habitantes</div>
            </div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #10b981; border-radius: 6px; padding: 10px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Menores (0-17)</div>
                <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 2px;">${menoresCount}</div>
                <div style="font-size: 9px; color: #64748b;">${menoresPct}% de la comunidad</div>
            </div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #6366f1; border-radius: 6px; padding: 10px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Adultos (18-59)</div>
                <div style="font-size: 20px; font-weight: 800; color: #6366f1; margin-top: 2px;">${adultosCount}</div>
                <div style="font-size: 9px; color: #64748b;">${adultosPct}% de la comunidad</div>
            </div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #ef4444; border-radius: 6px; padding: 10px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Mayores (60+)</div>
                <div style="font-size: 20px; font-weight: 800; color: #ef4444; margin-top: 2px;">${mayoresCount}</div>
                <div style="font-size: 9px; color: #64748b;">${mayoresPct}% de la comunidad</div>
            </div>
        </div>

        <!-- Sección 1: Estructura por Rangos de Edad -->
        <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">1. Estructura Poblacional por Ciclos de Vida (8 Rangos Oficiales)</h3>
                <span style="font-size: 10px; font-weight: 600; color: #64748b;">Distribución Demográfica Detallada</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f1f5f9; color: #334155; text-align: left;">
                        <th style="padding: 7px 10px; border: 1px solid #e2e8f0; font-weight: 700;">Rango de Edad</th>
                        <th style="padding: 7px 10px; border: 1px solid #e2e8f0; font-weight: 700;">Etapa Demográfica</th>
                        <th style="padding: 7px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center; width: 85px;">Habitantes</th>
                        <th style="padding: 7px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: right; width: 75px;">% Total</th>
                        <th style="padding: 7px 10px; border: 1px solid #e2e8f0; font-weight: 700; width: 175px;">Distribución Visual</th>
                    </tr>
                </thead>
                <tbody>
                    ${ageTableRowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 700; color: #0f172a;">
                        <td colspan="2" style="padding: 8px 10px; border: 1px solid #cbd5e1;">TOTAL GENERAL DE POBLACIÓN</td>
                        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${totalPersonas}</td>
                        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">100.0%</td>
                        <td style="padding: 8px 10px; border: 1px solid #cbd5e1;"></td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- Ficha Complementaria de Organización Social -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 16px; margin-top: 14px;">
            <div><span style="color: #64748b;">Núcleos Familiares Vinculados:</span> <strong style="color: #0f172a;">${totalFamilias} familias</strong></div>
            <div><span style="color: #64748b;">Unidades Habitacionales:</span> <strong style="color: #0f172a;">${totalViviendas} viviendas</strong></div>
        </div>
    `;

    // 2. Procesamiento de Ocupaciones / Profesiones (Lista Completa)
    const rawProfCounts = {};
    filtered.forEach(p => {
        const profObj = db.profesiones ? db.profesiones.find(prof => prof.id_profesion === p.id_profesion) : null;
        const name = profObj ? profObj.nombre_profesion : "Sin ocupación / Estudiante / Hogar";
        rawProfCounts[name] = (rawProfCounts[name] || 0) + 1;
    });
    const sortedProfs = Object.entries(rawProfCounts).sort((a, b) => b[1] - a[1]);
    const profItems = sortedProfs.map(([name, count]) => ({
        name,
        count,
        pct: totalPersonas > 0 ? ((count / totalPersonas) * 100).toFixed(1) : "0.0"
    }));

    // 3. Procesamiento de Discapacidades y Condiciones Especiales (Lista Completa)
    const discCounts = {};
    let totalConDisc = 0;
    filtered.forEach(p => {
        if (p.id_discapacidad && db.discapacidades) {
            const discObj = db.discapacidades.find(d => d.id_discapacidad === p.id_discapacidad);
            const tipo = discObj ? discObj.tipo_discapacidad : "Condición no especificada";
            const nivel = discObj ? discObj.nivel_discapacidad : "General";
            const key = `${tipo} (${nivel})`;
            discCounts[key] = (discCounts[key] || 0) + 1;
            totalConDisc++;
        }
    });
    const totalConDiscPct = totalPersonas > 0 ? ((totalConDisc / totalPersonas) * 100).toFixed(1) : "0.0";
    const discEntries = Object.entries(discCounts).sort((a, b) => b[1] - a[1]);
    const discItems = discEntries.map(([name, count]) => ({
        name,
        count,
        pct: totalPersonas > 0 ? ((count / totalPersonas) * 100).toFixed(1) : "0.0"
    }));

    // Helpers de formateo de tablas
    function renderProfRows(items) {
        if (items.length === 0) {
            return `
                <tr>
                    <td colspan="4" style="padding: 12px; text-align: center; color: #64748b; font-style: italic;">
                        No se registran datos ocupacionales bajo los filtros seleccionados.
                    </td>
                </tr>
            `;
        }
        return items.map((item, index) => {
            const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
            return `
                <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; font-weight: 600; color: #0f172a;">${item.name}</td>
                    <td style="padding: 6px 10px; text-align: center; font-weight: 700; color: #0f172a;">${item.count}</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #334155;">${item.pct}%</td>
                    <td style="padding: 6px 10px;">
                        <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; width: 100%;">
                            <div style="width: ${item.pct}%; background: #6366f1; height: 100%; border-radius: 4px;"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderDiscRows(items) {
        if (items.length === 0) {
            return `
                <tr>
                    <td colspan="3" style="padding: 12px; text-align: center; color: #64748b; font-style: italic;">
                        No se registran habitantes con condiciones especiales bajo los filtros seleccionados.
                    </td>
                </tr>
            `;
        }
        return items.map((item, index) => {
            const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
            return `
                <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; font-weight: 600; color: #0f172a;">${item.name}</td>
                    <td style="padding: 6px 10px; text-align: center; font-weight: 700; color: #0f172a;">${item.count}</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #334155;">${item.pct}%</td>
                </tr>
            `;
        }).join("");
    }

    function chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    // Distribución Dinámica de Páginas (Soporte Multipágina para Informes Extensos)
    const subPagesContent = [];
    const totalCombinedRows = profItems.length + (discItems.length || 1);

    // Si el volumen combinado es moderado (<= 18 filas), entran perfectamente juntos en la Página 2
    if (totalCombinedRows <= 18) {
        subPagesContent.push(`
            <!-- Sección 2: Profesiones y Oficios -->
            <div style="margin-bottom: 22px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">2. Perfil Socio-Productivo y Ocupacional</h3>
                    <span style="font-size: 10px; font-weight: 600; color: #64748b;">${profItems.length} ocupaciones identificadas</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #334155; text-align: left;">
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700;">Ocupación / Oficio</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center; width: 95px;">Habitantes</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: right; width: 85px;">% Total</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; width: 175px;">Proporción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderProfRows(profItems)}
                    </tbody>
                </table>
            </div>

            <!-- Sección 3: Discapacidad y Diagnóstico de Salud -->
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">3. Diagnóstico de Salud y Necesidades Especiales</h3>
                    <span style="font-size: 10px; font-weight: 600; color: #64748b;">Condición de Salud Registrada</span>
                </div>
                
                <!-- Banner de Prevalencia -->
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 14px; margin-bottom: 10px; font-size: 11px; display: flex; justify-content: space-between; color: #92400e;">
                    <div><strong>Prevalencia de Discapacidad:</strong> ${totalConDisc} personas (${totalConDiscPct}% de la población censada)</div>
                    <div><strong>Población sin discapacidad:</strong> ${totalPersonas - totalConDisc} personas</div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #334155; text-align: left;">
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700;">Condición Especial (Tipo y Nivel)</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center; width: 110px;">Casos Registrados</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: right; width: 95px;">% Población</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderDiscRows(discItems)}
                    </tbody>
                </table>
            </div>
        `);
    } else {
        // Reporte extenso: se desglosan en páginas dedicadas de alta legibilidad
        // Paginación de Profesiones (hasta 22 filas por página)
        const profChunks = chunkArray(profItems, 22);
        profChunks.forEach((chunk, chunkIdx) => {
            const isContinuation = chunkIdx > 0;
            const subtitle = isContinuation ? `Continuación (${chunkIdx * 22 + 1} a ${chunkIdx * 22 + chunk.length})` : `${profItems.length} ocupaciones identificadas`;
            subPagesContent.push(`
                <!-- Sección 2: Profesiones y Oficios -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">
                            2. Perfil Socio-Productivo y Ocupacional ${isContinuation ? "(Continuación)" : ""}
                        </h3>
                        <span style="font-size: 10px; font-weight: 600; color: #64748b;">${subtitle}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #334155; text-align: left;">
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700;">Ocupación / Oficio</th>
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center; width: 95px;">Habitantes</th>
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: right; width: 85px;">% Total</th>
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; width: 175px;">Proporción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderProfRows(chunk)}
                        </tbody>
                    </table>
                </div>
            `);
        });

        // Paginación de Discapacidades (hasta 20 filas por página)
        const discChunks = discItems.length > 0 ? chunkArray(discItems, 20) : [[]];
        discChunks.forEach((chunk, chunkIdx) => {
            const isContinuation = chunkIdx > 0;
            const subtitle = isContinuation ? `Continuación (${chunkIdx * 20 + 1} a ${chunkIdx * 20 + chunk.length})` : "Condición de Salud Registrada";
            subPagesContent.push(`
                <!-- Sección 3: Discapacidad y Diagnóstico de Salud -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">
                            3. Diagnóstico de Salud y Necesidades Especiales ${isContinuation ? "(Continuación)" : ""}
                        </h3>
                        <span style="font-size: 10px; font-weight: 600; color: #64748b;">${subtitle}</span>
                    </div>
                    
                    ${!isContinuation ? `
                    <!-- Banner de Prevalencia -->
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 14px; margin-bottom: 10px; font-size: 11px; display: flex; justify-content: space-between; color: #92400e;">
                        <div><strong>Prevalencia de Discapacidad:</strong> ${totalConDisc} personas (${totalConDiscPct}% de la población censada)</div>
                        <div><strong>Población sin discapacidad:</strong> ${totalPersonas - totalConDisc} personas</div>
                    </div>
                    ` : ""}

                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #334155; text-align: left;">
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700;">Condición Especial (Tipo y Nivel)</th>
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center; width: 110px;">Casos Registrados</th>
                                <th style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: right; width: 95px;">% Población</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderDiscRows(chunk)}
                        </tbody>
                    </table>
                </div>
            `);
        });
    }

    const totalPages = 1 + subPagesContent.length;

    // Generador de estructura de página completa con encabezado institucional y pie de página foliado
    function buildPageHtml(pageIndex, contentHtml, isFirstPage = false) {
        const pageNum = pageIndex + 1;
        const headerHtml = isFirstPage ? `
            <!-- Franja Institucional Superior -->
            <div style="height: 6px; background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 70%, #d97706 100%); margin-bottom: 16px; border-radius: 3px;"></div>
            
            <!-- Encabezado Oficial -->
            <div style="text-align: center; margin-bottom: 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase;">República Bolivariana de Venezuela</div>
                <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 3px 0; letter-spacing: -0.5px;">SISTEMA DE GESTIÓN COMUNAL</div>
                <div style="font-size: 13px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Informe Demográfico y Estadístico de la Comunidad ${activeReportesSex === 'Femenino' ? '(Población Femenina)' : (activeReportesSex === 'Masculino' ? '(Población Masculina)' : '')}</div>
            </div>
        ` : `
            <!-- Franja Institucional Superior -->
            <div style="height: 4px; background: #1e3a8a; margin-bottom: 14px; border-radius: 2px;"></div>

            <!-- Encabezado Compacto de Continuidad -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 18px;">
                <div>
                    <strong style="font-size: 13px; color: #1e3a8a;">SISTEMA DE GESTIÓN COMUNAL</strong>
                    <span style="font-size: 11px; color: #64748b; margin-left: 8px;">| Informe Demográfico y Social</span>
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #334155;">Comunidad: ${commName}</div>
            </div>
        `;

        const footerHtml = `
            <!-- Pie de Página Foliado -->
            <div style="position: absolute; bottom: 20px; left: 38px; right: 38px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
                <span>Sistema de Gestión Comunal - Informe Oficial de Consulta Demográfica</span>
                <span>Página ${pageNum} de ${totalPages}</span>
            </div>
        `;

        return `
            <div id="pdf-page-${pageNum}" style="width: 800px; height: 1040px; padding: 32px 38px; box-sizing: border-box; background: #ffffff; position: relative;">
                ${headerHtml}
                ${contentHtml}
                ${footerHtml}
            </div>
        `;
    }

    // Contenedor temporal aislado para renderizado
    const printContainer = document.createElement("div");
    printContainer.id = "sgc-pdf-render-container";
    printContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 800px;
        opacity: 0;
        pointer-events: none;
        background: #ffffff;
        color: #0f172a;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: -9999;
    `;

    printContainer.innerHTML = [
        buildPageHtml(0, page1BodyHtml, true),
        ...subPagesContent.map((content, idx) => buildPageHtml(idx + 1, content, false))
    ].join("");

    document.body.appendChild(printContainer);

    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Renderizado secuencial de cada página con alta resolución (300 DPI aprox. y PNG sin pérdida)
        for (let i = 0; i < totalPages; i++) {
            const pageEl = document.getElementById(`pdf-page-${i + 1}`);
            const canvasPage = await window.html2canvas(pageEl, {
                scale: 3,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false
            });

            const imgData = canvasPage.toDataURL("image/png");
            if (i > 0) doc.addPage();
            doc.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "SLOW");
        }

        document.body.removeChild(printContainer);

        const cleanCommName = commName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
        const fileName = `Informe_Demografico_${cleanCommName}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.pdf`;
        doc.save(fileName);

        showAlert("Informe demográfico en PDF generado con calidad oficial.", "success");
    } catch (error) {
        if (document.body.contains(printContainer)) {
            document.body.removeChild(printContainer);
        }
        console.error("Error generating official PDF report:", error);
        showAlert("Error al generar el informe PDF: " + (error.message || error), "error");
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

    const userRole = db && db.roles ? db.roles.find(r => r.id_rol === currentUser.id_rol) : null;
    const roleName = (userRole ? userRole.nombre_rol : (currentUser.nombre_rol || "")).toLowerCase();
    const roleId = String(currentUser.id_rol || "");

    const isConsultor = roleName.includes("consultor") || roleId === "73ef3e01-65ac-4891-8df9-91db1f6d364b" || roleId === "3" || roleId === "r-3";
    const isLider = roleName.includes("lider") || roleName.includes("líder") || roleId === "6a97aa3d-0b9f-4ea8-9ae8-a9215abf68c3" || roleId === "2" || roleId === "r-2";
    const isAdmin = roleName.includes("administrador") || roleName.includes("admin") || roleId === "eec65b46-ce49-41be-9da7-be001e7ce87e" || roleId === "8c37a94d-7b05-42fc-9fdb-5e4eb8cee87f" || roleId === "1" || roleId === "r-1" || roleId === "r-4";

    // Pestañas de administración (usuarios y parámetros)
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

    if (isConsultor) {
        // Consultor: Modo Solo Lectura en todo el sistema
        // 1. Ocultar botones de crear/agregar
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

        // 2. Ocultar tarjetas de formulario / registro
        const cardsToHide = document.querySelectorAll(".family-form-card, .viviendas-action-card, .form-card");
        cardsToHide.forEach(card => card.style.display = "none");

        // 3. Ocultar todos los botones de acción para crear, editar o eliminar
        const actionElements = document.querySelectorAll(
            ".btn-edit-person, .btn-delete-person, " +
            ".btn-edit-family, .btn-delete-family, " +
            ".btn-tree-edit, .btn-tree-delete, " +
            ".btn-delete-user, .btn-edit-user-role, " +
            ".btn-delete-prof, .btn-delete-disc"
        );
        actionElements.forEach(el => el.style.display = "none");
    }

    if (isLider) {
        // Líder de comunidad:
        // No puede crear, renombrar ni eliminar comunidades globales
        const comBtn = document.getElementById("btn-open-comunidad-modal");
        if (comBtn) comBtn.style.display = "none";

        // Ocultar acciones sobre el nodo de comunidad en el árbol de viviendas
        document.querySelectorAll('.tree-node-actions a[data-type="comunidad"]').forEach(el => {
            el.style.display = "none";
        });
    }
}

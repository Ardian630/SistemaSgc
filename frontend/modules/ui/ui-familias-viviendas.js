import { dbFetchAll, activeCommunity, treeEditIcon, treeDeleteIcon } from "./ui-common.js";
import { getCurrentUser } from "../../auth.js";
import { applyRoleUI_Restrictions } from "./ui-roles.js";
import { uiDeleteFamilia } from "./ui-crud.js";
import { populateSelects } from "./ui-forms.js";

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


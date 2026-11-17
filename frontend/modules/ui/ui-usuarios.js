import { dbFetchAll, activeCommunity } from "./ui-common.js";
import { getCurrentUser } from "../../auth.js";
import { showAlert } from "../../notifications.js";
import { apiUpdateMisDatos as apiUpdateMisDatosClient, apiUpdateUserRole as apiUpdateUserRoleClient } from "../../supabase-client.js";
import { applyRoleUI_Restrictions } from "./ui-roles.js";
import { uiDeleteUsuario } from "./ui-crud.js";

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
// EDICIÓN DE PERFIL Y ROLES
// =========================================================================

export async function uiUpdateMisDatos(nombre, telefono) {
    const { getCurrentUser } = await import('../auth.js').catch(() => window);
    const currentUser = getCurrentUser ? getCurrentUser() : null;
    
    if (!currentUser) throw new Error("No hay usuario autenticado.");

    await apiUpdateMisDatosClient(currentUser.id_usuario, nombre, telefono);
        
    // Actualizamos currentUser en el DOM
    const nameEl = document.getElementById("current-user-name");
    if (nameEl) nameEl.textContent = nombre;
}

export async function uiOpenEditRoleModal(id_usuario) {
    const db = await dbFetchAll();
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


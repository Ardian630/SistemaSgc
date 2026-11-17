import { dbFetchAll } from "./ui-common.js";
import { showAlert, showConfirm } from "../../notifications.js";
import {
    apiDeleteProfesion,
    apiDeleteDiscapacidad,
    apiUpdateProfesion,
    apiCreateProfesion,
    apiUpdateDiscapacidad,
    apiCreateDiscapacidad
} from "../../supabase-client.js";
import { populateSelects, populateProfessionsChecklist, populatePersonaModalSelects } from "./ui-forms.js";
import { applyRoleUI_Restrictions } from "./ui-roles.js";

// =========================================================================
// PARÁMETROS (PROFESIONES Y DISCAPACIDADES)
// =========================================================================

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


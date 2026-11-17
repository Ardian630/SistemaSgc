import { dbFetchAll } from "./ui-common.js";
import { getCurrentUser } from "../../auth.js";

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


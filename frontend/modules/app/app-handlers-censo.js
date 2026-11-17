// =========================================================================
// SGC - MÓDULO DE CONTROLADORES DE CENSO (PERSONAS, FAMILIAS, VIVIENDAS)
// Procesa altas, modificaciones, asociaciones y eliminaciones del censo demográfico.
// =========================================================================

import { showAlert, showConfirm } from "../../notifications.js";
import {
    dbFetchAll,
    uiCreatePersona,
    uiUpdatePersona,
    uiCreateNucleo,
    uiCreateComunidad,
    uiCreateEdificio,
    uiCreateVivienda,
    uiUpdateComunidad,
    uiDeleteComunidad,
    uiUpdateEdificio,
    uiDeleteEdificio,
    uiUpdateVivienda,
    uiDeleteVivienda,
    uiAsociarPersonaFamilia,
    uiUpdateFamily,
    renderPersonasTable,
    renderFamilias,
    renderViviendasTree,
    renderDashboard,
    populateSelects,
    populateViviendaModalSelects
} from "../../ui.js";

import {
    apiAsignarPersonaSueltaAVivienda,
    apiAsociarNucleoVivienda
} from "../../supabase-client.js";

export async function handlePersonaSubmit(e) {
    e.preventDefault();

    const personaId = document.getElementById("persona-id").value;

    const nucleoSelection = document.getElementById("persona-nucleo").value || "";
    let finalIdNucleo = null;
    let targetViviendaId = null;

    if (nucleoSelection.startsWith("fam_")) {
        finalIdNucleo = nucleoSelection.split("_")[1];
    } else if (nucleoSelection.startsWith("viv_")) {
        targetViviendaId = nucleoSelection.split("_")[1];
    }

    const personaData = {
        id_nucleo: finalIdNucleo,
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

    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(personaData.nombre_completo)) {
        showAlert("Los nombres no pueden contener números.", "error");
        return;
    }

    const cedulaRegex = /^\d{6,9}$/;
    if (!cedulaRegex.test(personaData.cedula_identidad)) {
        showAlert("La cédula debe contener solo números (entre 6 y 9 dígitos).", "error");
        return;
    }

    if (personaData.telefono) {
        const phoneRegex = /^04(12|14|16|24|26)-\d{7}$/;
        if (!phoneRegex.test(personaData.telefono)) {
            showAlert("El teléfono debe tener el formato 04xx-xxxxxxx", "error");
            return;
        }
    }

    try {
        if (personaId) {
            await uiUpdatePersona(personaId, personaData);
            if (targetViviendaId) {
                const newFamName = `Familia de ${personaData.nombre_completo}`;
                await apiAsignarPersonaSueltaAVivienda(newFamName, targetViviendaId, personaId);
            }
            showAlert("Datos de la persona actualizados con éxito.", "success");
        } else {
            const createdPersona = await uiCreatePersona(personaData);
            if (targetViviendaId && createdPersona) {
                const newFamName = `Familia de ${createdPersona.nombre_completo}`;
                await apiAsignarPersonaSueltaAVivienda(newFamName, targetViviendaId, createdPersona.id_persona);
            }
            showAlert("Persona registrada con éxito.", "success");
        }
        e.target.reset();
        document.getElementById("persona-id").value = "";
        document.getElementById("modal-persona").classList.add("hidden");

        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar persona: " + (err.message || err), "error");
    }
}

export async function handleFamiliaSubmit(e) {
    e.preventDefault();

    const jefeSelect = document.getElementById("fam-jefe");
    const jefeId = jefeSelect ? jefeSelect.value : null;
    const viviendaId = document.getElementById("fam-vivienda").value || null;
    const nombreFam = document.getElementById("fam-nombre").value;

    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(nombreFam)) {
        showAlert("El nombre de la familia no puede contener números.", "error");
        return;
    }

    try {
        await uiCreateNucleo(nombreFam, viviendaId, jefeId);
        e.target.reset();
        document.getElementById("modal-familia").classList.add("hidden");

        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
        showAlert("Núcleo familiar creado exitosamente.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al crear núcleo familiar: " + (err.message || err), "error");
    }
}

export async function handleComunidadSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("com-id").value;
    const nombre = document.getElementById("com-nombre").value;

    try {
        if (id) {
            await uiUpdateComunidad(id, nombre);
            showAlert(`Comunidad "${nombre}" actualizada.`, "success");
        } else {
            await uiCreateComunidad(nombre);
            showAlert(`Comunidad "${nombre}" agregada.`, "success");
        }
        e.target.reset();
        document.getElementById("com-id").value = "";
        document.getElementById("modal-comunidad").classList.add("hidden");
        document.getElementById("modal-comunidad-title").textContent = "Agregar Comunidad";
        await populateSelects();
        await populateViviendaModalSelects();
        await renderViviendasTree();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar comunidad: " + (err.message || err), "error");
    }
}

export async function handleEdificioSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("edf-id").value;
    const comId = document.getElementById("edf-comunidad").value;
    const nombre = document.getElementById("edf-nombre").value;

    try {
        if (id) {
            await uiUpdateEdificio(id, comId, nombre);
            showAlert(`Edificio "${nombre}" actualizado.`, "success");
        } else {
            await uiCreateEdificio(nombre, comId);
            showAlert(`Edificio "${nombre}" registrado.`, "success");
        }
        e.target.reset();
        document.getElementById("edf-id").value = "";
        document.getElementById("modal-edificio").classList.add("hidden");
        document.getElementById("modal-edificio-title").textContent = "Agregar Edificio";
        await renderViviendasTree();
        await populateSelects();
        await populateViviendaModalSelects();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar edificio: " + (err.message || err), "error");
    }
}

export async function handleViviendaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("viv-id").value;
    const comId = document.getElementById("viv-comunidad").value;
    const edfId = document.getElementById("viv-edificio").value || null;
    const numero = document.getElementById("viv-numero").value;
    const bloque = document.getElementById("viv-bloque").value || null;

    try {
        if (id) {
            await uiUpdateVivienda(id, comId, edfId, numero, bloque);
            showAlert(`Vivienda "${numero}" actualizada con éxito.`, "success");
        } else {
            await uiCreateVivienda(comId, edfId, numero, bloque);
            showAlert(`Vivienda "${numero}" registrada con éxito.`, "success");
        }
        e.target.reset();
        document.getElementById("viv-id").value = "";
        document.getElementById("modal-vivienda").classList.add("hidden");
        document.getElementById("modal-vivienda-title").textContent = "Registrar Nueva Vivienda";
        await populateSelects();
        await renderViviendasTree();
    } catch (err) {
        console.error(err);
        showAlert("Error al guardar vivienda: " + (err.message || err), "error");
    }
}

export async function handleAsociarPersonaFamilia(e) {
    e.preventDefault();
    const personaId = document.getElementById("asociar-persona-select").value;
    const familiaId = document.getElementById("asociar-familia-select").value;

    try {
        await uiAsociarPersonaFamilia(personaId, familiaId);
        showAlert("Persona asociada al núcleo familiar.", "success");
        e.target.reset();

        await renderFamilias();
        await renderPersonasTable();
        await populateSelects();
        await renderDashboard();
    } catch (err) {
        console.error(err);
        showAlert("Error al asociar persona: " + (err.message || err), "error");
    }
}

export async function handleAsociarFamiliaVivienda(e) {
    e.preventDefault();
    const selection = document.getElementById("vivienda-asoc-familia").value;
    const viviendaId = document.getElementById("vivienda-asoc-vivienda").value;

    try {
        const db = await dbFetchAll();

        let targetNucleoId = selection.startsWith("fam_") ? selection.split("_")[1] : null;

        // Verificar si la vivienda destino ya está ocupada por otro núcleo familiar
        const isOccupied = db.nucleos.some(n => n.id_vivienda === viviendaId && n.id_nucleo !== targetNucleoId);

        let confirmMsg = "¿Está seguro que desea trasladar al grupo a esta nueva vivienda?";
        if (isOccupied) {
            confirmMsg = "La vivienda seleccionada ya se encuentra habitada por otra familia. ¿Desea trasladarlos allí de todas formas?";
        }

        const confirmed = await showConfirm(confirmMsg);
        if (!confirmed) return;

        if (selection.startsWith("fam_")) {
            await apiAsociarNucleoVivienda(targetNucleoId, viviendaId);
            showAlert("Núcleo familiar reubicado en la vivienda seleccionada.", "success");
        } else if (selection.startsWith("per_")) {
            const personaId = selection.split("_")[1];
            const persona = db.personas.find(p => p.id_persona === personaId);

            const newFamName = `Familia de ${persona.nombre_completo}`;
            await apiAsignarPersonaSueltaAVivienda(newFamName, viviendaId, persona.id_persona);

            showAlert("Persona asignada a la vivienda (se creó su núcleo familiar de 1 persona).", "success");
        }

        e.target.reset();

        await renderFamilias();
        await renderViviendasTree();
        await populateSelects();
    } catch (err) {
        console.error(err);
        showAlert("Error al asociar a vivienda: " + (err.message || err), "error");
    }
}

export async function handleEditarFamiliaSubmit(e) {
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
        showAlert("Núcleo familiar actualizado con éxito.", "success");
    } catch (err) {
        console.error(err);
        showAlert("Error al actualizar núcleo familiar: " + (err.message || err), "error");
    }
}

// Configurar acciones globales expuestas en window para vistas interactivas (árbol, tablas)
export function initCensoWindowActions() {
    window.editComunidad = async (id) => {
        const db = await dbFetchAll();
        const c = db.comunidades.find(x => x.id_comunidad === id);
        if (!c) return;
        document.getElementById("com-id").value = c.id_comunidad;
        document.getElementById("com-nombre").value = c.nombre_comunidad;
        document.getElementById("modal-comunidad-title").textContent = "Editar Comunidad";
        document.getElementById("modal-comunidad").classList.remove("hidden");
    };

    window.deleteComunidad = async (id) => {
        const confirmed = await showConfirm("¿Está seguro que desea eliminar esta comunidad? Se eliminarán todos sus edificios y viviendas asociados.");
        if (!confirmed) return;
        try {
            await uiDeleteComunidad(id);
            showAlert("Comunidad eliminada con éxito.", "success");
            await populateSelects();
            await renderViviendasTree();
        } catch (err) {
            showAlert("Error al eliminar comunidad: " + err.message, "error");
        }
    };

    window.editEdificio = async (id) => {
        const db = await dbFetchAll();
        const e = db.edificios.find(x => x.id_edificio === id);
        if (!e) return;
        document.getElementById("edf-id").value = e.id_edificio;
        document.getElementById("edf-comunidad").value = e.id_comunidad;
        document.getElementById("edf-nombre").value = e.nombre_edificio;
        document.getElementById("modal-edificio-title").textContent = "Editar Edificio";
        document.getElementById("modal-edificio").classList.remove("hidden");
    };

    window.deleteEdificio = async (id) => {
        const confirmed = await showConfirm("¿Está seguro que desea eliminar este edificio? Se eliminarán las viviendas asociadas.");
        if (!confirmed) return;
        try {
            await uiDeleteEdificio(id);
            showAlert("Edificio eliminado con éxito.", "success");
            await renderViviendasTree();
        } catch (err) {
            showAlert("Error al eliminar edificio: " + err.message, "error");
        }
    };

    window.editVivienda = async (id) => {
        await populateViviendaModalSelects(); // Llenar el select de comunidades
        const db = await dbFetchAll();
        const v = db.viviendas.find(x => x.id_vivienda === id);
        if (!v) return;
        document.getElementById("viv-id").value = v.id_vivienda;
        document.getElementById("viv-comunidad").value = v.id_comunidad;

        // Disparar change en comunidad para actualizar edificios
        const comSelect = document.getElementById("viv-comunidad");
        comSelect.dispatchEvent(new Event("change"));

        setTimeout(() => {
            document.getElementById("viv-edificio").value = v.id_edificio || "";
            document.getElementById("viv-numero").value = v.numero_vivienda;
            document.getElementById("viv-bloque").value = v.bloque || "";
            document.getElementById("modal-vivienda-title").textContent = "Editar Vivienda";
            document.getElementById("modal-vivienda").classList.remove("hidden");
        }, 100);
    };

    window.deleteVivienda = async (id) => {
        const confirmed = await showConfirm("¿Está seguro que desea eliminar esta vivienda? Se desvincularán las familias asociadas.");
        if (!confirmed) return;
        try {
            await uiDeleteVivienda(id);
            showAlert("Vivienda eliminada con éxito.", "success");
            await renderViviendasTree();
        } catch (err) {
            showAlert("Error al eliminar vivienda: " + err.message, "error");
        }
    };
}


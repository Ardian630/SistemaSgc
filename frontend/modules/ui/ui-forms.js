import { dbFetchAll, setActiveCommunity } from "./ui-common.js";
import { getCurrentUser } from "../../auth.js";
import { renderPersonasTable } from "./ui-personas.js";

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
    
    const currentUser = getCurrentUser();
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


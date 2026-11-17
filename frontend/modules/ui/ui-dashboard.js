import { dbFetchAll, activeCommunity } from "./ui-common.js";
import { applyRoleUI_Restrictions } from "./ui-roles.js";

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


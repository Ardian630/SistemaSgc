import { dbFetchAll, activeCommunity } from "./ui-common.js";

// =========================================================================
// REPORTES GRÁFICOS (CHART.JS)
// =========================================================================

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


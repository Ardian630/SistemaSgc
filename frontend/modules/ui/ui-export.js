import { showAlert } from "../../notifications.js";
import { getCurrentUser } from "../../auth.js";
import { dbFetchAll, activeCommunity } from "./ui-common.js";
import { getFilteredPersonas } from "./ui-personas.js";
import { activeReportesSex } from "./ui-reportes.js";

// =========================================================================
// EXPORTACIÓN DE REPORTES PDF Y EXCEL
// =========================================================================

// Generador de Contenido Exclusivo para la Hoja de Pirámide Demográfica
export function buildPyramidPageBodyHtml({
    commName,
    totalPersonas,
    baseMales,
    baseFemales,
    pctMasc,
    pctFem,
    pyramidData,
    maxSideCount,
    menoresCount,
    menoresPct,
    adultosCount,
    adultosPct,
    mayoresCount,
    mayoresPct
}) {
    // Filas de las 8 Cohortes de la Pirámide Bilateral
    const pyramidRowsHtml = pyramidData.map(item => {
        const malePctBar = Math.round((item.male / maxSideCount) * 100);
        const femalePctBar = Math.round((item.female / maxSideCount) * 100);
        const malePctCohort = baseMales > 0 ? ((item.male / baseMales) * 100).toFixed(0) : 0;
        const femalePctCohort = baseFemales > 0 ? ((item.female / baseFemales) * 100).toFixed(0) : 0;

        return `
            <div style="display: grid; grid-template-columns: 1fr 88px 1fr; align-items: center; gap: 10px; padding: 3px 0;">
                <!-- Lado Hombres (Izquierda: Barra nace del centro y crece hacia la izquierda) -->
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; min-width: 28px; text-align: left;">${malePctCohort}%</span>
                    <span style="font-size: 11px; font-weight: 800; color: #0f172a; min-width: 20px; text-align: right;">${item.male}</span>
                    <div style="flex-grow: 1; height: 12px; background: #e2e8f0; border-radius: 4px; display: flex; justify-content: flex-end; overflow: hidden;">
                        <div style="width: ${malePctBar}%; background: linear-gradient(90deg, #6366f1, #38bdf8); height: 100%; border-radius: 4px;"></div>
                    </div>
                </div>

                <!-- Eje Central (Cohorte de Edad) -->
                <div style="text-align: center; font-size: 10px; font-weight: 700; color: #1e3a8a; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 6px; border-radius: 4px; white-space: nowrap;">
                    ${item.label}
                </div>

                <!-- Lado Mujeres (Derecha: Barra nace del centro y crece hacia la derecha) -->
                <div style="display: flex; align-items: center; justify-content: flex-start; gap: 8px;">
                    <div style="flex-grow: 1; height: 12px; background: #e2e8f0; border-radius: 4px; display: flex; justify-content: flex-start; overflow: hidden;">
                        <div style="width: ${femalePctBar}%; background: linear-gradient(90deg, #ec4899, #f43f5e); height: 100%; border-radius: 4px;"></div>
                    </div>
                    <span style="font-size: 11px; font-weight: 800; color: #0f172a; min-width: 20px; text-align: left;">${item.female}</span>
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; min-width: 28px; text-align: right;">${femalePctCohort}%</span>
                </div>
            </div>
        `;
    }).join("");

    const tableCohortRowsHtml = pyramidData.map((item, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        return `
            <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0; font-size: 10px;">
                <td style="padding: 5px 8px; font-weight: 700; color: #1e3a8a;">${item.label}</td>
                <td style="padding: 5px 8px; color: #475569;">${item.etapa}</td>
                <td style="padding: 5px 8px; text-align: center; font-weight: 700; color: #2563eb;">${item.male} (${baseMales > 0 ? ((item.male / baseMales) * 100).toFixed(1) : 0}%)</td>
                <td style="padding: 5px 8px; text-align: center; font-weight: 700; color: #db2777;">${item.female} (${baseFemales > 0 ? ((item.female / baseFemales) * 100).toFixed(1) : 0}%)</td>
                <td style="padding: 5px 8px; text-align: center; font-weight: 800; color: #0f172a;">${item.total}</td>
                <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #334155;">${item.pctTotal}%</td>
            </tr>
        `;
    }).join("");

    const sexRatio = baseFemales > 0 ? (baseMales / baseFemales).toFixed(2) : (baseMales > 0 ? "N/A" : "1.00");

    return `
        <!-- Encabezado de Sección en Hoja Exclusiva -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 14px;">
            <div>
                <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">
                    Pirámide Demográfica Bilateral (Edad y Sexo)
                </h3>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                    Estructura demográfica continua por cohortes generacionales
                </div>
            </div>
            <div style="font-size: 10px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 4px;">
                ${totalPersonas} Habitantes Evaluados
            </div>
        </div>

        <!-- Ficha de Resumen Demográfico de la Pirámide (3 KPIs) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px;">
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; text-align: center;">
                <div style="font-size: 9px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Población Masculina</div>
                <div style="font-size: 17px; font-weight: 800; color: #2563eb; margin: 2px 0;">${baseMales} hab.</div>
                <div style="font-size: 10px; font-weight: 600; color: #3b82f6;">${pctMasc}% del censo</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; text-align: center;">
                <div style="font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase;">Razón de Sexos</div>
                <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 2px 0;">${sexRatio}</div>
                <div style="font-size: 10px; font-weight: 600; color: #64748b;">Hombres por cada mujer</div>
            </div>
            <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 6px; padding: 8px 12px; text-align: center;">
                <div style="font-size: 9px; font-weight: 700; color: #9d174d; text-transform: uppercase;">Población Femenina</div>
                <div style="font-size: 17px; font-weight: 800; color: #db2777; margin: 2px 0;">${baseFemales} hab.</div>
                <div style="font-size: 10px; font-weight: 600; color: #ec4899;">${pctFem}% del censo</div>
            </div>
        </div>

        <!-- Contenedor Visual de la Pirámide Demográfica Bilateral -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px;">
            <!-- Leyenda Superior -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; font-size: 11px; font-weight: 700;">
                <span style="color: #2563eb; display: inline-flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 8px; height: 8px; background: #38bdf8; border-radius: 50%;"></span>
                    Hombres (${baseMales} hab. - ${pctMasc}%)
                </span>
                <span style="color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Eje Central de Cohortes</span>
                <span style="color: #db2777; display: inline-flex; align-items: center; gap: 6px;">
                    Mujeres (${baseFemales} hab. - ${pctFem}%)
                    <span style="display: inline-block; width: 8px; height: 8px; background: #ec4899; border-radius: 50%;"></span>
                </span>
            </div>

            <!-- Filas de las 8 Cohortes -->
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${pyramidRowsHtml}
            </div>
        </div>

        <!-- Tabla Sintética de Distribución Etaria Bilateral -->
        <div style="margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 5px;">
                Distribución Analítica por Cohorte y Sexo
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9; color: #334155; text-align: left; font-size: 10px;">
                        <th style="padding: 4px 8px; border: 1px solid #e2e8f0; font-weight: 700;">Cohorte</th>
                        <th style="padding: 4px 8px; border: 1px solid #e2e8f0; font-weight: 700;">Etapa Demográfica</th>
                        <th style="padding: 4px 8px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">Hombres (% Masc.)</th>
                        <th style="padding: 4px 8px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">Mujeres (% Fem.)</th>
                        <th style="padding: 4px 8px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">Total Cohorte</th>
                        <th style="padding: 4px 8px; border: 1px solid #e2e8f0; font-weight: 700; text-align: right;">% Población</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableCohortRowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 700; color: #0f172a; font-size: 10px;">
                        <td colspan="2" style="padding: 5px 8px; border: 1px solid #cbd5e1;">TOTAL POBLACIÓN</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #2563eb;">${baseMales} (100%)</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #db2777;">${baseFemales} (100%)</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${totalPersonas}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">100.0%</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- Indicadores de Dependencia y Ciclos Vitales -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 12px; font-size: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div><span style="color: #64748b;">Base Infanto-Juvenil (0-17):</span> <strong style="color: #0284c7;">${menoresCount} hab. (${menoresPct}%)</strong></div>
            <div><span style="color: #64748b;">Población Activa (18-59):</span> <strong style="color: #10b981;">${adultosCount} hab. (${adultosPct}%)</strong></div>
            <div><span style="color: #64748b;">Cúspide Adultos Mayores (60+):</span> <strong style="color: #ef4444;">${mayoresCount} hab. (${mayoresPct}%)</strong></div>
        </div>
    `;
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
    let commName = "Todas las Comunidades";
    if (typeof activeCommunity !== "undefined" && activeCommunity !== "all") {
        const c = db.comunidades.find(x => x.id_comunidad === activeCommunity);
        if (c) commName = c.nombre_comunidad;
    }

    const currentUser = getCurrentUser();
    const userName = currentUser ? (currentUser.nombre_completo || currentUser.email) : "Usuario del Sistema";

    const poblacionTxt = activeReportesSex === "all"
        ? `${totalPersonas} habitantes`
        : `${totalPersonas} habitantes (${activeReportesSex})`;

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

    const today = new Date();

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
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px 16px; font-size: 11px;">
            <div><span style="color: #64748b; font-weight: 600;">Comunidad:</span> <strong style="color: #0f172a;">${commName}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Fecha y Hora:</span> <span style="color: #0f172a; font-weight: 600;">${dateFormatted} (${timeFormatted})</span></div>
            <div><span style="color: #64748b; font-weight: 600;">Emitido por:</span> <strong style="color: #0f172a;">${userName}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Población Analizada:</span> <strong style="color: #0284c7;">${poblacionTxt}</strong></div>
        </div>

        <!-- Cifras Vitales del Censo (4 KPIs) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
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

        ${activeReportesSex === 'all' ? `
        <!-- Apartado: Composición Demográfica por Sexo (Mujeres y Hombres) -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">Distribución Demográfica por Sexo</span>
                <span style="font-size: 10px; color: #64748b; font-weight: 600;">Total Evaluado: ${totalPersonas} habitantes</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between; background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 6px; padding: 7px 14px;">
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #9d174d; text-transform: uppercase;">Población Femenina</div>
                        <div style="font-size: 15px; font-weight: 800; color: #db2777; margin-top: 1px;">${baseFemales} <span style="font-size: 10px; font-weight: 600;">habitantes</span></div>
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: #db2777;">${pctFem}%</div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 7px 14px;">
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Población Masculina</div>
                        <div style="font-size: 15px; font-weight: 800; color: #2563eb; margin-top: 1px;">${baseMales} <span style="font-size: 10px; font-weight: 600;">habitantes</span></div>
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: #2563eb;">${pctMasc}%</div>
                </div>
            </div>
            <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; display: flex; width: 100%;">
                <div style="width: ${pctFem}%; background: #ec4899; height: 100%;" title="Femenino: ${pctFem}%"></div>
                <div style="width: ${pctMasc}%; background: #3b82f6; height: 100%;" title="Masculino: ${pctMasc}%"></div>
            </div>
        </div>
        ` : ''}

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

    // 4. Datos Estructurados para la Pirámide Demográfica Bilateral (8 Cohortes de 60+ a 0-1)
    const pyramidBrackets = [
        { label: "60+ años", etapa: "Adultos Mayores (60+)", min: 60, max: 200 },
        { label: "55 - 59", etapa: "Adultos Pre-Tercera Edad", min: 55, max: 59 },
        { label: "36 - 54", etapa: "Adultez Media", min: 36, max: 54 },
        { label: "18 - 35", etapa: "Juventud y Adultez Temprana", min: 18, max: 35 },
        { label: "14 - 17", etapa: "Adolescencia", min: 14, max: 17 },
        { label: "6 - 13", etapa: "Niñez / Edad Escolar", min: 6, max: 13 },
        { label: "2 - 5", etapa: "Primera Infancia", min: 2, max: 5 },
        { label: "0 - 1 año", etapa: "Lactantes", min: 0, max: 1 }
    ];

    const pyramidData = pyramidBrackets.map(b => {
        let male = 0;
        let female = 0;
        filtered.forEach(p => {
            if (!p.fecha_nacimiento) return;
            const birthDate = new Date(p.fecha_nacimiento);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            age = Math.max(0, age);
            if (age >= b.min && age <= b.max) {
                if (p.genero === "Masculino") male++;
                else if (p.genero === "Femenino") female++;
            }
        });
        const total = male + female;
        const pctTotal = totalPersonas > 0 ? ((total / totalPersonas) * 100).toFixed(1) : "0.0";
        return { ...b, male, female, total, pctTotal };
    });

    const maxSideCount = Math.max(...pyramidData.map(d => Math.max(d.male, d.female)), 1);

    const pyramidPageHtml = buildPyramidPageBodyHtml({
        commName,
        totalPersonas,
        baseMales,
        baseFemales,
        pctMasc,
        pctFem,
        pyramidData,
        maxSideCount,
        menoresCount,
        menoresPct,
        adultosCount,
        adultosPct,
        mayoresCount,
        mayoresPct
    });

    // Distribución Dinámica de Páginas (Soporte Multipágina para Informes Extensos)
    // La pirámide demográfica se ubica SIEMPRE en su propia hoja aparte (Página 2), aislada de las demás.
    const subPagesContent = [pyramidPageHtml];
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
                <div style="font-size: 13px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Informe Demográfico y Estadístico de la Comunidad</div>
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

// Exportar Exclusivamente la Hoja de la Pirámide Demográfica en PDF
export async function exportarPiramidePDF() {
    if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
        showAlert("Las librerías jsPDF o html2canvas no se han cargado.", "error");
        return;
    }

    showAlert("Generando hoja oficial de la Pirámide Demográfica en PDF...", "info");

    const { jsPDF } = window.jspdf;
    const db = await dbFetchAll();
    const filtered = getFilteredPersonas(db);
    const totalPersonas = filtered.length;

    const baseFemales = filtered.filter(p => p.genero === "Femenino").length;
    const baseMales = filtered.filter(p => p.genero === "Masculino").length;
    const pctFem = totalPersonas > 0 ? Math.round((baseFemales / totalPersonas) * 100) : 0;
    const pctMasc = totalPersonas > 0 ? Math.round((baseMales / totalPersonas) * 100) : 0;

    let commName = "Todas las Comunidades";
    if (typeof activeCommunity !== "undefined" && activeCommunity !== "all") {
        const c = db.comunidades.find(x => x.id_comunidad === activeCommunity);
        if (c) commName = c.nombre_comunidad;
    }

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

    const pyramidBrackets = [
        { label: "60+ años", etapa: "Adultos Mayores (60+)", min: 60, max: 200 },
        { label: "55 - 59", etapa: "Adultos Pre-Tercera Edad", min: 55, max: 59 },
        { label: "36 - 54", etapa: "Adultez Media", min: 36, max: 54 },
        { label: "18 - 35", etapa: "Juventud y Adultez Temprana", min: 18, max: 35 },
        { label: "14 - 17", etapa: "Adolescencia", min: 14, max: 17 },
        { label: "6 - 13", etapa: "Niñez / Edad Escolar", min: 6, max: 13 },
        { label: "2 - 5", etapa: "Primera Infancia", min: 2, max: 5 },
        { label: "0 - 1 año", etapa: "Lactantes", min: 0, max: 1 }
    ];

    const today = new Date();
    const pyramidData = pyramidBrackets.map(b => {
        let male = 0;
        let female = 0;
        filtered.forEach(p => {
            if (!p.fecha_nacimiento) return;
            const birthDate = new Date(p.fecha_nacimiento);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            age = Math.max(0, age);
            if (age >= b.min && age <= b.max) {
                if (p.genero === "Masculino") male++;
                else if (p.genero === "Femenino") female++;
            }
        });
        const total = male + female;
        const pctTotal = totalPersonas > 0 ? ((total / totalPersonas) * 100).toFixed(1) : "0.0";
        return { ...b, male, female, total, pctTotal };
    });

    const maxSideCount = Math.max(...pyramidData.map(d => Math.max(d.male, d.female)), 1);

    const menoresCount = pyramidData.slice(4, 8).reduce((sum, b) => sum + b.total, 0);
    const adultosCount = pyramidData.slice(1, 4).reduce((sum, b) => sum + b.total, 0);
    const mayoresCount = pyramidData[0].total;
    const menoresPct = totalPersonas > 0 ? ((menoresCount / totalPersonas) * 100).toFixed(1) : "0.0";
    const adultosPct = totalPersonas > 0 ? ((adultosCount / totalPersonas) * 100).toFixed(1) : "0.0";
    const mayoresPct = totalPersonas > 0 ? ((mayoresCount / totalPersonas) * 100).toFixed(1) : "0.0";

    const pyramidContent = buildPyramidPageBodyHtml({
        commName,
        totalPersonas,
        baseMales,
        baseFemales,
        pctMasc,
        pctFem,
        pyramidData,
        maxSideCount,
        menoresCount,
        menoresPct,
        adultosCount,
        adultosPct,
        mayoresCount,
        mayoresPct
    });

    const printContainer = document.createElement("div");
    printContainer.id = "sgc-pyramid-pdf-render";
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

    printContainer.innerHTML = `
        <div id="pdf-single-pyramid-page" style="width: 800px; height: 1040px; padding: 32px 38px; box-sizing: border-box; background: #ffffff; position: relative;">
            <!-- Franja Institucional Superior -->
            <div style="height: 6px; background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 70%, #d97706 100%); margin-bottom: 16px; border-radius: 3px;"></div>
            
            <!-- Encabezado Oficial -->
            <div style="text-align: center; margin-bottom: 14px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase;">República Bolivariana de Venezuela</div>
                <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 3px 0; letter-spacing: -0.5px;">SISTEMA DE GESTIÓN COMUNAL</div>
                <div style="font-size: 13px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Informe Demográfico de Pirámide Poblacional</div>
            </div>

            <!-- Ficha de Datos Básicos -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; font-size: 11px;">
                <div><span style="color: #64748b; font-weight: 600;">Comunidad:</span> <strong style="color: #0f172a;">${commName}</strong></div>
                <div><span style="color: #64748b; font-weight: 600;">Fecha y Hora:</span> <span style="color: #0f172a; font-weight: 600;">${dateFormatted} (${timeFormatted})</span></div>
            </div>

            ${pyramidContent}

            <!-- Pie de Página Foliado -->
            <div style="position: absolute; bottom: 20px; left: 38px; right: 38px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
                <span>Sistema de Gestión Comunal - Hoja Oficial de Pirámide Demográfica</span>
                <span>Hoja 1 de 1</span>
            </div>
        </div>
    `;

    document.body.appendChild(printContainer);

    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const pageEl = document.getElementById("pdf-single-pyramid-page");
        const canvasPage = await window.html2canvas(pageEl, {
            scale: 3,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false
        });

        const imgData = canvasPage.toDataURL("image/png");
        doc.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "SLOW");

        document.body.removeChild(printContainer);

        const cleanCommName = commName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
        const fileName = `Piramide_Demografica_${cleanCommName}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.pdf`;
        doc.save(fileName);

        showAlert("Hoja de Pirámide Demográfica generada con éxito.", "success");
    } catch (error) {
        if (document.body.contains(printContainer)) {
            document.body.removeChild(printContainer);
        }
        console.error("Error generating pyramid PDF:", error);
        showAlert("Error al generar la pirámide en PDF: " + (error.message || error), "error");
    }
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


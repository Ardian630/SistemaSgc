// =========================================================================
// SGC - MÓDULO DE GESTIÓN DE TEMA (CLARO / OSCURO)
// Controla el alternador de tema visual y su persistencia.
// =========================================================================

import { renderCharts } from "../../ui.js";

export function initTheme() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (!themeBtn) return;

    const moonIcon = themeBtn.querySelector(".theme-icon-moon");
    const sunIcon = themeBtn.querySelector(".theme-icon-sun");

    const applyTheme = (isLight) => {
        if (isLight) {
            document.body.classList.add("light-theme");
            if (moonIcon) moonIcon.classList.add("hidden");
            if (sunIcon) sunIcon.classList.remove("hidden");
        } else {
            document.body.classList.remove("light-theme");
            if (moonIcon) moonIcon.classList.remove("hidden");
            if (sunIcon) sunIcon.classList.add("hidden");
        }

        // Si el panel de reportes gráficos está visible, redibujar gráficos con la paleta correspondiente
        const reportesPanel = document.getElementById("panel-reportes");
        if (reportesPanel && reportesPanel.classList.contains("active")) {
            renderCharts();
        }
    };

    const savedTheme = localStorage.getItem("theme");
    applyTheme(savedTheme === "light");

    themeBtn.addEventListener("click", () => {
        const isLightNow = !document.body.classList.contains("light-theme");
        applyTheme(isLightNow);
        localStorage.setItem("theme", isLightNow ? "light" : "dark");
    });
}


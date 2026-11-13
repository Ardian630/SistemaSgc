import { showAlert, showConfirm } from './notifications.js';
import {
    supabase,
    isSupabaseConnected,
    apiLogin,
    apiLogout,
    apiRegisterAdmin,
    apiGetRoles
} from "./supabase-client.js";

let currentUser = null;

export function isUserAdmin(user = null) {
    const u = user || currentUser;
    if (!u) return false;
    const adminUuids = [
        "eec65b46-ce49-41be-9da7-be001e7ce87e", // Administrador
        "8c37a94d-7b05-42fc-9fdb-5e4eb8cee87f", // administrador_debil
        "1",
        "r-1",
        "r-4"
    ];
    if (adminUuids.includes(String(u.id_rol))) return true;
    const roleName = (u.nombre_rol || "").toLowerCase();
    return roleName.includes("administrador") || roleName.includes("admin");
}

export function isUserWeakAdmin(user = null) {
    const u = user || currentUser;
    if (!u) return false;
    if (String(u.id_rol) === "8c37a94d-7b05-42fc-9fdb-5e4eb8cee87f" || String(u.id_rol) === "r-4") return true;
    const roleName = (u.nombre_rol || "").toLowerCase();
    return roleName.includes("débil") || roleName.includes("debil");
}

export function isUserConsultor(user = null) {
    const u = user || currentUser;
    if (!u) return false;
    if (String(u.id_rol) === "73ef3e01-65ac-4891-8df9-91db1f6d364b" || String(u.id_rol) === "3" || String(u.id_rol) === "r-3") return true;
    const roleName = (u.nombre_rol || "").toLowerCase();
    return roleName.includes("consultor");
}

export function isUserLider(user = null) {
    const u = user || currentUser;
    if (!u) return false;
    if (String(u.id_rol) === "6a97aa3d-0b9f-4ea8-9ae8-a9215abf68c3" || String(u.id_rol) === "2" || String(u.id_rol) === "r-2") return true;
    const roleName = (u.nombre_rol || "").toLowerCase();
    return roleName.includes("lider") || roleName.includes("líder");
}

export function isPanelAllowedForUser(panelId, user = null) {
    const u = user || currentUser;
    if (!u) return false;
    if (panelId === "panel-usuarios" || panelId === "panel-parametros") {
        return isUserAdmin(u);
    }
    return true;
}

// Retorna la sesión activa del usuario
export function getCurrentUser() {
    return currentUser;
}

// Inicialización de la sesión y control de overlays
export async function initializeAuth() {
    const regOverlay = document.getElementById("auth-register-overlay");
    const loginOverlay = document.getElementById("auth-login-overlay");
    const appContainer = document.querySelector(".app-container");

    // Garantizar de inmediato que el contenedor de la aplicación no sea visible hasta confirmar sesión válida
    if (appContainer) {
        appContainer.classList.add("hidden");
        appContainer.style.display = "none";
    }

    // Verificar si hay sesión activa en Supabase Auth (si está disponible)
    if (isSupabaseConnected() && supabase) {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session && session.user) {
                let userProfile = null;

                // Intentar obtener el perfil público del usuario en la tabla 'usuario'
                try {
                    const { data: profile, error: profileError } = await supabase
                        .from('usuario')
                        .select('*')
                        .eq('id_usuario', session.user.id)
                        .single();

                    if (!profileError && profile) {
                        userProfile = profile;
                    }
                } catch (pErr) {
                    console.warn("[Auth] No se pudo obtener fila de usuario público:", pErr);
                }

                // Si no existe fila en la tabla 'usuario', usar datos de Auth Session como fallback (al igual que apiLogin)
                if (!userProfile) {
                    const emailStr = session.user.email || "";
                    userProfile = {
                        id_usuario: session.user.id,
                        nombre_completo: session.user.user_metadata?.nombre_completo || (emailStr ? emailStr.split('@')[0] : "Usuario"),
                        email: emailStr,
                        telefono: session.user.user_metadata?.telefono || null,
                        id_rol: "1",
                        nombre_rol: "Administrador General"
                    };
                }

                currentUser = userProfile;
                appContainer.classList.remove("hidden");
                appContainer.style.display = "flex";
                regOverlay.classList.add("hidden");
                loginOverlay.classList.add("hidden");
                await updateProfileUI();
                return;
            }
        } catch (err) {
            console.warn("No se pudo verificar sesión remota en Supabase:", err);
        }
    }

    // No hay sesión activa — Mostrar pantalla de Login por defecto
    currentUser = null;
    appContainer.classList.add("hidden");
    appContainer.style.display = "none";
    regOverlay.classList.add("hidden");
    loginOverlay.classList.remove("hidden");
}

// Actualiza el widget de perfil del usuario logueado en el sidebar
async function updateProfileUI() {
    if (!currentUser) return;

    const fullName = currentUser.nombre_completo || currentUser.email || "Usuario";
    const initials = fullName.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "U";
    
    const avatarEl = document.getElementById("current-user-avatar");
    const nameEl = document.getElementById("current-user-name");
    const roleEl = document.getElementById("current-user-role");

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = fullName;

    // Obtener nombre del rol desde Supabase
    let roleName = currentUser.nombre_rol || "Administrador General";
    try {
        const roles = await apiGetRoles();
        if (roles && roles.length > 0) {
            const roleObj = roles.find(r => r.id_rol === currentUser.id_rol);
            if (roleObj) {
                roleName = roleObj.nombre_rol;
                currentUser.nombre_rol = roleObj.nombre_rol;
            }
        }
    } catch (err) {
        console.error("Error al obtener roles:", err);
    }

    if (!currentUser.nombre_rol) {
        currentUser.nombre_rol = roleName;
    }

    if (roleEl) roleEl.textContent = roleName;

    // Filtrar las pestañas de "Gestión de Cuentas" y "Parámetros" (solo visible para administradores)
    const menuUsr = document.getElementById("menu-item-usuarios");
    const menuParam = document.getElementById("menu-item-parametros");
    const isAdmin = isUserAdmin(currentUser);

    if (menuUsr) {
        if (isAdmin) menuUsr.classList.remove("hidden");
        else menuUsr.classList.add("hidden");
    }
    if (menuParam) {
        if (isAdmin) menuParam.classList.remove("hidden");
        else menuParam.classList.add("hidden");
    }

    // Si el usuario no es admin y está intentando acceder a usuarios o parámetros, redirigir a dashboard
    if (!isAdmin) {
        const storedPanel = localStorage.getItem("activePanelId") || sessionStorage.getItem("activePanelId") || "";
        const hash = (window.location.hash || "").replace("#", "").toLowerCase();
        if (storedPanel === "panel-usuarios" || storedPanel === "panel-parametros" || hash === "usuarios" || hash === "parametros") {
            localStorage.setItem("activePanelId", "panel-dashboard");
            sessionStorage.setItem("activePanelId", "panel-dashboard");
            if (window.location.hash) {
                history.replaceState(null, "", "#dashboard");
            }
            if (typeof window.navigateToPanel === "function") {
                window.navigateToPanel("panel-dashboard", { saveStorage: true, updateHash: true, render: true });
            }
        }
    }
}

// Registro del Administrador Inicial
export async function handleRegisterAdminSubmit(event) {
    event.preventDefault();

    const nombre = document.getElementById("reg-nombre").value;
    const email = document.getElementById("reg-email").value.trim();
    const telefono = document.getElementById("reg-telefono").value || null;
    const password = document.getElementById("reg-password").value;
    const id_comunidad = document.getElementById("reg-comunidad") ? (document.getElementById("reg-comunidad").value || null) : null;

    const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(nombre)) {
        showAlert("Los nombres no pueden contener números.", "error");
        return;
    }

    if (telefono) {
        const phoneRegex = /^04(12|14|16|24|26)-\d{7}$/;
        if (!phoneRegex.test(telefono)) {
            showAlert("El teléfono debe tener el formato 04xx-xxxxxxx", "error");
            return;
        }
    }

    try {
        await apiRegisterAdmin({
            nombre_completo: nombre,
            email: email,
            telefono: telefono,
            password: password,
            id_comunidad: id_comunidad
        });

        showAlert("Administrador inicial registrado exitosamente. Inicie sesión.", "success");
        event.target.reset();
        
        // Transición suave a vista de login
        document.getElementById("auth-register-overlay").classList.add("hidden");
        document.getElementById("auth-login-overlay").classList.remove("hidden");
        document.getElementById("login-email").value = email;
    } catch (err) {
        console.error("Error al registrar administrador inicial:", err);
        showAlert("Error de registro: " + (err.message || err), "error");
    }
}

// Inicio de Sesión
export async function handleLoginSubmit(event, onSuccessCallback) {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pass = document.getElementById("login-password").value;

    try {
        const sessionUser = await apiLogin(email, pass);

        if (sessionUser) {
            currentUser = sessionUser;
            showAlert("Sesión iniciada correctamente.", "success");
            event.target.reset();

            // Garantizar que al iniciar sesión siempre se acceda primero al Dashboard de bienvenida
            localStorage.setItem("activePanelId", "panel-dashboard");
            sessionStorage.setItem("activePanelId", "panel-dashboard");
            if (window.location.hash) {
                history.replaceState(null, "", window.location.pathname + window.location.search);
            }

            // Ocultar overlays y mostrar aplicación de manera fluida
            const regOverlay = document.getElementById("auth-register-overlay");
            const loginOverlay = document.getElementById("auth-login-overlay");
            const appContainer = document.querySelector(".app-container");

            loginOverlay.classList.add("hidden");
            regOverlay.classList.add("hidden");
            appContainer.classList.remove("hidden");
            appContainer.style.display = "flex";

            await updateProfileUI();

            if (typeof onSuccessCallback === "function") {
                await onSuccessCallback();
            }
            
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } else {
            showAlert("Credenciales incorrectas o usuario no encontrado.", "error");
        }
    } catch (err) {
        console.error("Error de autenticación:", err);
        showAlert("Error de inicio de sesión: " + (err.message || err), "error");
    }
}

// Cierre de Sesión
export async function handleLogoutClick() {
    const confirmed = await showConfirm("¿Está seguro de que desea cerrar la sesión en el sistema?");
    if (!confirmed) return;

    try {
        await apiLogout();
    } catch (err) {
        console.error("Error al cerrar sesión:", err);
    }
    currentUser = null;

    // Al cerrar sesión, restablecer el panel por defecto a Dashboard y limpiar hash
    localStorage.setItem("activePanelId", "panel-dashboard");
    sessionStorage.setItem("activePanelId", "panel-dashboard");
    if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    // Restablecer el estado activo del DOM a Dashboard
    document.querySelectorAll(".menu-item").forEach(mi => {
        if (mi.getAttribute("data-target") === "panel-dashboard") mi.classList.add("active");
        else mi.classList.remove("active");
    });
    document.querySelectorAll(".panel").forEach(p => {
        if (p.id === "panel-dashboard") p.classList.add("active");
        else p.classList.remove("active");
    });

    // Transición suave de salida a Login
    const appContainer = document.querySelector(".app-container");
    const loginOverlay = document.getElementById("auth-login-overlay");
    const regOverlay = document.getElementById("auth-register-overlay");

    appContainer.classList.add("hidden");
    appContainer.style.display = "none";
    regOverlay.classList.add("hidden");
    loginOverlay.classList.remove("hidden");

    showAlert("Sesión cerrada correctamente.", "info");
}

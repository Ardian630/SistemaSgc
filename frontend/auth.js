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
            }
        }
    } catch (err) {
        console.error("Error al obtener roles:", err);
    }

    if (roleEl) roleEl.textContent = roleName;

    // Filtrar la pestaña de "Gestión de Cuentas" (solo visible para administradores)
    const menuUsr = document.getElementById("menu-item-usuarios");
    const menuParam = document.getElementById("menu-item-parametros");
    const lowerRole = roleName.toLowerCase();
    const isAdmin = lowerRole.includes("administrador") || lowerRole.includes("admin");

    if (menuUsr) {
        if (isAdmin) menuUsr.classList.remove("hidden");
        else menuUsr.classList.add("hidden");
    }
    if (menuParam) {
        if (isAdmin) menuParam.classList.remove("hidden");
        else menuParam.classList.add("hidden");
    }
}

// Registro del Administrador Inicial
export async function handleRegisterAdminSubmit(event) {
    event.preventDefault();

    const nombre = document.getElementById("reg-nombre").value;
    const email = document.getElementById("reg-email").value.trim();
    const telefono = document.getElementById("reg-telefono").value || null;
    const password = document.getElementById("reg-password").value;

    try {
        await apiRegisterAdmin({
            nombre_completo: nombre,
            email: email,
            telefono: telefono,
            password: password
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
    sessionStorage.removeItem("activePanelId");

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

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

    if (!isSupabaseConnected()) {
        // Sin conexión a Supabase, mostrar mensaje de error
        appContainer.classList.add("hidden");
        appContainer.style.display = "none";
        regOverlay.classList.add("hidden");
        loginOverlay.classList.add("hidden");
        alert("⚠️ No se pudo conectar con Supabase. Verifique las credenciales en supabase-client.js (líneas 8-9).");
        return;
    }

    // Verificar si hay sesión activa en Supabase Auth
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
            // Hay sesión activa: obtener perfil del usuario
            const { data: profile, error: profileError } = await supabase
                .from('usuario')
                .select('*')
                .eq('id_usuario', session.user.id)
                .single();

            if (!profileError && profile) {
                currentUser = profile;
                appContainer.classList.remove("hidden");
                appContainer.style.display = "flex";
                regOverlay.classList.add("hidden");
                loginOverlay.classList.add("hidden");
                await updateProfileUI();
                return;
            }
        }
    } catch (err) {
        console.error("Error al verificar sesión activa:", err);
    }

    // No hay sesión activa — determinar si mostrar login o registro
    currentUser = null;
    appContainer.classList.add("hidden");
    appContainer.style.display = "none";

    let hasUsers = false;
    try {
        const { data, error } = await supabase.from('usuario').select('id_usuario').limit(1);
        if (!error && data && data.length > 0) {
            hasUsers = true;
        }
    } catch (err) {
        console.error("Error al consultar usuarios:", err);
    }

    if (hasUsers) {
        loginOverlay.classList.remove("hidden");
        regOverlay.classList.add("hidden");
    } else {
        regOverlay.classList.remove("hidden");
        loginOverlay.classList.add("hidden");
    }
}

// Actualiza el widget de perfil del usuario logueado en el sidebar
async function updateProfileUI() {
    if (!currentUser) return;

    const initials = currentUser.nombre_completo.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    document.getElementById("current-user-avatar").textContent = initials;
    document.getElementById("current-user-name").textContent = currentUser.nombre_completo;

    // Obtener nombre del rol desde Supabase
    let roleName = "Usuario";
    try {
        const roles = await apiGetRoles();
        const roleObj = roles.find(r => r.id_rol === currentUser.id_rol);
        if (roleObj) {
            roleName = roleObj.nombre_rol;
        }
    } catch (err) {
        console.error("Error al obtener roles:", err);
    }

    document.getElementById("current-user-role").textContent = roleName;

    // Filtrar la pestaña de "Gestión de Cuentas" (solo visible para administradores)
    const menuUsr = document.getElementById("menu-item-usuarios");
    const menuParam = document.getElementById("menu-item-parametros");
    const lowerRole = roleName.toLowerCase();
    if (lowerRole.includes("administrador") || lowerRole.includes("admin")) {
        menuUsr.classList.remove("hidden");
        menuParam.classList.remove("hidden");
    } else {
        menuUsr.classList.add("hidden");
        menuParam.classList.add("hidden");
    }
}

// Registro del Administrador Inicial
export async function handleRegisterAdminSubmit(event) {
    event.preventDefault();

    if (!isSupabaseConnected()) {
        alert("Error: Supabase no está configurado.");
        return;
    }

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

        alert("Administrador inicial registrado exitosamente. Inicie sesión.");
        window.location.reload();
    } catch (err) {
        console.error("Error al registrar administrador inicial:", err);
        alert("Error de registro: " + (err.message || err));
    }
}

// Inicio de Sesión
export async function handleLoginSubmit(event) {
    event.preventDefault();

    if (!isSupabaseConnected()) {
        alert("Error: Supabase no está configurado.");
        return;
    }

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pass = document.getElementById("login-password").value;

    try {
        const sessionUser = await apiLogin(email, pass);

        if (sessionUser) {
            currentUser = sessionUser;
            alert("Sesión iniciada correctamente.");
            window.location.reload();
        } else {
            alert("Credenciales incorrectas o usuario no encontrado.");
        }
    } catch (err) {
        console.error("Error de autenticación:", err);
        alert("Error de inicio de sesión: " + (err.message || err));
    }
}

// Cierre de Sesión
export async function handleLogoutClick() {
    try {
        await apiLogout();
    } catch (err) {
        console.error("Error al cerrar sesión:", err);
    }
    currentUser = null;
    window.location.reload();
}

// =========================================================================
// CLIENTE Y CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// =========================================================================
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  COLOQUE SUS API KEYS AQUÍ (líneas 8 y 9):                            ║
// ║  1. SUPABASE_URL  → La URL de su proyecto (ej. https://xxx.supabase.co)║
// ║  2. SUPABASE_ANON_KEY → La clave pública (anon/public) de su proyecto  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const SUPABASE_URL = "https://qdmyjbjmlzvigplyxqnn.supabase.co";      // ← Pegue aquí su URL de Supabase
const SUPABASE_ANON_KEY = "sb_publishable_e-K7CCrj_tckO3LzEH_N8g_wZ2AsZiE"; // ← Pegue aquí su Anon Key de Supabase

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Conexión con Supabase inicializada correctamente.");
    } catch (err) {
        console.error("❌ Error al inicializar la conexión con Supabase:", err);
    }
} else {
    console.warn("⚠️ Supabase no configurado. Edite SUPABASE_URL y SUPABASE_ANON_KEY en supabase-client.js (líneas 8-9).");
}

export { supabase };

// Retorna verdadero si Supabase está correctamente conectado e inicializado
export function isSupabaseConnected() {
    return supabase !== null;
}

// =========================================================================
// MÉTODOS DE LA API DE ROLES Y COMUNIDADES
// =========================================================================

export async function apiGetRoles() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('roles').select('*');
    if (error) throw error;
    return data;
}

export async function apiGetComunidades() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('comunidad').select('*').order('nombre_comunidad', { ascending: true });
    if (error) throw error;
    return data;
}

export async function apiCreateComunidad(nombre) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('comunidad').insert([{ nombre_comunidad: nombre }]).select();
    if (error) throw error;
    return data[0];
}

// =========================================================================
// MÉTODOS DE EDIFICIOS Y VIVIENDAS
// =========================================================================

export async function apiGetEdificios() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('edificio').select('*').order('nombre_edificio', { ascending: true });
    if (error) throw error;
    return data;
}

export async function apiCreateEdificio(nombre, idComunidad) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('edificio').insert([{ nombre_edificio: nombre, id_comunidad: idComunidad }]).select();
    if (error) throw error;
    return data[0];
}

export async function apiGetViviendas() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('vivienda').select('*');
    if (error) throw error;
    return data;
}

export async function apiCreateVivienda(idComunidad, idEdificio, numero, bloque) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('vivienda').insert([{
        id_comunidad: idComunidad,
        id_edificio: idEdificio || null,
        numero_vivienda: numero,
        numero_bloque: bloque || null
    }]).select();
    if (error) throw error;
    return data[0];
}

// =========================================================================
// MÉTODOS DE NÚCLEOS FAMILIARES Y PERSONAS
// =========================================================================

export async function apiGetNucleos() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('nucleo').select('*');
    if (error) throw error;
    return data;
}

export async function apiCreateNucleoYJefe(nucleoData) {
    if (!supabase) return null;
    // Llama al procedimiento almacenado transaccional que creamos en triggers.sql
    const { data, error } = await supabase.rpc('registrar_nucleo_y_jefe', {
        p_nombre_familia: nucleoData.nombre_familia,
        p_id_vivienda: nucleoData.id_vivienda || null,
        p_nombre_completo: nucleoData.nombre_completo,
        p_tipo_cedula: nucleoData.tipo_cedula,
        p_cedula_identidad: nucleoData.cedula_identidad,
        p_fecha_nacimiento: nucleoData.fecha_nacimiento,
        p_genero: nucleoData.genero,
        p_telefono: nucleoData.telefono || null,
        p_email: nucleoData.email || null,
        p_id_profesion: nucleoData.id_profesion || null,
        p_id_discapacidad: nucleoData.id_discapacidad || null
    });
    if (error) throw error;
    return data;
}

export async function apiCreateNucleoSimple(nombreFamilia, idVivienda, idJefeFamilia) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('nucleo').insert([{
        nombre_familia: nombreFamilia,
        id_vivienda: idVivienda || null,
        id_jefe_familia: idJefeFamilia || null
    }]).select();
    if (error) throw error;
    return data[0];
}

export async function apiDeleteNucleo(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('nucleo').delete().eq('id_nucleo', id);
    if (error) throw error;
    return true;
}

export async function apiUpdateNucleo(id, updateData) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('nucleo').update(updateData).eq('id_nucleo', id).select();
    if (error) throw error;
    return data[0];
}

export async function apiGetProfesiones() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('profesion').select('*').order('nombre_profesion', { ascending: true });
    if (error) throw error;
    return data;
}

export async function apiCreateProfesion(nombre) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profesion').insert([{ nombre_profesion: nombre }]).select();
    if (error) throw error;
    return data[0];
}

export async function apiUpdateProfesion(id, nombre) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profesion').update({ nombre_profesion: nombre }).eq('id_profesion', id).select();
    if (error) throw error;
    return data[0];
}

export async function apiDeleteProfesion(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('profesion').delete().eq('id_profesion', id);
    if (error) throw error;
    return true;
}

export async function apiGetDiscapacidades() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('discapacidad').select('*');
    if (error) throw error;
    return data;
}

export async function apiCreateDiscapacidad(tipo, nivel) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('discapacidad').insert([{ tipo_discapacidad: tipo, nivel_discapacidad: nivel }]).select();
    if (error) throw error;
    return data[0];
}

export async function apiUpdateDiscapacidad(id, tipo, nivel) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('discapacidad').update({ tipo_discapacidad: tipo, nivel_discapacidad: nivel }).eq('id_discapacidad', id).select();
    if (error) throw error;
    return data[0];
}

export async function apiDeleteDiscapacidad(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('discapacidad').delete().eq('id_discapacidad', id);
    if (error) throw error;
    return true;
}

export async function apiResetPasswordForEmail(email) {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
    return data;
}

export async function apiUpdatePassword(newPassword) {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
}

export async function apiGetPersonas() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('persona').select('*').order('nombre_completo', { ascending: true });
    if (error) throw error;
    return data;
}

export async function apiCreatePersona(persona) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('persona').insert([persona]).select();
    if (error) throw error;
    return data[0];
}

export async function apiUpdatePersona(id, personaData) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('persona').update(personaData).eq('id_persona', id).select();
    if (error) throw error;
    return data[0];
}

export async function apiAsociarPersonaNucleo(idPersona, idNucleo) {
    if (!supabase) return false;
    const { error } = await supabase.from('persona').update({ id_nucleo: idNucleo }).eq('id_persona', idPersona);
    if (error) throw error;
    return true;
}

export async function apiAsociarNucleoVivienda(idNucleo, idVivienda) {
    if (!supabase) return false;
    const { error } = await supabase.from('nucleo').update({ id_vivienda: idVivienda }).eq('id_nucleo', idNucleo);
    if (error) throw error;
    return true;
}

export async function apiDeletePersona(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('persona').delete().eq('id_persona', id);
    if (error) throw error;
    return true;
}

// =========================================================================
// MÉTODOS DE GESTIÓN DE USUARIOS Y PERFILES (AUTH & USERS)
// =========================================================================

export async function apiGetUsuarios() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('usuario').select('*');
    if (error) throw error;
    return data;
}

export async function apiCreateUsuario(usuario) {
    if (!supabase) return null;

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: usuario.email,
        password: usuario.password,
        options: {
            data: {
                nombre_completo: usuario.nombre_completo,
                telefono: usuario.telefono || null
            }
        }
    });
    if (authError) throw authError;

    const newUserId = authData.user.id;

    const { data: profileData, error: profileError } = await supabase
        .from('usuario')
        .update({
            id_rol: usuario.id_rol,
            id_comunidad: usuario.id_comunidad || null,
            telefono: usuario.telefono || null
        })
        .eq('id_usuario', newUserId)
        .select();

    if (profileError) throw profileError;
    if (!profileData || profileData.length === 0) {
        throw new Error(
            "No se pudo asignar el rol al nuevo usuario porque su perfil público no existe.\n\n" +
            "Asegúrese de haber ejecutado el script 'triggers.sql' en el editor de SQL de Supabase para activar la creación automática de perfiles de usuario."
        );
    }
    return profileData[0];
}

export async function apiDeleteUsuario(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('usuario').delete().eq('id_usuario', id);
    if (error) throw error;
    return true;
}

// =========================================================================
// FLUJOS DE ACCESO (LOGIN Y AUTORIZACIÓN)
// =========================================================================

export async function apiRegisterAdmin(adminData) {
    if (!supabase) return null;

    // A. Registrar en Auth (el trigger handle_new_user creará el perfil público automáticamente)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
        options: {
            data: {
                nombre_completo: adminData.nombre_completo,
                telefono: adminData.telefono || null
            }
        }
    });
    if (authError) throw authError;

    const userId = authData.user.id;

    // B. Obtener su perfil de usuario detallado
    const { data: profileList, error: profileError } = await supabase
        .from('usuario')
        .select('*')
        .eq('id_usuario', userId);

    if (profileError) throw profileError;

    if (!profileList || profileList.length === 0) {
        throw new Error(
            "El usuario de autenticación se creó con éxito, pero no se encontró su perfil público en la tabla 'usuario'.\n\n" +
            "Por favor, verifique lo siguiente:\n" +
            "1. ¿Ejecutó el script 'triggers.sql' en Supabase? Es necesario para que el perfil se cree automáticamente al registrarse.\n" +
            "2. Si tiene habilitada la confirmación por correo electrónico en la consola de Supabase, deberá confirmar su correo antes de poder ver el perfil."
        );
    }

    return profileList[0];
}

export async function apiLogin(email, password) {
    if (!supabase) return null;

    // Autenticar en Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) throw error;

    // Obtener su perfil de usuario detallado
    const { data: profile, error: profileError } = await supabase
        .from('usuario')
        .select('*')
        .eq('id_usuario', data.user.id)
        .single();

    if (profileError) throw profileError;
    return profile;
}

export async function apiLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
}

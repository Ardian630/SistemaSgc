import { 
    isSupabaseConnected,
    apiGetRoles,
    apiGetComunidades,
    apiGetEdificios,
    apiGetViviendas,
    apiGetNucleos,
    apiGetProfesiones,
    apiGetDiscapacidades,
    apiGetPersonas,
    apiGetUsuarios
} from "../../supabase-client.js";

// Variable global de filtro de comunidad activa
export let activeCommunity = "all";

export function getActiveCommunity() {
    return activeCommunity;
}

export function setActiveCommunity(comm) {
    activeCommunity = comm;
}

// Iconos SVG reutilizables
export const treeEditIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
export const treeDeleteIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
export const trashIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

// =========================================================================
// OBTENCION UNIFICADA DE DATOS (SOLO SUPABASE)
// =========================================================================

export async function dbFetchAll() {
    if (!isSupabaseConnected()) {
        console.error("Supabase no esta conectado. Configure las credenciales en supabase-client.js.");
        return { roles: [], comunidades: [], edificios: [], viviendas: [], nucleos: [], profesiones: [], discapacidades: [], personas: [], usuarios: [] };
    }

    const [roles, comunidades, edificios, viviendas, nucleos, profesiones, discapacidades, personas, usuarios] = await Promise.all([
        apiGetRoles(),
        apiGetComunidades(),
        apiGetEdificios(),
        apiGetViviendas(),
        apiGetNucleos(),
        apiGetProfesiones(),
        apiGetDiscapacidades(),
        apiGetPersonas(),
        apiGetUsuarios()
    ]);
    return { roles, comunidades, edificios, viviendas, nucleos, profesiones, discapacidades, personas, usuarios };
}


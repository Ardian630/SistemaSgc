-- =========================================================================
-- SCRIPT COMPLETO DE POLÍTICAS RLS — SISTEMA SGC
-- Ejecutar en Supabase SQL Editor como una sola query.
-- =========================================================================
--
-- MATRIZ DE PERMISOS:
-- ┌──────────────────────┬─────────┬──────────────────────────────────┐
-- │ Rol                  │ SELECT  │ INSERT / UPDATE / DELETE          │
-- ├──────────────────────┼─────────┼──────────────────────────────────┤
-- │ Administrador        │ Todo    │ Todo                             │
-- │ administrador_debil  │ Todo    │ Todo                             │
-- │ Líder de comunidad   │ Todo    │ Solo registros de su comunidad   │
-- │ Consultor            │ Todo    │ Nada                             │
-- └──────────────────────┴─────────┴──────────────────────────────────┘
--
-- Los nombres de rol se comparan NORMALIZADOS (minúsculas, sin espacios
-- sobrantes y sin acentos), así 'Administrador', 'administrador ' o
-- 'Lider de comunidad' / 'Líder de comunidad' se reconocen igual.
-- =========================================================================

-- =========================================================================
-- 1. LIMPIEZA ABSOLUTA DE TODAS LAS POLÍTICAS EXISTENTES
-- =========================================================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- =========================================================================
-- 1b. ELIMINAR VERSIONES ANTERIORES DE LAS FUNCIONES AUXILIARES
-- (CREATE OR REPLACE falla si cambió el tipo de retorno o el nombre de
--  algún parámetro, y ese error deshacía TODO el script).
-- Las políticas ya se borraron arriba, así que no hay dependencias.
-- =========================================================================
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN (
        SELECT p.oid::regprocedure AS firma
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'get_user_role', 'get_user_role_normalizado', 'get_user_community',
              'es_admin', 'es_admin_principal', 'es_lider',
              'vivienda_en_mi_comunidad', 'nucleo_en_mi_comunidad',
              'debug_mi_sesion', 'registrar_nucleo_y_jefe'
          )
    ) LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s', f.firma);
    END LOOP;
END $$;

-- =========================================================================
-- 2. FUNCIONES AUXILIARES DE SEGURIDAD
-- SECURITY DEFINER + OWNER TO postgres => consultan usuario/roles sin RLS
-- (evita la recursión infinita).
-- =========================================================================

-- Rol tal cual está guardado (se mantiene por compatibilidad)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.nombre_rol 
    FROM public.usuario u 
    JOIN public.roles r ON u.id_rol = r.id_rol 
    WHERE u.id_usuario = auth.uid();
$$;
ALTER FUNCTION public.get_user_role() OWNER TO postgres;

-- Rol normalizado: minúsculas, sin espacios extremos y sin acentos
CREATE OR REPLACE FUNCTION public.get_user_role_normalizado()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT lower(translate(trim(r.nombre_rol), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
    FROM public.usuario u 
    JOIN public.roles r ON u.id_rol = r.id_rol 
    WHERE u.id_usuario = auth.uid();
$$;
ALTER FUNCTION public.get_user_role_normalizado() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_user_community()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id_comunidad 
    FROM public.usuario 
    WHERE id_usuario = auth.uid();
$$;
ALTER FUNCTION public.get_user_community() OWNER TO postgres;

-- ¿Es Administrador o administrador_debil?
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.get_user_role_normalizado() IN ('administrador', 'administrador_debil'), false);
$$;
ALTER FUNCTION public.es_admin() OWNER TO postgres;

-- ¿Es Administrador principal? (solo él puede borrar otros administradores)
CREATE OR REPLACE FUNCTION public.es_admin_principal()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.get_user_role_normalizado() = 'administrador', false);
$$;
ALTER FUNCTION public.es_admin_principal() OWNER TO postgres;

-- ¿Es Líder de comunidad?
CREATE OR REPLACE FUNCTION public.es_lider()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.get_user_role_normalizado() = 'lider de comunidad', false);
$$;
ALTER FUNCTION public.es_lider() OWNER TO postgres;

-- ¿La vivienda pertenece a la comunidad del usuario?
CREATE OR REPLACE FUNCTION public.vivienda_en_mi_comunidad(p_id_vivienda UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.vivienda v
        WHERE v.id_vivienda = p_id_vivienda
          AND v.id_comunidad = public.get_user_community()
    );
$$;
ALTER FUNCTION public.vivienda_en_mi_comunidad(UUID) OWNER TO postgres;

-- ¿El núcleo pertenece (vía su vivienda) a la comunidad del usuario?
CREATE OR REPLACE FUNCTION public.nucleo_en_mi_comunidad(p_id_nucleo UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.nucleo n
        JOIN public.vivienda v ON v.id_vivienda = n.id_vivienda
        WHERE n.id_nucleo = p_id_nucleo
          AND v.id_comunidad = public.get_user_community()
    );
$$;
ALTER FUNCTION public.nucleo_en_mi_comunidad(UUID) OWNER TO postgres;

-- Diagnóstico: muestra lo que la BD "ve" de la sesión actual.
-- Se llama desde el frontend con supabase.rpc('debug_mi_sesion')
CREATE OR REPLACE FUNCTION public.debug_mi_sesion()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT json_build_object(
        'auth_uid',        auth.uid(),
        'jwt_role',        auth.role(),
        'usuario_existe',  EXISTS (SELECT 1 FROM public.usuario WHERE id_usuario = auth.uid()),
        'rol_crudo',       (SELECT '"' || r.nombre_rol || '"'
                              FROM public.usuario u JOIN public.roles r ON r.id_rol = u.id_rol
                             WHERE u.id_usuario = auth.uid()),
        'rol_normalizado', public.get_user_role_normalizado(),
        'es_admin',        public.es_admin(),
        'es_lider',        public.es_lider(),
        'comunidad',       public.get_user_community()
    );
$$;
ALTER FUNCTION public.debug_mi_sesion() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION
    public.get_user_role(),
    public.get_user_role_normalizado(),
    public.get_user_community(),
    public.es_admin(),
    public.es_admin_principal(),
    public.es_lider(),
    public.vivienda_en_mi_comunidad(UUID),
    public.nucleo_en_mi_comunidad(UUID),
    public.debug_mi_sesion()
TO authenticated;

-- =========================================================================
-- 3. FUNCIÓN RPC registrar_nucleo_y_jefe (SECURITY DEFINER)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.registrar_nucleo_y_jefe(
    p_nombre_familia VARCHAR(255),
    p_id_vivienda UUID,
    p_nombre_completo VARCHAR(255),
    p_tipo_cedula VARCHAR(5),
    p_cedula_identidad VARCHAR(50),
    p_fecha_nacimiento DATE,
    p_genero VARCHAR(20),
    p_telefono VARCHAR(50),
    p_email VARCHAR(255),
    p_id_profesion UUID,
    p_id_discapacidad UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id_nucleo UUID;
    v_id_persona UUID;
BEGIN
    INSERT INTO public.nucleo (id_vivienda, nombre_familia, id_jefe_familia)
    VALUES (p_id_vivienda, p_nombre_familia, NULL)
    RETURNING id_nucleo INTO v_id_nucleo;

    INSERT INTO public.persona (
        id_nucleo, nombre_completo, tipo_cedula, cedula_identidad, 
        fecha_nacimiento, genero, telefono, email, id_profesion, id_discapacidad
    )
    VALUES (
        v_id_nucleo, p_nombre_completo, p_tipo_cedula, p_cedula_identidad,
        p_fecha_nacimiento, p_genero, p_telefono, p_email, p_id_profesion, p_id_discapacidad
    )
    RETURNING id_persona INTO v_id_persona;

    UPDATE public.nucleo SET id_jefe_familia = v_id_persona WHERE id_nucleo = v_id_nucleo;

    RETURN json_build_object(
        'success', true,
        'id_nucleo', v_id_nucleo,
        'id_jefe_familia', v_id_persona,
        'nombre_familia', p_nombre_familia
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error al registrar núcleo y jefe de familia: % (Código: %)', SQLERRM, SQLSTATE;
END;
$$;
ALTER FUNCTION public.registrar_nucleo_y_jefe(VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR, VARCHAR, UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.registrar_nucleo_y_jefe(VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR, VARCHAR, UUID, UUID) TO authenticated;

-- =========================================================================
-- 4. roles  (lectura pública, escritura solo admins)
-- =========================================================================
CREATE POLICY "roles_select" ON public.roles FOR SELECT USING (true);
CREATE POLICY "roles_insert" ON public.roles FOR INSERT TO authenticated WITH CHECK (public.es_admin());
CREATE POLICY "roles_update" ON public.roles FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());
CREATE POLICY "roles_delete" ON public.roles FOR DELETE TO authenticated USING (public.es_admin());

-- =========================================================================
-- 5. comunidad  (escritura solo admins)
-- =========================================================================
CREATE POLICY "comunidad_select" ON public.comunidad FOR SELECT TO authenticated USING (true);
CREATE POLICY "comunidad_insert" ON public.comunidad FOR INSERT TO authenticated WITH CHECK (public.es_admin());
CREATE POLICY "comunidad_update" ON public.comunidad FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());
CREATE POLICY "comunidad_delete" ON public.comunidad FOR DELETE TO authenticated USING (public.es_admin());

-- =========================================================================
-- 6. usuario
-- =========================================================================
CREATE POLICY "usuario_select_anon" ON public.usuario FOR SELECT TO anon USING (true);
CREATE POLICY "usuario_select" ON public.usuario FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuario_insert" ON public.usuario FOR INSERT TO authenticated WITH CHECK (
    public.es_admin() OR id_usuario = auth.uid()
);
CREATE POLICY "usuario_update" ON public.usuario FOR UPDATE TO authenticated 
    USING (public.es_admin() OR id_usuario = auth.uid())
    WITH CHECK (public.es_admin() OR id_usuario = auth.uid());
CREATE POLICY "usuario_delete" ON public.usuario FOR DELETE TO authenticated USING (
    public.es_admin_principal()
    OR (
        public.es_admin()
        AND id_rol NOT IN (
            SELECT id_rol FROM public.roles
            WHERE lower(trim(nombre_rol)) IN ('administrador', 'administrador_debil')
        )
    )
);

-- =========================================================================
-- 7. edificio  (líder: solo su comunidad)
-- =========================================================================
CREATE POLICY "edificio_select" ON public.edificio FOR SELECT TO authenticated USING (true);
CREATE POLICY "edificio_insert" ON public.edificio FOR INSERT TO authenticated WITH CHECK (
    public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community())
);
CREATE POLICY "edificio_update" ON public.edificio FOR UPDATE TO authenticated 
    USING      (public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community()))
    WITH CHECK (public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community()));
CREATE POLICY "edificio_delete" ON public.edificio FOR DELETE TO authenticated USING (
    public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community())
);

-- =========================================================================
-- 8. vivienda  (líder: solo su comunidad)
-- =========================================================================
CREATE POLICY "vivienda_select" ON public.vivienda FOR SELECT TO authenticated USING (true);
CREATE POLICY "vivienda_insert" ON public.vivienda FOR INSERT TO authenticated WITH CHECK (
    public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community())
);
CREATE POLICY "vivienda_update" ON public.vivienda FOR UPDATE TO authenticated 
    USING      (public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community()))
    WITH CHECK (public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community()));
CREATE POLICY "vivienda_delete" ON public.vivienda FOR DELETE TO authenticated USING (
    public.es_admin() OR (public.es_lider() AND id_comunidad = public.get_user_community())
);

-- =========================================================================
-- 9. nucleo  (líder: núcleos cuya vivienda es de su comunidad, o sin vivienda aún)
-- =========================================================================
CREATE POLICY "nucleo_select" ON public.nucleo FOR SELECT TO authenticated USING (true);
CREATE POLICY "nucleo_insert" ON public.nucleo FOR INSERT TO authenticated WITH CHECK (
    public.es_admin() 
    OR (public.es_lider() AND (id_vivienda IS NULL OR public.vivienda_en_mi_comunidad(id_vivienda)))
);
CREATE POLICY "nucleo_update" ON public.nucleo FOR UPDATE TO authenticated 
    USING      (public.es_admin() OR (public.es_lider() AND (id_vivienda IS NULL OR public.vivienda_en_mi_comunidad(id_vivienda))))
    WITH CHECK (public.es_admin() OR (public.es_lider() AND (id_vivienda IS NULL OR public.vivienda_en_mi_comunidad(id_vivienda))));
CREATE POLICY "nucleo_delete" ON public.nucleo FOR DELETE TO authenticated USING (
    public.es_admin() 
    OR (public.es_lider() AND (id_vivienda IS NULL OR public.vivienda_en_mi_comunidad(id_vivienda)))
);

-- =========================================================================
-- 10. profesion y discapacidad  (catálogos: admins y líderes)
-- =========================================================================
CREATE POLICY "profesion_select" ON public.profesion FOR SELECT TO authenticated USING (true);
CREATE POLICY "profesion_insert" ON public.profesion FOR INSERT TO authenticated WITH CHECK (public.es_admin() OR public.es_lider());
CREATE POLICY "profesion_update" ON public.profesion FOR UPDATE TO authenticated USING (public.es_admin() OR public.es_lider()) WITH CHECK (public.es_admin() OR public.es_lider());
CREATE POLICY "profesion_delete" ON public.profesion FOR DELETE TO authenticated USING (public.es_admin() OR public.es_lider());

CREATE POLICY "discapacidad_select" ON public.discapacidad FOR SELECT TO authenticated USING (true);
CREATE POLICY "discapacidad_insert" ON public.discapacidad FOR INSERT TO authenticated WITH CHECK (public.es_admin() OR public.es_lider());
CREATE POLICY "discapacidad_update" ON public.discapacidad FOR UPDATE TO authenticated USING (public.es_admin() OR public.es_lider()) WITH CHECK (public.es_admin() OR public.es_lider());
CREATE POLICY "discapacidad_delete" ON public.discapacidad FOR DELETE TO authenticated USING (public.es_admin() OR public.es_lider());

-- =========================================================================
-- 11. persona  (líder: personas sin núcleo o de núcleos de su comunidad)
-- =========================================================================
CREATE POLICY "persona_select" ON public.persona FOR SELECT TO authenticated USING (true);
CREATE POLICY "persona_insert" ON public.persona FOR INSERT TO authenticated WITH CHECK (
    public.es_admin() 
    OR (public.es_lider() AND (id_nucleo IS NULL OR public.nucleo_en_mi_comunidad(id_nucleo)))
);
CREATE POLICY "persona_update" ON public.persona FOR UPDATE TO authenticated 
    USING      (public.es_admin() OR (public.es_lider() AND (id_nucleo IS NULL OR public.nucleo_en_mi_comunidad(id_nucleo))))
    WITH CHECK (public.es_admin() OR (public.es_lider() AND (id_nucleo IS NULL OR public.nucleo_en_mi_comunidad(id_nucleo))));
CREATE POLICY "persona_delete" ON public.persona FOR DELETE TO authenticated USING (
    public.es_admin() 
    OR (public.es_lider() AND (id_nucleo IS NULL OR public.nucleo_en_mi_comunidad(id_nucleo)))
);

-- =========================================================================
-- 12. RECARGAR LA CACHÉ DE LA API (PostgREST) PARA QUE VEA LAS FUNCIONES NUEVAS
-- =========================================================================
NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- 13. VERIFICACIÓN AUTOMÁTICA
-- Si el script terminó bien, verás esta tabla con las funciones y las
-- políticas creadas. Si NO la ves, el script falló: copia el error.
-- =========================================================================
SELECT 'funcion'::text AS tipo, proname::text AS nombre, NULL::text AS tabla
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname IN ('es_admin', 'es_lider', 'debug_mi_sesion', 'get_user_role_normalizado')
UNION ALL
SELECT 'politica'::text, policyname::text, tablename::text
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'persona'
ORDER BY 1, 2;

-- Consultas extra (ejecútalas aparte para revisar los datos):
-- SELECT id_rol, '"' || nombre_rol || '"' AS nombre_exacto, length(nombre_rol) FROM public.roles;
-- SELECT u.email, '"' || r.nombre_rol || '"' AS rol_exacto, u.id_comunidad
--   FROM public.usuario u LEFT JOIN public.roles r ON r.id_rol = u.id_rol;
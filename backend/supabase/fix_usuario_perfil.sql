-- =========================================================================
-- REPARACIÓN: cuenta de Auth sin fila en public.usuario
-- Ejecutar en Supabase SQL Editor (como postgres).
--
-- Síntoma: debug_mi_sesion() devuelve usuario_existe = false.
-- Sin esa fila, la BD no conoce tu rol => es_admin() = false => 403 (42501).
-- =========================================================================

-- -------------------------------------------------------------------------
-- PASO 1. DIAGNÓSTICO (ejecuta solo este bloque primero y revisa)
-- -------------------------------------------------------------------------
-- a) Tu cuenta en Auth
SELECT id, email, created_at, raw_user_meta_data
  FROM auth.users
 WHERE id = '4657a3e1-4250-4ac7-a984-91f1da5c7d17';

-- b) ¿Hay un perfil con tu mismo correo pero con OTRO id? (perfil desvinculado)
SELECT u.id_usuario, u.email, u.nombre_completo, r.nombre_rol, u.id_comunidad
  FROM public.usuario u
  LEFT JOIN public.roles r ON r.id_rol = u.id_rol
 WHERE lower(u.email) = (SELECT lower(email) FROM auth.users
                          WHERE id = '4657a3e1-4250-4ac7-a984-91f1da5c7d17');

-- c) ¿Existe el trigger que crea el perfil al registrarse?
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';


-- -------------------------------------------------------------------------
-- PASO 2. REPARACIÓN
--  * Si en (b) apareció tu perfil con otro id  -> se re-vincula a tu cuenta
--    y CONSERVA el rol y la comunidad que ya tenía.
--  * Si no apareció nada -> se crea el perfil con el rol que TÚ indiques
--    en v_rol_si_no_existe (nada se asigna automáticamente).
-- -------------------------------------------------------------------------
DO $$
DECLARE
    v_uid               UUID := '4657a3e1-4250-4ac7-a984-91f1da5c7d17';
    v_rol_si_no_existe  TEXT := 'Administrador';   -- <-- AJUSTA SI CORRESPONDE
    v_email   TEXT;
    v_nombre  TEXT;
    v_tel     TEXT;
    v_id_rol  UUID;
BEGIN
    SELECT email,
           COALESCE(raw_user_meta_data->>'nombre_completo', split_part(email, '@', 1)),
           raw_user_meta_data->>'telefono'
      INTO v_email, v_nombre, v_tel
      FROM auth.users
     WHERE id = v_uid;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'No existe ninguna cuenta en auth.users con id %', v_uid;
    END IF;

    IF EXISTS (SELECT 1 FROM public.usuario WHERE id_usuario = v_uid) THEN
        RAISE NOTICE 'El perfil ya existe, no se hace nada.';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.usuario WHERE lower(email) = lower(v_email)) THEN
        -- Re-vincular perfil existente (conserva rol y comunidad)
        UPDATE public.usuario
           SET id_usuario = v_uid
         WHERE lower(email) = lower(v_email);
        RAISE NOTICE 'Perfil existente re-vinculado a la cuenta %', v_uid;
    ELSE
        SELECT id_rol INTO v_id_rol
          FROM public.roles
         WHERE lower(trim(nombre_rol)) = lower(trim(v_rol_si_no_existe));

        IF v_id_rol IS NULL THEN
            RAISE EXCEPTION 'El rol "%" no existe en public.roles', v_rol_si_no_existe;
        END IF;

        INSERT INTO public.usuario (id_usuario, id_rol, id_comunidad, nombre_completo, email, telefono)
        VALUES (v_uid, v_id_rol, NULL, v_nombre, v_email, v_tel);
        RAISE NOTICE 'Perfil creado con rol %', v_rol_si_no_existe;
    END IF;
END $$;


-- -------------------------------------------------------------------------
-- PASO 3. COMPROBACIÓN FINAL
-- -------------------------------------------------------------------------
SELECT u.id_usuario, u.email, u.nombre_completo, r.nombre_rol, u.id_comunidad
  FROM public.usuario u
  LEFT JOIN public.roles r ON r.id_rol = u.id_rol
 WHERE u.id_usuario = '4657a3e1-4250-4ac7-a984-91f1da5c7d17';

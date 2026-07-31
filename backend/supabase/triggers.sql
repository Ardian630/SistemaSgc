-- =========================================================================
-- TRIGGERS Y FUNCIONES DE EVENTOS
-- =========================================================================

-- 1. Sincronización Automática: auth.users -> public.usuario
-- Se ejecuta cuando un nuevo usuario se registra a través de Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    role_id UUID;
    user_count INTEGER;
    role_name VARCHAR(100);
BEGIN
    -- Contar cuántos usuarios registrados existen
    SELECT COUNT(*) INTO user_count FROM public.usuario;

    -- Si no hay usuarios, el primer usuario será Administrador. De lo contrario, Consultor.
    IF user_count = 0 THEN
        role_name := 'Administrador';
    ELSE
        role_name := 'Consultor';
    END IF;

    -- Obtener el ID del rol
    SELECT id_rol INTO role_id FROM public.roles WHERE nombre_rol = role_name;
    
    -- Si el rol no existe, crearlo (como es SECURITY DEFINER, tiene permisos)
    IF role_id IS NULL THEN
        INSERT INTO public.roles (nombre_rol) VALUES (role_name) 
        RETURNING id_rol INTO role_id;
    END IF;

    -- Insertar el perfil del usuario en la tabla pública
    INSERT INTO public.usuario (id_usuario, id_rol, id_comunidad, nombre_completo, email, telefono)
    VALUES (
        new.id,
        role_id,
        NULL, -- Sin comunidad asignada inicialmente
        COALESCE(new.raw_user_meta_data->>'nombre_completo', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
        new.email,
        COALESCE(new.raw_user_meta_data->>'telefono', new.phone)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger en el esquema auth (donde vive auth.users)
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Validación de Jefe de Familia
-- Verifica que el jefe de familia asignado a un núcleo realmente pertenezca a ese núcleo
CREATE OR REPLACE FUNCTION public.check_jefe_familia_belongs()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_jefe_familia IS NOT NULL THEN
        -- Comprobar si la persona existe y tiene asignado este id_nucleo
        IF NOT EXISTS (
            SELECT 1 FROM public.persona
            WHERE id_persona = NEW.id_jefe_familia AND id_nucleo = NEW.id_nucleo
        ) THEN
            RAISE EXCEPTION 'Error de Integridad: La persona asignada como Jefe de Familia (%) debe pertenecer al núcleo familiar correspondiente (%).', 
                            NEW.id_jefe_familia, NEW.id_nucleo;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_jefe_familia
    BEFORE INSERT OR UPDATE OF id_jefe_familia ON public.nucleo
    FOR EACH ROW EXECUTE FUNCTION public.check_jefe_familia_belongs();


-- =========================================================================
-- FUNCIONES TRANSACCIONALES (STORED PROCEDURES / RPC)
-- =========================================================================

-- 3. Registro Atómico de Núcleo Familiar y Jefe de Familia
-- Evita errores por dependencia circular al crear ambos registros juntos en una sola transacción
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
RETURNS JSON AS $$
DECLARE
    v_id_nucleo UUID;
    v_id_persona UUID;
    v_result JSON;
BEGIN
    -- A. Insertar el núcleo familiar inicialmente sin jefe de familia
    INSERT INTO public.nucleo (id_vivienda, nombre_familia, id_jefe_familia)
    VALUES (p_id_vivienda, p_nombre_familia, NULL)
    RETURNING id_nucleo INTO v_id_nucleo;

    -- B. Registrar a la persona (jefe) vinculándola de inmediato a este núcleo
    INSERT INTO public.persona (
        id_nucleo, nombre_completo, tipo_cedula, cedula_identidad, 
        fecha_nacimiento, genero, telefono, email, id_profesion, id_discapacidad
    )
    VALUES (
        v_id_nucleo, p_nombre_completo, p_tipo_cedula, p_cedula_identidad,
        p_fecha_nacimiento, p_genero, p_telefono, p_email, p_id_profesion, p_id_discapacidad
    )
    RETURNING id_persona INTO v_id_persona;

    -- C. Establecer a la persona como jefe de familia del núcleo
    -- Esto disparará trg_check_jefe_familia, la cual pasará porque la persona ya está en el núcleo
    UPDATE public.nucleo
    SET id_jefe_familia = v_id_persona
    WHERE id_nucleo = v_id_nucleo;

    -- D. Construir y retornar el resultado JSON con los detalles creados
    v_result := json_build_object(
        'success', true,
        'id_nucleo', v_id_nucleo,
        'id_jefe_familia', v_id_persona,
        'nombre_familia', p_nombre_familia
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Si ocurre cualquier error, PostgreSQL revierte todo automáticamente (ROLLBACK)
        RAISE EXCEPTION 'Error al registrar núcleo y jefe de familia: % (Código: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql;

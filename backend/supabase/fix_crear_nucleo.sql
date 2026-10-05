-- Función RPC para asignar una persona (nueva o existente) a una vivienda,
-- creando automáticamente su propio núcleo familiar de forma atómica y segura.
CREATE OR REPLACE FUNCTION public.asignar_persona_suelta_a_vivienda(
    p_nombre_familia VARCHAR,
    p_id_vivienda UUID,
    p_id_persona UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id_nucleo UUID;
BEGIN
    -- 1. Verificación estricta de seguridad
    IF NOT (
        public.es_admin() 
        OR (public.es_lider() AND public.vivienda_en_mi_comunidad(p_id_vivienda))
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: No tiene permisos sobre la vivienda especificada.';
    END IF;

    -- 2. Crear el núcleo familiar sin jefe inicialmente (para evitar el trigger de integridad)
    INSERT INTO public.nucleo (nombre_familia, id_vivienda, id_jefe_familia)
    VALUES (p_nombre_familia, p_id_vivienda, NULL)
    RETURNING id_nucleo INTO v_id_nucleo;

    -- 3. Asociar la persona a este nuevo núcleo
    UPDATE public.persona
    SET id_nucleo = v_id_nucleo
    WHERE id_persona = p_id_persona;

    -- 4. Establecer a la persona como el Jefe de Familia oficial
    UPDATE public.nucleo
    SET id_jefe_familia = p_id_persona
    WHERE id_nucleo = v_id_nucleo;

    RETURN json_build_object('success', true, 'id_nucleo', v_id_nucleo);
END;
$$;

ALTER FUNCTION public.asignar_persona_suelta_a_vivienda(VARCHAR, UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.asignar_persona_suelta_a_vivienda(VARCHAR, UUID, UUID) TO authenticated;

-- Refrescar el esquema
NOTIFY pgrst, 'reload schema';

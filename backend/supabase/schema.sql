-- Habilitar extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- TABLAS
-- =========================================================================

-- Tabla 1: roles
CREATE TABLE public.roles (
    id_rol UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_rol VARCHAR(100) UNIQUE NOT NULL
);

-- Tabla 2: comunidad
CREATE TABLE public.comunidad (
    id_comunidad UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_comunidad VARCHAR(255) UNIQUE NOT NULL
);

-- Tabla 3: usuario (Extiende auth.users en Supabase)
CREATE TABLE public.usuario (
    id_usuario UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    id_rol UUID NOT NULL REFERENCES public.roles(id_rol) ON DELETE RESTRICT,
    id_comunidad UUID REFERENCES public.comunidad(id_comunidad) ON DELETE SET NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla 4: edificio
CREATE TABLE public.edificio (
    id_edificio UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_comunidad UUID NOT NULL REFERENCES public.comunidad(id_comunidad) ON DELETE CASCADE,
    nombre_edificio VARCHAR(255) NOT NULL
);

-- Tabla 5: vivienda
CREATE TABLE public.vivienda (
    id_vivienda UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_comunidad UUID NOT NULL REFERENCES public.comunidad(id_comunidad) ON DELETE CASCADE,
    id_edificio UUID REFERENCES public.edificio(id_edificio) ON DELETE CASCADE, -- Nullable para casas
    numero_vivienda VARCHAR(50) NOT NULL,
    numero_bloque VARCHAR(50)
);

-- Tabla 6: núcleo (Circular FK, id_jefe_familia se agrega por alter table abajo)
CREATE TABLE public.nucleo (
    id_nucleo UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_vivienda UUID REFERENCES public.vivienda(id_vivienda) ON DELETE SET NULL,
    id_jefe_familia UUID, -- Nullable inicialmente para romper la dependencia circular
    nombre_familia VARCHAR(255) NOT NULL
);

-- Tabla 7: profesión
CREATE TABLE public.profesion (
    id_profesion UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_profesion VARCHAR(255) UNIQUE NOT NULL
);

-- Tabla 8: discapacidad
CREATE TABLE public.discapacidad (
    id_discapacidad UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_discapacidad VARCHAR(100) NOT NULL,
    nivel_discapacidad VARCHAR(100) NOT NULL,
    CONSTRAINT check_tipo_discapacidad CHECK (tipo_discapacidad IN ('Motriz', 'Psicosocial', 'Física', 'Fisica', 'Sensorial')),
    CONSTRAINT check_nivel_discapacidad CHECK (nivel_discapacidad IN ('Leve', 'Moderada', 'Grave', 'Total')),
    UNIQUE (tipo_discapacidad, nivel_discapacidad)
);

-- Tabla 9: persona
CREATE TABLE public.persona (
    id_persona UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_nucleo UUID REFERENCES public.nucleo(id_nucleo) ON DELETE SET NULL, -- Nullable para personas sin asociar
    nombre_completo VARCHAR(255) NOT NULL,
    tipo_cedula VARCHAR(5) NOT NULL CHECK (tipo_cedula IN ('V', 'E', 'J', 'P')),
    cedula_identidad VARCHAR(50) UNIQUE NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(20) NOT NULL CHECK (genero IN ('Masculino', 'Femenino', 'Otro')),
    telefono VARCHAR(50),
    email VARCHAR(255), -- Nullable como indica el requerimiento
    id_profesion UUID REFERENCES public.profesion(id_profesion) ON DELETE SET NULL, -- Nullable
    id_discapacidad UUID REFERENCES public.discapacidad(id_discapacidad) ON DELETE SET NULL, -- Nullable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agregar FK circular diferida para jefe de familia en núcleo
ALTER TABLE public.nucleo 
ADD CONSTRAINT fk_jefe_familia 
FOREIGN KEY (id_jefe_familia) 
REFERENCES public.persona(id_persona) 
ON DELETE SET NULL;

-- =========================================================================
-- ÍNDICES PARA OPTIMIZAR BÚSQUEDAS
-- =========================================================================
CREATE INDEX idx_persona_cedula ON public.persona(cedula_identidad);
CREATE INDEX idx_persona_nucleo ON public.persona(id_nucleo);
CREATE INDEX idx_vivienda_comunidad ON public.vivienda(id_comunidad);
CREATE INDEX idx_edificio_comunidad ON public.edificio(id_comunidad);
CREATE INDEX idx_usuario_comunidad ON public.usuario(id_comunidad);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) Y POLÍTICAS
-- =========================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edificio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vivienda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discapacidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona ENABLE ROW LEVEL SECURITY;

-- Funciones auxiliares de seguridad (Security Definer para evadir RLS recursivo)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.nombre_rol 
    FROM public.usuario u 
    JOIN public.roles r ON u.id_rol = r.id_rol 
    WHERE u.id_usuario = auth.uid();
$$;

ALTER FUNCTION public.get_user_role() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_user_community()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id_comunidad 
    FROM public.usuario 
    WHERE id_usuario = auth.uid();
$$;

ALTER FUNCTION public.get_user_community() OWNER TO postgres;

-- 1. Políticas para 'roles'
CREATE POLICY "Lectura de roles (anon y auth)" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Admins modifican roles" ON public.roles FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
);

-- 2. Políticas para 'comunidad'
CREATE POLICY "Lectura de comunidades" ON public.comunidad FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins modifican comunidades" ON public.comunidad FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
);

-- 3. Políticas para 'usuario'
CREATE POLICY "Anon puede verificar existencia de usuarios" ON public.usuario FOR SELECT TO anon USING (true);

CREATE POLICY "Lectura de usuarios" ON public.usuario FOR SELECT TO authenticated USING (
    id_usuario = auth.uid() 
    OR public.get_user_role() IN ('Administrador', 'administrador_debil') 
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);

CREATE POLICY "Inserción de usuarios" ON public.usuario FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('Administrador', 'administrador_debil') 
    OR id_usuario = auth.uid()
);

CREATE POLICY "Modificación de usuarios" ON public.usuario FOR UPDATE TO authenticated USING (
    id_usuario = auth.uid() 
    OR public.get_user_role() IN ('Administrador', 'administrador_debil')
);

CREATE POLICY "Eliminar usuarios" ON public.usuario FOR DELETE TO authenticated USING (
    public.get_user_role() = 'Administrador'
    OR (
        public.get_user_role() = 'administrador_debil'
        AND id_rol NOT IN (
            SELECT id_rol FROM public.roles WHERE nombre_rol IN ('Administrador', 'administrador_debil')
        )
    )
);

-- 4. Políticas para 'edificio'
CREATE POLICY "Lectura de edificios" ON public.edificio FOR SELECT TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() IN ('Líder de comunidad', 'Consultor') AND id_comunidad = public.get_user_community())
);
CREATE POLICY "Insertar edificios" ON public.edificio FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);
CREATE POLICY "Actualizar edificios" ON public.edificio FOR UPDATE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);
CREATE POLICY "Eliminar edificios" ON public.edificio FOR DELETE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);

-- 5. Políticas para 'vivienda'
CREATE POLICY "Lectura de viviendas" ON public.vivienda FOR SELECT TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() IN ('Líder de comunidad', 'Consultor') AND id_comunidad = public.get_user_community())
);
CREATE POLICY "Insertar viviendas" ON public.vivienda FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);
CREATE POLICY "Actualizar viviendas" ON public.vivienda FOR UPDATE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);
CREATE POLICY "Eliminar viviendas" ON public.vivienda FOR DELETE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);

-- 6. Políticas para 'nucleo'
CREATE POLICY "Lectura de nucleos" ON public.nucleo FOR SELECT TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() IN ('Líder de comunidad', 'Consultor') AND id_vivienda IN (
            SELECT id_vivienda FROM public.vivienda WHERE id_comunidad = public.get_user_community()
        )
    )
);
CREATE POLICY "Insertar nucleos" ON public.nucleo FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' AND id_vivienda IN (
            SELECT id_vivienda FROM public.vivienda WHERE id_comunidad = public.get_user_community()
        )
    )
);
CREATE POLICY "Actualizar nucleos" ON public.nucleo FOR UPDATE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' AND id_vivienda IN (
            SELECT id_vivienda FROM public.vivienda WHERE id_comunidad = public.get_user_community()
        )
    )
);
CREATE POLICY "Eliminar nucleos" ON public.nucleo FOR DELETE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' AND id_vivienda IN (
            SELECT id_vivienda FROM public.vivienda WHERE id_comunidad = public.get_user_community()
        )
    )
);

-- 7. Políticas para 'profesion'
CREATE POLICY "Lectura de profesiones" ON public.profesion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura de profesiones" ON public.profesion FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil', 'Líder de comunidad')
);

-- 8. Políticas para 'discapacidad'
CREATE POLICY "Lectura de discapacidades" ON public.discapacidad FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura de discapacidades" ON public.discapacidad FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil', 'Líder de comunidad')
);

-- 9. Políticas para 'persona'
CREATE POLICY "Lectura de personas" ON public.persona FOR SELECT TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() IN ('Líder de comunidad', 'Consultor') 
        AND (
            id_nucleo IS NULL 
            OR id_nucleo IN (
                SELECT n.id_nucleo FROM public.nucleo n 
                JOIN public.vivienda v ON n.id_vivienda = v.id_vivienda 
                WHERE v.id_comunidad = public.get_user_community()
            )
        )
    )
);

CREATE POLICY "Insertar personas" ON public.persona FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' 
        AND (
            id_nucleo IS NULL 
            OR id_nucleo IN (
                SELECT n.id_nucleo FROM public.nucleo n 
                JOIN public.vivienda v ON n.id_vivienda = v.id_vivienda 
                WHERE v.id_comunidad = public.get_user_community()
            )
        )
    )
);

CREATE POLICY "Actualizar personas" ON public.persona FOR UPDATE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' 
        AND (
            id_nucleo IS NULL 
            OR id_nucleo IN (
                SELECT n.id_nucleo FROM public.nucleo n 
                JOIN public.vivienda v ON n.id_vivienda = v.id_vivienda 
                WHERE v.id_comunidad = public.get_user_community()
            )
        )
    )
);

CREATE POLICY "Eliminar personas" ON public.persona FOR DELETE TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' 
        AND (
            id_nucleo IS NULL 
            OR id_nucleo IN (
                SELECT n.id_nucleo FROM public.nucleo n 
                JOIN public.vivienda v ON n.id_vivienda = v.id_vivienda 
                WHERE v.id_comunidad = public.get_user_community()
            )
        )
    )
);

-- =========================================================================
-- DATOS SEMILLA (SEED DATA) — ROLES DEL SISTEMA
-- Estos roles deben existir antes de crear cualquier usuario.
-- =========================================================================
INSERT INTO public.roles (nombre_rol) VALUES 
    ('Administrador'),
    ('Líder de comunidad'),
    ('Consultor'),
    ('administrador_debil')
ON CONFLICT (nombre_rol) DO NOTHING;

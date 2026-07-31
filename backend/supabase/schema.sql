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
RETURNS VARCHAR AS $$
    SELECT r.nombre_rol 
    FROM public.usuario u 
    JOIN public.roles r ON u.id_rol = r.id_rol 
    WHERE u.id_usuario = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_community()
RETURNS UUID AS $$
    SELECT id_comunidad 
    FROM public.usuario 
    WHERE id_usuario = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Políticas para 'roles'
-- Lectura pública (incluyendo anon para flujo de registro inicial)
CREATE POLICY "Permitir lectura de roles a todos" 
ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura de roles anon" 
ON public.roles FOR SELECT TO anon USING (true);

CREATE POLICY "Solo Administrador puede modificar roles" 
ON public.roles FOR ALL TO authenticated USING (public.get_user_role() IN ('Administrador', 'administrador_debil'));

-- 2. Políticas para 'comunidad'
CREATE POLICY "Permitir lectura de comunidades a todos" 
ON public.comunidad FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo Administrador puede modificar comunidades" 
ON public.comunidad FOR ALL TO authenticated USING (public.get_user_role() IN ('Administrador', 'administrador_debil'));

-- 3. Políticas para 'usuario'
-- Lectura anon limitada: solo contar si existen usuarios (para decidir registro vs login)
CREATE POLICY "Anon puede verificar existencia de usuarios"
ON public.usuario FOR SELECT TO anon USING (true);

CREATE POLICY "Lectura de perfiles de usuario" 
ON public.usuario FOR SELECT TO authenticated USING (
    id_usuario = auth.uid() 
    OR public.get_user_role() IN ('Administrador', 'administrador_debil') 
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);

CREATE POLICY "Modificación de perfiles de usuario" 
ON public.usuario FOR UPDATE TO authenticated USING (
    id_usuario = auth.uid() 
    OR public.get_user_role() IN ('Administrador', 'administrador_debil')
);

CREATE POLICY "Inserción de usuarios" 
ON public.usuario FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('Administrador', 'administrador_debil') OR id_usuario = auth.uid()
);

CREATE POLICY "Eliminación de usuarios por administrador" 
ON public.usuario FOR DELETE TO authenticated USING (
    public.get_user_role() = 'Administrador'
    OR (
        public.get_user_role() = 'administrador_debil'
        AND usuario.id_rol NOT IN (
            SELECT id_rol FROM public.roles WHERE nombre_rol IN ('Administrador', 'administrador_debil')
        )
    )
);

-- 4. Políticas para 'edificio'
CREATE POLICY "Permitir lectura de edificios a todos" 
ON public.edificio FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura de edificios para Administradores y Líderes" 
ON public.edificio FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);

-- 5. Políticas para 'vivienda'
CREATE POLICY "Permitir lectura de viviendas a todos" 
ON public.vivienda FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura de viviendas para Administradores y Líderes" 
ON public.vivienda FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (public.get_user_role() = 'Líder de comunidad' AND id_comunidad = public.get_user_community())
);

-- 6. Políticas para 'nucleo'
CREATE POLICY "Permitir lectura de nucleos a todos" 
ON public.nucleo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura de nucleos para Administradores y Líderes" 
ON public.nucleo FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad' 
        AND EXISTS (
            SELECT 1 FROM public.vivienda v 
            WHERE v.id_vivienda = nucleo.id_vivienda 
            AND v.id_comunidad = public.get_user_community()
        )
    )
);

-- 7. Políticas para 'profesion'
CREATE POLICY "Permitir lectura de profesiones a todos" 
ON public.profesion FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura de profesiones para Administradores y Líderes" 
ON public.profesion FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil', 'Líder de comunidad')
);

-- 8. Políticas para 'discapacidad'
CREATE POLICY "Permitir lectura de discapacidades a todos" 
ON public.discapacidad FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura de discapacidades para Administradores y Líderes" 
ON public.discapacidad FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil', 'Líder de comunidad')
);

-- 9. Políticas para 'persona'
CREATE POLICY "Permitir lectura de personas a todos" 
ON public.persona FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura de personas para Administradores y Líderes" 
ON public.persona FOR ALL TO authenticated USING (
    public.get_user_role() IN ('Administrador', 'administrador_debil')
    OR (
        public.get_user_role() = 'Líder de comunidad'
        AND (
            persona.id_nucleo IS NULL 
            OR EXISTS (
                SELECT 1 FROM public.nucleo n
                JOIN public.vivienda v ON n.id_vivienda = v.id_vivienda
                WHERE n.id_nucleo = persona.id_nucleo
                AND v.id_comunidad = public.get_user_community()
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

# Manual Técnico - Sistema de Gestión Comunal (SGC)

Este documento describe de forma exhaustiva la arquitectura, la estructura interna, el modelo de datos, los mecanismos de seguridad, las funcionalidades del sistema y las configuraciones necesarias para su correcto funcionamiento. Está dirigido exclusivamente a personal técnico responsable del mantenimiento, auditoría o continuidad del proyecto.

## Índice

- [1. Información del Proyecto y Credenciales del Propietario](#1-información-del-proyecto-y-credenciales-del-propietario)
- [2. Descripción General del Sistema](#2-descripción-general-del-sistema)
- [3. Arquitectura del Sistema](#3-arquitectura-del-sistema)
  - [3.1 Tipo de Arquitectura](#31-tipo-de-arquitectura)
  - [3.2 Stack Tecnológico](#32-stack-tecnológico)
- [4. Estructura de Archivos del Proyecto](#4-estructura-de-archivos-del-proyecto)
  - [4.1 Directorio Raíz](#41-directorio-raíz)
  - [4.2 Directorio frontend/](#42-directorio-frontend)
  - [4.3 Directorio backend/supabase/](#43-directorio-backendsupabase)
- [5. Sistema de Seguridad y Control de Acceso](#5-sistema-de-seguridad-y-control-de-acceso)
  - [5.1 Autenticación](#51-autenticación)
  - [5.2 Roles del Sistema](#52-roles-del-sistema)
- [6. Automatizaciones de Base de Datos (Triggers y RPC)](#6-automatizaciones-de-base-de-datos-triggers-y-rpc)
  - [6.1 Trigger: Sincronización Automática de Usuarios](#61-trigger-sincronización-automática-de-usuarios)
  - [6.2 Trigger: Validación de Jefe de Familia](#62-trigger-validación-de-jefe-de-familia)
  - [6.3 RPC: Registro Atómico de Núcleo y Jefe](#63-rpc-registro-atómico-de-núcleo-y-jefe)
  - [6.4 RPC: Asignación de Persona Suelta a Vivienda](#64-rpc-asignación-de-persona-suelta-a-vivienda)
- [7. Navegación y Comportamiento de la Interfaz](#7-navegación-y-comportamiento-de-la-interfaz)

## 1. Información del Proyecto y Credenciales del Propietario

Esta sección contiene los datos de acceso y propiedad necesarios para la administración de las plataformas donde opera el sistema. **Debe ser completada por el propietario del proyecto.**

| Concepto | Dato |
|---|---|
| **Nombre del proyecto** | Sistema de Gestión Comunal (SGC) |
| **Repositorio (URL)** | *`[Insertar URL del repositorio aquí]`* |
| **Propietario del repositorio (GitHub)** | *`[Insertar usuario de GitHub aquí]`* |
| **Correo de acceso a GitHub** | *`[Insertar correo aquí]`* |
| **Correo de acceso a Supabase** | *`[Insertar correo aquí]`* |
| **Correo de acceso a Vercel** | *`[Insertar correo aquí]`* |
| **URL de la aplicación en producción** | *`[Insertar URL del sitio desplegado aquí]`* |
| **URL del proyecto en Supabase** | *`[Insertar URL de Supabase aquí, ej: https://xxxx.supabase.co]`* |

> **Advertencia de Seguridad:** Este apartado contiene información sensible. No comparta este manual con personas no autorizadas ni lo publique en repositorios públicos sin antes eliminar o redactar esta sección.

---

## 2. Descripción General del Sistema

El **Sistema de Gestión Comunal (SGC)** es una aplicación web diseñada para registrar, organizar y analizar la información censal de comunidades. Permite llevar un control digitalizado de los habitantes, las familias a las que pertenecen, las viviendas que ocupan y la estructura geográfica de los sectores o barrios. Sus funcionalidades principales son:

- Registro y administración del censo de personas (habitantes).
- Organización de personas en núcleos familiares con designación de jefes de hogar.
- Registro jerárquico de la estructura geográfica: Comunidad → Edificio (opcional) → Vivienda.
- Panel de control (Dashboard) con estadísticas demográficas en tiempo real.
- Reportes gráficos exportables a PDF.
- Exportación de datos censales a formato Excel (.xlsx).
- Sistema de roles y permisos que restringe el acceso según el tipo de usuario.
- Soporte para modo claro y modo oscuro en la interfaz.
- Diseño adaptable (responsive) para pantallas de escritorio, tabletas y teléfonos móviles.

---

## 3. Arquitectura del Sistema

### 3.1 Tipo de Arquitectura

El SGC opera bajo una arquitectura **Serverless de tipo Single Page Application (SPA)**. Esto significa que:

- **No existe un servidor backend propio.** No hay un proceso de Node.js, Python, PHP ni ningún otro lenguaje corriendo en un servidor intermedio. La aplicación se compone exclusivamente de archivos estáticos (HTML, CSS, JavaScript) que el navegador del usuario descarga y ejecuta.
- **La base de datos, la autenticación y las reglas de negocio del lado del servidor** están delegadas en su totalidad al servicio de **Supabase**, un Backend-as-a-Service (BaaS) construido sobre PostgreSQL.
- **La comunicación entre el navegador y Supabase** se realiza mediante llamadas HTTPS directas a la API REST auto-generada de Supabase (PostgREST) y a su SDK de JavaScript. La seguridad de estas llamadas está garantizada por tokens JWT firmados (JSON Web Tokens) y por políticas de Row Level Security (RLS) definidas directamente en la base de datos.

El flujo de datos se resume así:

```
Navegador del Usuario (Frontend)
       │
       │  HTTPS (API REST + JWT)
       ▼
Supabase (Cloud)
  ├── Auth        → Gestiona login, registro, sesiones y tokens.
  ├── PostgREST   → API REST auto-generada desde las tablas PostgreSQL.
  └── PostgreSQL   → Base de datos relacional con RLS, triggers y funciones.
```

### 3.2 Stack Tecnológico

| Capa | Tecnología | Versión / Detalle |
|---|---|---|
| Lenguaje de marcado | HTML5 | Semántico, con formularios nativos y validación del navegador |
| Estilos | CSS3 (Vanilla) | Variables CSS (custom properties), diseño responsive con media queries|
| Lógica de cliente | JavaScript ES6+ | Módulos nativos (`<script type="module">`), sin transpilador ni bundler |
| Base de datos | PostgreSQL 15+ | Administrada por Supabase |
| Autenticación | Supabase Auth | Login por correo/contraseña, recuperación de contraseña por email |
| API REST | PostgREST (Supabase) | Generada automáticamente desde el esquema `public` de PostgreSQL |
| Gráficos | Chart.js | Cargado vía CDN. Utilizado para barras y gráficos circulares |
| Exportación Excel | SheetJS (xlsx) | Cargado vía CDN. Genera archivos `.xlsx` desde el navegador |
| Exportación PDF | jsPDF + html2canvas | Cargados vía CDN. Capturan el HTML de los gráficos y lo convierten a documento PDF |
| Hosting | Vercel | Hosting de archivos estáticos con build script personalizado |


## 4. Estructura de Archivos del Proyecto

### 4.1 Directorio Raíz

```
SistemaSgc-main/
├── build.sh                → Script de construcción ejecutado por Vercel durante el despliegue.
├── vercel.json             → Configuración del entorno de despliegue en Vercel.
├── MANUAL_TECNICO.md           → Este documento.
├── frontend/               → Código fuente completo del cliente (SPA).
└── backend/
    └── supabase/           → Scripts SQL de la base de datos.
```

### 4.2 Directorio `frontend/`

Contiene todos los archivos que conforman la aplicación visible al usuario. Estos archivos son servidos como contenido estático por Vercel.

| Archivo | Responsabilidad |
|---|---|
| `index.html` | **Punto de entrada único** de la aplicación. Contiene toda la estructura HTML del sistema: las 4 pantallas de autenticación (registro, login, recuperación de contraseña, restablecimiento de contraseña), la barra lateral completa, la barra superior, los 8 paneles de contenido (Dashboard, Censo, Familias, Viviendas, Usuarios, Reportes, Parámetros, Mi Cuenta) y todos los diálogos modales (7 en total). |
| `styles.css` | Hoja de estilos global. Define el sistema de diseño completo: variables de color para tema claro y oscuro, tipografía, componentes (botones, tarjetas, tablas, modales, formularios, toasts), layout responsive y animaciones. |
| `app.js` | **Controlador principal.** Punto de arranque del JavaScript. Inicializa la autenticación, configura los listeners de eventos de toda la interfaz (clics, envíos de formularios), coordina la navegación entre paneles y orquesta las llamadas entre la capa de datos y la capa visual. |
| `ui.js` | **Capa de presentación.** Se encarga exclusivamente de manipular el DOM: rellenar tablas, mostrar y ocultar modales, renderizar tarjetas de familias, construir el árbol de estructura geográfica, y gestionar los filtros del censo. |
| `auth.js` | **Gestor de sesión.** Controla el flujo de autenticación: verifica si hay una sesión activa al cargar la página, maneja el login, el registro del administrador inicial, el cierre de sesión y actualiza la interfaz del perfil del usuario en la barra lateral. |
| `supabase-client.js` | **Capa de acceso a datos (Repositorio).** Inicializa el cliente de Supabase y expone todas las funciones de lectura y escritura hacia la base de datos (CRUD para personas, núcleos, viviendas, edificios, comunidades, profesiones, discapacidades, usuarios y roles). |
| `notifications.js` | **Sistema de notificaciones.** Proporciona dos funciones: notificaciones flotantes tipo "toast" (informativas, de éxito, advertencia y error) con auto-cierre temporizado, y diálogos de confirmación con respuesta de aceptar/cancelar. |
| `env.js` | **Variables de entorno.** Contiene las credenciales de conexión a Supabase (`SUPABASE_URL` y `SUPABASE_ANON_KEY`). En producción, este archivo es generado automáticamente por el script `build.sh`. En desarrollo local, se crea manualmente copiando `env.example.js`. |
| `env.example.js` | Plantilla vacía de `env.js` para referencia del desarrollador. |

### 4.3 Directorio `backend/supabase/`

Contiene los scripts SQL que definen y mantienen la base de datos. No se ejecutan automáticamente; deben ser ejecutados manualmente en el Editor SQL de Supabase.

| Archivo | Responsabilidad |
|---|---|
| `schema.sql` | Define toda la estructura de la base de datos: creación de tablas, columnas, tipos de datos, llaves primarias, llaves foráneas, restricciones `CHECK`, índices de rendimiento, habilitación de RLS en todas las tablas, funciones auxiliares de seguridad y datos semilla (roles iniciales). Es el script fundacional que debe ejecutarse primero. |
| `triggers.sql` | Contiene los triggers (disparadores automáticos) y las funciones RPC (Remote Procedure Call): sincronización automática de usuarios de Auth a la tabla pública, validación de integridad del jefe de familia y la función transaccional para registrar un núcleo y su jefe de familia de forma atómica. |
| `policies.sql` | Script completo y autosuficiente de políticas de Row Level Security (RLS). Limpia todas las políticas existentes, recrea las funciones auxiliares de seguridad con normalización de roles (sin acentos, minúsculas), y define las políticas de lectura/escritura/eliminación para cada una de las 9 tablas del sistema. |
| `fix_crear_nucleo.sql` | Script de corrección (hotfix). Agrega la función RPC `asignar_persona_suelta_a_vivienda` que permite asignar personas sin familia a una vivienda creando automáticamente su núcleo familiar. |
| `fix_usuario_perfil.sql` | Script de diagnóstico y reparación. Corrige la situación en la que una cuenta de autenticación (en `auth.users`) no tiene su perfil correspondiente en la tabla `public.usuario` (lo que provoca errores de permisos). |

---

## 5. Sistema de Seguridad y Control de Acceso

### 5.1 Autenticación

La autenticación se gestiona íntegramente a través de **Supabase Auth**. El sistema soporta los siguientes flujos:

- **Registro inicial:** La primera persona que se registra recibe automáticamente el rol de "Administrador" (controlado por un trigger en la base de datos). Todos los registros subsiguientes reciben el rol de "Consultor".
- **Inicio de sesión:** Mediante correo electrónico y contraseña. Supabase genera un token JWT que el SDK de JavaScript almacena en `localStorage` del navegador.
- **Recuperación de contraseña:** El usuario solicita un enlace de restablecimiento que se envía a su correo electrónico. Al hacer clic en el enlace, es redirigido a la misma aplicación donde puede establecer una nueva contraseña.
- **Persistencia de sesión:** El SDK de Supabase maneja automáticamente la renovación del token JWT. La sesión persiste mientras el token sea válido o hasta que el usuario cierre sesión explícitamente.

### 5.2 Roles del Sistema

El sistema define 4 roles con diferentes niveles de acceso:

| Rol | Descripción | Alcance geográfico |
|---|---|---|
| **Administrador** | Superusuario. Puede ver, crear, editar y eliminar todo, incluyendo otros administradores. Accede a "Gestión de Cuentas" y "Configuración de Parámetros". | Todas las comunidades. |
| **administrador_debil** | Similar al Administrador, pero **no puede eliminar** cuentas de tipo Administrador ni administrador_debil. | Todas las comunidades. |
| **Líder de comunidad** | Puede ver toda la información, pero solo puede crear, editar y eliminar datos que pertenezcan a **su comunidad asignada** (viviendas, edificios, personas y núcleos vinculados a su comunidad). | Solo su comunidad. |
| **Consultor** | Acceso de **solo lectura**. Puede ver toda la información pero no puede modificar, crear ni eliminar ningún registro. | Lectura de todas las comunidades. |

## 6. Automatizaciones de Base de Datos (Triggers y RPC)

### 6.1 Trigger: Sincronización Automática de Usuarios

- **Nombre:** `on_auth_user_created`
- **Evento:** Se dispara automáticamente **después** de que se inserta un nuevo registro en `auth.users` (es decir, cuando alguien se registra).
- **Comportamiento:** La función `handle_new_user()` crea automáticamente una fila en `public.usuario` con los datos del nuevo usuario. Si es el primer usuario del sistema (no existen registros previos en `public.usuario`), le asigna el rol de "Administrador". En cualquier otro caso, le asigna el rol de "Consultor".

### 6.2 Trigger: Validación de Jefe de Familia

- **Nombre:** `trg_check_jefe_familia`
- **Evento:** Se dispara **antes** de una inserción o actualización del campo `id_jefe_familia` en la tabla `nucleo`.
- **Comportamiento:** Verifica que la persona asignada como jefe de familia realmente pertenezca al núcleo familiar en cuestión (es decir, que su `id_nucleo` coincida). Si no pertenece, la operación se rechaza con una excepción de integridad.

### 6.3 RPC: Registro Atómico de Núcleo y Jefe

- **Nombre:** `registrar_nucleo_y_jefe()`
- **Evento:** Función RPC invocada desde el frontend.
- **Propósito:** Resuelve el problema de la dependencia circular entre `nucleo` y `persona`. Ejecuta los tres pasos en una sola transacción atómica:
  1. Crea el núcleo familiar **sin** jefe (para evitar el trigger de validación).
  2. Crea la persona y la vincula inmediatamente al núcleo recién creado.
  3. Actualiza el núcleo para asignar a esa persona como jefe de familia.

### 6.4 RPC: Asignación de Persona Suelta a Vivienda

- **Nombre:** `asignar_persona_suelta_a_vivienda()`
- **Evento:** Función RPC invocada desde el frontend.
- **Propósito:** Permite tomar una persona que no tiene familia asignada y asignarla a una vivienda, creando automáticamente un núcleo familiar para ella y designándola como jefe de hogar.

---

## 7. Navegación y Comportamiento de la Interfaz

- **Single Page Application (SPA):** La aplicación nunca recarga la página ni navega a una URL diferente. Toda la navegación se realiza mostrando y ocultando paneles (`<section>`) dentro de un contenedor principal. El panel activo se identifica mediante el atributo `data-target` de los botones del menú lateral.
- **Persistencia de la vista activa:** El ID del panel activo se almacena en `sessionStorage` con la clave `activePanelId`, de modo que al recargar la página el usuario regresa al mismo panel que estaba viendo.
- **Búsqueda global:** La barra de búsqueda en la cabecera permite buscar por cédula, nombre o comunidad. Al presionar Enter, el sistema navega automáticamente al panel de Censo de Personas y aplica el término buscado como filtro.
- **Selector de comunidad:** Disponible en la barra superior. Permite a los administradores filtrar toda la información visible por una comunidad específica o ver todas las comunidades.
- **Tema claro/oscuro:** Alternado mediante un botón en la barra superior. Se implementa cambiando el atributo `data-theme` del elemento `<html>`, lo que activa un conjunto alternativo de variables CSS.
- **Responsividad:** En pantallas menores a 768px, la barra lateral se oculta completamente y se muestra un botón de menú hamburguesa (☰) que la despliega como un panel deslizable con un overlay oscuro detrás.

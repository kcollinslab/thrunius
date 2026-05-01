# Control de Acceso: Roles y Permisos por Ruta

Este documento detalla la simplificación e implementación del sistema de control de acceso (RBAC) dual en la aplicación Thrunius. El sistema cuenta con dos capas de seguridad integradas: la interfaz de usuario (Frontend con Vue Router) y la base de datos (Backend con Supabase RLS).

---

## 1. Protección del Frontend (Vue Router)

La primera línea de defensa ocurre directamente en el navegador. Protegemos las vistas y secciones visuales de la aplicación según el rol que tenga asignado el usuario en su perfil.

### Propiedades Metadata de Ruta
Cada ruta en el archivo `src/router/index.js` define si es pública o qué perfil se necesita para ingresar mediante la propiedad `meta: { ... }`:

- **Rutas Públicas:** `meta: { isPublic: true }` (Ej. Login, Registro).
- **Rutas para Usuarios Autenticados (Cualquier rol):** `meta: { requiresAuth: true }` (Ej. Mi Perfil, Biblioteca).
- **Control Estricto por Rol:** `meta: { roles: ['admin', 'editor'] }` (Ej. Crear Posts, Editar Usuarios).

### El Guardián de Navegación (`router.beforeEach`)
Cada vez que un usuario hace clic en un enlace o escribe una URL, Vue intercepta la navegación antes de cargar el componente visual. El ciclo lógico es el siguiente:
1. Verifica si la ruta a la que se dirige exige autenticación o roles.
2. Comprueba la **sesión actual** almacenada en Supabase localmente. Si no existe, lo redirige a `/login`.
3. Si la ruta es estricta (exige la regla de roles), consulta inmediatamente la tabla `profiles` en Supabase para cerciorarse de qué rol tiene el usuario.
4. Si coincide el rol encontrado con alguno de los declarados en `meta.roles`, lo deja pasar (`next()`). Si es un intruso o no tiene la jerarquía requerida, se bloquea el acceso y lo devuelve típicamente a `/profile` con una advertencia en la consola.

---

## 2. Protección del Backend (Supabase RLS)

Como proteger el frontend no impide que usuarios avanzados manipulen peticiones desde consola o intercepten el API (vía Postman/cURL), el backend está sellado a nivel de fila mediante **Row Level Security (RLS)**.

### Función de Privilegios Administrativos (`is_admin()`)
En toda buena arquitectura, la autorización central debe basarse en funciones seguras. Hemos abandonado el rastreo multi-tabla y creado una función atómica en PostgreSQL dentro de tu Supabase:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

> **Nota:** La función opera bajo `SECURITY DEFINER`, lo que significa que elude otras reglas recursivas de RLS local. Su comportamiento permite evaluar al momento y muy rápido si el `auth.uid()` que está haciendo la petición ostenta el valor `'admin'` y devuelve una decisión binaria (`TRUE`/`FALSE`).

### Políticas Todo Poderosas (Full CRUD)
Para las tablas maestras del sistema (como `profiles`, `posts`, `files`), se aplicaron políticas simplificadas en las que el rol de tipo administrador tiene un paso preferente y universal:

```sql
CREATE POLICY "Admins can do everything on profiles" 
ON public.profiles FOR ALL TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());
```

Esta estructura dicta lo siguiente para el Motor SQL: *"Si el usuario logueado en esta transacción devuelve TRUE en `is_admin()`, permítele listar, crear, modificar o eliminar registros (FOR ALL) incondicionalmente, brincándose filtros locales de propietario o permisos adicionales."*

### Resumen
* **Frontend:** Garantiza una buena experiencia de usuario, ocultando botones y evitando cargar pantallas o componentes donde el usuario no tiene negocio o permiso.
* **Backend:** Es el candado criptográfico definitivo donde fallar en el frontend nunca significará la fuga o manipulación ilegítima de los datos de la base de datos de Thrunius.

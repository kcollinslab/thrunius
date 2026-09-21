# Seguridad de usuarios y perfiles

Proyecto Supabase: `thrunius` (`ulrybwdirjrqhszpztoo`).

Migraciones aplicadas y registradas en Supabase:

- `20260912002200_secure_profile_role_updates`.
- `20260912005419_harden_profile_lifecycle_and_privileges`.

## Acceso desde la aplicación

- `auth.users` no concede acceso directo a `anon` ni a `authenticated`.
- `profiles` mantiene RLS habilitado.
- `anon` no tiene privilegios sobre `profiles`.
- `authenticated` puede leer perfiles y actualizar únicamente sus propios campos
  `full_name`, `about`, `birth_date`, `gender` y `updated_at`.
- El cliente no puede insertar, eliminar ni truncar perfiles, ni modificar `id`
  o `role` directamente.
- Los administradores editan mediante `public.admin_actualizar_perfil`, una RPC
  `SECURITY INVOKER` que delega en `privado.admin_actualizar_perfil`.
- La implementación privada valida la sesión y el rol desde `profiles`, valida
  los datos e impide que un administrador cambie su propio rol.
- `privado` no debe añadirse a los esquemas expuestos por la Data API.
- El registro de Auth ejecuta `privado.handle_new_user` y crea el perfil con rol
  `subscriber`, independientemente del rol enviado en los metadatos del usuario.
- Las funciones de trigger no son ejecutables por clientes y las funciones
  relacionadas tienen un `search_path` fijo y vacío.

## Eliminación de cuentas

La interfaz no elimina perfiles: borrar una fila de `profiles` no elimina la
cuenta de Auth. La eliminación real de cuentas no está implementada en Vue.
Debe gestionarse mediante un flujo administrativo de Supabase Auth, considerando
la revocación de sesiones, los archivos de Storage y los registros relacionados.
Nunca añadir una clave `service_role` o secreta al frontend.

## Verificación realizada

Se probaron en una subtransacción revertida automáticamente:

- Creación de usuarios y perfiles por el trigger con rol inicial `subscriber`.
- Edición propia y bloqueo de edición de otros perfiles.
- Bloqueo de `INSERT`, `DELETE` y actualización directa de `role`.
- Rechazo de la RPC para suscriptores y edición permitida para administradores.
- Bloqueo del cambio de rol propio del administrador.
- Ausencia de usuarios y perfiles de prueba después de las comprobaciones.

Los privilegios de `TRUNCATE`, `REFERENCES` y `TRIGGER` también se verificaron
como revocados. Se conservaron los dos usuarios y los dos perfiles originales.

## Ajuste manual pendiente de Auth

El asesor de Supabase solo mantiene la advertencia de protección contra
contraseñas filtradas desactivada. El conector disponible no permite cambiar
esta configuración.

En el proyecto `thrunius`, abrir Authentication > configuración de contraseñas
y activar **Leaked password protection**, si el plan lo permite. Después,
ejecutar nuevamente el asesor de seguridad.

- [Configuración de Authentication](https://supabase.com/dashboard/project/ulrybwdirjrqhszpztoo/auth/settings)
- [Documentación oficial sobre contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

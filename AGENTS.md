# AGENTS.md

## Contexto

**Thrunius** es una aplicación web construida con Vue.js (Vite) + Bootstrap 5, conectada a Supabase (DB, Auth, Storage).

Objetivo actual: CRUD de `posts` con control de acceso por roles.

---

## Stack

* Vue.js + Vite
* Bootstrap 5
* Supabase (DB, Auth, Storage)
* JavaScript

---

## Módulos

### posts

* CRUD de artículos
* Listado y detalle

### profiles

* Usuarios con campo `role`

Roles:

* `admin`
* `editor`
* `subscriber`

### files

* Storage + metadatos en DB

---

## Permisos

* `admin`: acceso total
* `editor`: crear/editar posts
* `subscriber`: solo lectura

⚠️ Siempre validar rol antes de editar/eliminar

---

## Comandos del proyecto

### Desarrollo (principal)

```bash
npm run dev
```

* Servidor local con hot reload
* Usar SIEMPRE para probar cambios

### Build (uso limitado)

```bash
npm run build
```

* Solo para validación final
* No ejecutar en cada cambio

---

## Flujo de trabajo esperado

1. Implementar cambios
2. Probar en `npm run dev`
3. Validar funcionalidad en navegador
4. Ejecutar `build` solo si:

   * se completa una funcionalidad
   * hay cambios estructurales

---

## Convenciones

### Frontend

* Componentes pequeños y reutilizables
* Evitar lógica compleja en templates
* No agregar librerías innecesarias
* Usar Vue Toastification para notificaciones

### Supabase

* No asumir permisos sin validación
* Centralizar acceso
* No modificar estructura sin indicación

### CRUD

* Formularios simples
* Validación mínima necesaria
* Mensajes claros

---

## UI

* Minimalista
* Bootstrap 5
* Priorizar claridad

---

## Qué evitar

* Sobrearquitectura
* Duplicación de lógica
* Mezclar auth con UI
* Edición sin validación de rol

---

## Reglas del agente

Al implementar:

1. Identificar módulo (`posts`, `profiles`, `files`)
2. Aplicar solución simple
3. Validar permisos
4. No romper flujo existente
5. Explicar cambios brevemente

---

## Casos clave

* CRUD de `posts`
* Roles y permisos
* Integración con Supabase
* Subida de archivos

---

## Definición de éxito

* CRUD funcional
* Permisos correctos
* Código claro
* UI usable
* No errores en `dev`

## MCP Supabase

Este proyecto puede usar MCP de Supabase configurado en `.codex/config.toml`.

Reglas:
- Usar MCP principalmente para inspeccionar estructura de tablas.
- No modificar datos ni estructura sin autorización explícita.
- Preferir modo `read_only=true` durante desarrollo inicial.
- Validar siempre permisos por rol desde la aplicación, no solo desde MCP.

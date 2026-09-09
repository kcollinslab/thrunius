# Catalogos de aplicacion

Esta carpeta centraliza listas pequenas y estables de opciones usadas por la aplicacion, como `posts.visibility` o `posts.type_post`.

El objetivo es evitar valores quemados en formularios, vistas, filtros y consultas. La base de datos debe guardar una `key` estable, mientras la interfaz muestra un `label` legible.

## Regla general

Cada opcion debe tener esta forma:

```js
{
  key: 'publico',
  label: 'Público',
}
```

- `key`: valor que se guarda en Supabase. Debe ser tipo slug: minusculas, sin espacios, sin tildes.
- `label`: texto visible para usuarios. Puede usar tildes y cambiar sin migrar datos.

## Estructura recomendada

Para cada campo catalogado se recomienda exportar:

- `*_KEYS`: objeto con las keys canonicas.
- `*`: array de opciones para selects, radios o controles similares.
- `*_LABELS`: mapa para obtener labels rapidamente.
- `normalize*`: helper para convertir valores antiguos o escritos con labels a la key canonica.
- `get*Label`: helper para mostrar el label correcto en vistas.
- `*_VALUES`: listas temporales de compatibilidad para consultas contra datos no migrados.

Ejemplo actual:

```js
export const POST_VISIBILITY_KEYS = Object.freeze({
  HIDDEN: 'oculto',
  PRIVATE: 'privado',
  PUBLIC: 'publico',
})

export const POST_VISIBILITY = Object.freeze([
  { key: POST_VISIBILITY_KEYS.HIDDEN, label: 'Oculto' },
  { key: POST_VISIBILITY_KEYS.PRIVATE, label: 'Privado' },
  { key: POST_VISIBILITY_KEYS.PUBLIC, label: 'Público' },
])
```

## Uso en formularios

Los formularios deben consumir el catalogo, no declarar opciones manualmente:

```vue
<select v-model="form.visibility" class="form-select">
  <option
    v-for="option in POST_VISIBILITY"
    :key="option.key"
    :value="option.key"
  >
    {{ option.label }}
  </option>
</select>
```

El `v-model` guarda la `key`, por ejemplo `publico`.

## Uso en vistas

Para mostrar valores al usuario, usar helpers:

```vue
{{ getPostVisibilityLabel(post.visibility) }}
```

Evitar mostrar directamente campos catalogados si vienen de base de datos:

```vue
<!-- Evitar -->
{{ post.visibility }}
```

## Uso en consultas

Cuando los datos ya estan migrados, comparar contra keys:

```js
.eq('visibility', POST_VISIBILITY_KEYS.PUBLIC)
```

Cuando aun hay datos antiguos en base de datos, se puede usar una lista temporal:

```js
.in('visibility', POST_PUBLIC_VISIBILITY_VALUES)
```

Estas listas temporales deben retirarse cuando la base de datos quede normalizada.

## Migraciones de datos

Los catalogos no migran datos por si mismos. Si antes se guardaban labels como `Publico` o `Noticia`, se debe actualizar Supabase con SQL controlado.

Antes de migrar, revisar valores existentes:

```sql
select visibility, count(*)
from public.posts
group by visibility
order by visibility;
```

Luego convertir labels a keys canonicas:

```sql
update public.posts
set visibility = case
  when visibility in ('Oculto', 'oculto') then 'oculto'
  when visibility in ('Privado', 'privado') then 'privado'
  when visibility in ('Público', 'Publico', 'publico') then 'publico'
  else visibility
end
where visibility in ('Oculto', 'Privado', 'Público', 'Publico', 'oculto', 'privado', 'publico');
```

## Reglas para agentes IA y desarrolladores

- No agregar opciones de campos catalogados directamente en templates.
- No comparar contra labels visibles en logica de aplicacion.
- No guardar labels en Supabase cuando exista una `key`.
- Mantener las keys sin tildes ni espacios.
- Agregar nuevas opciones primero al catalogo y luego consumirlas desde las vistas.
- Usar helpers `normalize*` al cargar registros existentes en formularios.
- Usar helpers `get*Label` para mostrar valores en listados, previews y detalles.
- No cambiar la estructura de Supabase desde estos archivos.

## Ubicacion de nuevos catalogos

Si el catalogo pertenece a posts, agregarlo en:

```txt
src/constants/catalogs/posts.js
```

Si aparecen catalogos de otros modulos, crear archivos por modulo:

```txt
src/constants/catalogs/profiles.js
src/constants/catalogs/files.js
```

Y exportarlos desde:

```txt
src/constants/catalogs/index.js
```

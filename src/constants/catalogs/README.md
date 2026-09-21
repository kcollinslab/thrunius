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

## Cloudbook

El modulo usa `src/constants/catalogs/cloudbook.js`, exportado desde `index.js`.
Incluye areas, tipos y estados de preguntas, procedencias, tipos de recurso y
dificultades, con `*_KEYS`, opciones, `*_LABELS`, `normalize*` y `get*Label`.

Los normalizadores de Cloudbook devuelven `''` para valores desconocidos, salvo
que se indique un fallback. No se agregan listas temporales `*_VALUES` porque
no existen datos antiguos que requieran compatibilidad.

### Campos numericos y catalogos relacionales

- `cbk_preguntas.dificultad` guarda `1`, `2` o `3`, no el slug del catalogo.
  `CBK_DIFICULTADES` incluye `valor` para conservar ese contrato. Usar
  `getCbkDificultadValor` al guardar y `getCbkDificultadLabel` al mostrar.
- `cbk_preguntas.area_id` guarda un ID de catalogo relacional. `CBK_AREAS`
  define keys y labels de respaldo pero no asigna IDs. `cbk_areas` ya existe:
  obtener de Supabase `id`, `clave`, `nombre`, `descripcion`, `orden` y `activa`,
  vinculando `clave` con la key local. Usar los nombres y descripciones de la
  tabla como fuente principal; no asumir IDs fijos ni sobrescribirlos desde el
  catalogo local. `area_id` tiene una FK con `ON DELETE RESTRICT`.
  Para nuevos entrenamientos filtrar `activa=true`; las areas inactivas se
  conservan para consultar preguntas e historial. Solo administradores pueden
  crear o modificar areas; las claves son inmutables y no hay borrado desde el
  cliente. Agregar nuevas claves primero al catalogo y luego a la tabla.
- `tipo`, `estado`, `procedencia` y `tipo_recurso` guardan sus keys directamente.
  Para un recurso ausente, guardar `null`, no la etiqueta "Sin recurso".
- Que `publicada` aparezca en el catalogo no habilita la publicacion: sigue
  sujeta a las validaciones del servidor.

```js
import {
  CBK_PREGUNTA_ESTADO_KEYS,
  getCbkDificultadValor,
  getCbkDificultadLabel,
} from '@/constants/catalogs'

const estado = CBK_PREGUNTA_ESTADO_KEYS.BORRADOR
const dificultad = getCbkDificultadValor('facil') // 1
const etiqueta = getCbkDificultadLabel(1) // Fácil
```

### Opciones de preguntas

`cbk_pregunta_opciones` no requiere un catalogo adicional: `texto` es contenido,
`orden` es un entero positivo y `es_correcta` es booleano, no una key ni un label.
La edicion depende del estado de la pregunta: en Vue usar
`CBK_PREGUNTA_ESTADO_KEYS.BORRADOR`, nunca el label "Borrador". El servidor
impone la misma restriccion y solo admite `seleccion_unica`, consistente con
`CBK_PREGUNTA_TIPO_KEYS.SELECCION_UNICA`.

Las respuestas de practica deberan guardar el ID de la opcion, no su orden ni
una letra visible. No enviar `es_correcta` al cliente de practica. La tabla
permite como maximo una correcta; exigir al menos dos opciones y exactamente
una correcta sera parte del flujo de publicacion, aun bloqueado.

Ejecutar las pruebas sin dependencias adicionales:

```bash
node --test tests/catalogs/cloudbook.test.js
```

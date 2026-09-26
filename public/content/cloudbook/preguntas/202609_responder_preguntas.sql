-- Cloudbook: funciones seguras para practicar preguntas por área y grado.
-- Ejecutar después de importar las preguntas de Cloudbook.
-- Este script no inserta, actualiza ni elimina preguntas.
--
-- Para la primera prueba se permiten preguntas en estado "borrador" y
-- "publicada". Cuando finalice la validación editorial, cambia ambos filtros
-- a: q.estado = 'publicada'.

BEGIN;

-- Elimina las firmas anteriores, que tenían Inglés y grado 2 fijos.
DROP FUNCTION IF EXISTS public.cbk_obtener_pregunta_aleatoria(uuid);
DROP FUNCTION IF EXISTS public.cbk_calificar_respuesta(uuid, uuid);
DROP FUNCTION IF EXISTS privado.cbk_obtener_pregunta_aleatoria(uuid);
DROP FUNCTION IF EXISTS privado.cbk_calificar_respuesta(uuid, uuid);

CREATE FUNCTION privado.cbk_obtener_pregunta_aleatoria(
  p_area_clave text,
  p_grado smallint,
  p_excluir_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_pregunta jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para responder preguntas'
      USING ERRCODE = '42501';
  END IF;

  IF p_area_clave IS NULL OR p_grado IS NULL OR p_grado < 1 OR p_grado > 11 THEN
    RAISE EXCEPTION 'El área o el grado no son válidos'
      USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'id', q.id,
    'tema', q.tema,
    'competencia', q.competencia,
    'enunciado', q.enunciado,
    'contexto', q.contexto,
    'dificultad', q.dificultad,
    'estado', q.estado,
    'opciones', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('id', o.id, 'texto', o.texto, 'orden', o.orden)
          ORDER BY o.orden
        ),
        '[]'::jsonb
      )
      FROM public.cbk_pregunta_opciones AS o
      WHERE o.pregunta_id = q.id
    )
  )
  INTO v_pregunta
  FROM public.cbk_preguntas AS q
  INNER JOIN public.cbk_areas AS area ON area.id = q.area_id
  WHERE area.clave = p_area_clave
    AND area.activa IS TRUE
    AND q.grado = p_grado
    AND q.estado IN ('borrador', 'publicada')
    AND q.tipo = 'seleccion_unica'
    AND EXISTS (
      SELECT 1
      FROM public.cbk_pregunta_opciones AS opcion
      WHERE opcion.pregunta_id = q.id
    )
  ORDER BY (q.id = p_excluir_id), random()
  LIMIT 1;

  RETURN v_pregunta;
END;
$function$;

CREATE FUNCTION privado.cbk_calificar_respuesta(
  p_pregunta_id uuid,
  p_opcion_id uuid,
  p_area_clave text,
  p_grado smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_resultado jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para responder preguntas'
      USING ERRCODE = '42501';
  END IF;

  IF p_area_clave IS NULL OR p_grado IS NULL OR p_grado < 1 OR p_grado > 11 THEN
    RAISE EXCEPTION 'El área o el grado no son válidos'
      USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'correcta', o.es_correcta,
    'explicacion', q.explicacion
  )
  INTO v_resultado
  FROM public.cbk_preguntas AS q
  INNER JOIN public.cbk_areas AS area
    ON area.id = q.area_id
   AND area.clave = p_area_clave
   AND area.activa IS TRUE
  INNER JOIN public.cbk_pregunta_opciones AS o
    ON o.pregunta_id = q.id
   AND o.id = p_opcion_id
  WHERE q.id = p_pregunta_id
    AND q.grado = p_grado
    AND q.estado IN ('borrador', 'publicada')
    AND q.tipo = 'seleccion_unica';

  IF v_resultado IS NULL THEN
    RAISE EXCEPTION 'La pregunta o la opción seleccionada no es válida para el filtro elegido'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_resultado;
END;
$function$;

-- Las funciones del esquema public son los únicos endpoints expuestos por la API.
CREATE FUNCTION public.cbk_obtener_pregunta_aleatoria(
  p_area_clave text,
  p_grado smallint,
  p_excluir_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT privado.cbk_obtener_pregunta_aleatoria(p_area_clave, p_grado, p_excluir_id);
$function$;

CREATE FUNCTION public.cbk_calificar_respuesta(
  p_pregunta_id uuid,
  p_opcion_id uuid,
  p_area_clave text,
  p_grado smallint
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT privado.cbk_calificar_respuesta(
    p_pregunta_id,
    p_opcion_id,
    p_area_clave,
    p_grado
  );
$function$;

-- PostgreSQL concede EXECUTE a PUBLIC por defecto; se retira explícitamente.
REVOKE ALL ON FUNCTION privado.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION privado.cbk_calificar_respuesta(uuid, uuid, text, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid, text, smallint) FROM PUBLIC;

REVOKE ALL ON FUNCTION privado.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) FROM anon;
REVOKE ALL ON FUNCTION privado.cbk_calificar_respuesta(uuid, uuid, text, smallint) FROM anon;
REVOKE ALL ON FUNCTION public.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid, text, smallint) FROM anon;

GRANT USAGE ON SCHEMA privado TO authenticated;
GRANT EXECUTE ON FUNCTION privado.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION privado.cbk_calificar_respuesta(uuid, uuid, text, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid, text, smallint) TO authenticated;

COMMENT ON FUNCTION public.cbk_obtener_pregunta_aleatoria(text, smallint, uuid) IS
  'Entrega una pregunta aleatoria por área y grado sin revelar qué opción es correcta.';

COMMENT ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid, text, smallint) IS
  'Califica en el servidor una opción perteneciente a una pregunta del área y grado indicados.';

NOTIFY pgrst, 'reload schema';

COMMIT;

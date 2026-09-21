-- Cloudbook: funciones seguras para practicar preguntas.
--
-- Ejecutar después de importar 202609_preguntas_ingles.sql.
-- Este script no inserta, actualiza ni elimina preguntas.
--
-- Nota de la primera prueba:
-- Las preguntas importadas actualmente están en estado "borrador". Por eso las
-- funciones permiten temporalmente "borrador" y "publicada". Cuando finalice la
-- validación editorial, cambia ambos filtros a: q.estado = 'publicada'.
-- El area_id 5 (Inglés) fue verificado al preparar el banco y se limita a grado 2.

BEGIN;

CREATE OR REPLACE FUNCTION privado.cbk_obtener_pregunta_aleatoria(
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
          jsonb_build_object(
            'id', o.id,
            'texto', o.texto,
            'orden', o.orden
          )
          ORDER BY o.orden
        ),
        '[]'::jsonb
      )
      FROM public.cbk_pregunta_opciones AS o
      WHERE o.pregunta_id = q.id
    )
  )
  INTO v_pregunta
  FROM (
    SELECT pregunta.*
    FROM public.cbk_preguntas AS pregunta
    WHERE pregunta.estado IN ('borrador', 'publicada')
      AND pregunta.tipo = 'seleccion_unica'
      AND pregunta.area_id = 5
      AND pregunta.grado = 2
      AND EXISTS (
        SELECT 1
        FROM public.cbk_pregunta_opciones AS opcion
        WHERE opcion.pregunta_id = pregunta.id
      )
    ORDER BY (pregunta.id = p_excluir_id), random()
    LIMIT 1
  ) AS q;

  RETURN v_pregunta;
END;
$function$;

CREATE OR REPLACE FUNCTION privado.cbk_calificar_respuesta(
  p_pregunta_id uuid,
  p_opcion_id uuid
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

  SELECT jsonb_build_object(
    'correcta', o.es_correcta,
    'explicacion', q.explicacion
  )
  INTO v_resultado
  FROM public.cbk_preguntas AS q
  INNER JOIN public.cbk_pregunta_opciones AS o
    ON o.pregunta_id = q.id
  WHERE q.id = p_pregunta_id
    AND o.id = p_opcion_id
    AND q.estado IN ('borrador', 'publicada')
    AND q.tipo = 'seleccion_unica';

  IF v_resultado IS NULL THEN
    RAISE EXCEPTION 'La pregunta o la opción seleccionada no es válida'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_resultado;
END;
$function$;

-- Las funciones del esquema public son los únicos endpoints expuestos por la API.
CREATE OR REPLACE FUNCTION public.cbk_obtener_pregunta_aleatoria(
  p_excluir_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT privado.cbk_obtener_pregunta_aleatoria(p_excluir_id);
$function$;

CREATE OR REPLACE FUNCTION public.cbk_calificar_respuesta(
  p_pregunta_id uuid,
  p_opcion_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT privado.cbk_calificar_respuesta(p_pregunta_id, p_opcion_id);
$function$;

-- PostgreSQL concede EXECUTE a PUBLIC por defecto; se retira explícitamente.
REVOKE ALL ON FUNCTION privado.cbk_obtener_pregunta_aleatoria(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION privado.cbk_calificar_respuesta(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cbk_obtener_pregunta_aleatoria(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION privado.cbk_obtener_pregunta_aleatoria(uuid) FROM anon;
REVOKE ALL ON FUNCTION privado.cbk_calificar_respuesta(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cbk_obtener_pregunta_aleatoria(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid) FROM anon;

GRANT USAGE ON SCHEMA privado TO authenticated;
GRANT EXECUTE ON FUNCTION privado.cbk_obtener_pregunta_aleatoria(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION privado.cbk_calificar_respuesta(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cbk_obtener_pregunta_aleatoria(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.cbk_obtener_pregunta_aleatoria(uuid) IS
  'Entrega una pregunta aleatoria sin revelar qué opción es correcta.';

COMMENT ON FUNCTION public.cbk_calificar_respuesta(uuid, uuid) IS
  'Califica en el servidor una opción perteneciente a una pregunta.';

NOTIFY pgrst, 'reload schema';

COMMIT;

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../../../lib/supabase'
import { isTimeoutError, withTimeout } from '../../../lib/asyncTimeout'
import { CBK_AREAS, getCbkAreaLabel } from '../../../constants/catalogs/cloudbook'

const props = defineProps({
  area: { type: String, required: true },
  grado: { type: String, required: true },
})

const STORAGE_PREFIX = 'cloudbook:responder:progreso:v1:'
const REQUEST_TIMEOUT_MS = 10000
const EMPTY_PROGRESS = Object.freeze({ respondidas: 0, correctas: 0 })
const GRADOS = Array.from({ length: 11 }, (_, indice) => indice + 1)

const router = useRouter()
const toast = useToast()
const pregunta = ref(null)
const opcionSeleccionada = ref('')
const resultado = ref(null)
const progreso = ref({ ...EMPTY_PROGRESS })
const cargando = ref(true)
const enviando = ref(false)
const mensajeError = ref('')
const storageKey = ref('')
const usuarioId = ref('')

const areaLabel = computed(() => getCbkAreaLabel(props.area))
const gradoNumero = computed(() => Number(props.grado))

const puedeEnviar = computed(() => (
  Boolean(opcionSeleccionada.value)
  && !enviando.value
  && !resultado.value
))

const porcentajeAciertos = computed(() => {
  if (!progreso.value.respondidas) return 0
  return Math.round((progreso.value.correctas / progreso.value.respondidas) * 100)
})

const dificultad = computed(() => {
  const etiquetas = { 1: 'Fácil', 2: 'Intermedia', 3: 'Retadora' }
  return etiquetas[pregunta.value?.dificultad] || 'Sin nivel'
})

onMounted(inicializar)

watch(
  () => [props.area, props.grado],
  () => {
    if (!usuarioId.value) return
    prepararFiltro()
    void cargarPregunta()
  },
)

async function inicializar() {
  if (!hasSupabaseConfig || !supabase) {
    cargando.value = false
    mensajeError.value = 'La conexión con Supabase no está configurada.'
    return
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.getUser(),
      {
        timeout: REQUEST_TIMEOUT_MS,
        message: 'No fue posible validar la sesión a tiempo.',
      },
    )

    if (error) throw error
    if (!data?.user) throw new Error('Debes iniciar sesión para responder preguntas.')

    usuarioId.value = data.user.id
    prepararFiltro()
    await cargarPregunta()
  } catch (error) {
    cargando.value = false
    mensajeError.value = obtenerMensajeError(error)
  }
}

function prepararFiltro() {
  storageKey.value = `${STORAGE_PREFIX}${usuarioId.value}:${props.area}:${props.grado}`
  cargarProgreso()
}

function cambiarFiltro(campo, valor) {
  const area = campo === 'area' ? valor : props.area
  const grado = campo === 'grado' ? String(valor) : props.grado
  if (area === props.area && grado === props.grado) return
  router.push({ name: 'cloudbook-responder', params: { area, grado } })
}

function normalizarContador(valor) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 0 ? numero : 0
}

function cargarProgreso() {
  try {
    const guardado = JSON.parse(localStorage.getItem(storageKey.value) || '{}')
    const respondidas = normalizarContador(guardado.respondidas)
    const correctas = Math.min(normalizarContador(guardado.correctas), respondidas)
    progreso.value = { respondidas, correctas }
  } catch {
    progreso.value = { ...EMPTY_PROGRESS }
  }
}

function guardarProgreso() {
  if (!storageKey.value) return

  try {
    localStorage.setItem(storageKey.value, JSON.stringify(progreso.value))
  } catch {
    toast.warning('El navegador no permitió guardar el progreso.')
  }
}

function mezclarOpciones(opciones) {
  const mezcla = [...opciones]

  for (let indice = mezcla.length - 1; indice > 0; indice -= 1) {
    const posicion = Math.floor(Math.random() * (indice + 1))
    ;[mezcla[indice], mezcla[posicion]] = [mezcla[posicion], mezcla[indice]]
  }

  return mezcla
}

async function cargarPregunta() {
  const preguntaAnteriorId = pregunta.value?.id || null
  cargando.value = true
  mensajeError.value = ''
  resultado.value = null
  opcionSeleccionada.value = ''

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('cbk_obtener_pregunta_aleatoria', {
        p_area_clave: props.area,
        p_grado: gradoNumero.value,
        p_excluir_id: preguntaAnteriorId,
      }),
      {
        timeout: REQUEST_TIMEOUT_MS,
        message: 'La pregunta tardó demasiado en cargar.',
      },
    )

    if (error) throw error
    if (!data) {
      throw new Error(`No hay preguntas disponibles para ${areaLabel.value}, grado ${gradoNumero.value}.`)
    }
    if (!Array.isArray(data.opciones) || data.opciones.length < 2) {
      throw new Error('La pregunta recibida no tiene opciones suficientes.')
    }

    pregunta.value = {
      ...data,
      opciones: mezclarOpciones(data.opciones),
    }
  } catch (error) {
    pregunta.value = null
    mensajeError.value = obtenerMensajeError(error)
  } finally {
    cargando.value = false
  }
}

async function enviarRespuesta() {
  if (!puedeEnviar.value) return

  enviando.value = true
  mensajeError.value = ''

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('cbk_calificar_respuesta', {
        p_pregunta_id: pregunta.value.id,
        p_opcion_id: opcionSeleccionada.value,
        p_area_clave: props.area,
        p_grado: gradoNumero.value,
      }),
      {
        timeout: REQUEST_TIMEOUT_MS,
        message: 'La respuesta tardó demasiado en validarse.',
      },
    )

    if (error) throw error
    if (typeof data?.correcta !== 'boolean') {
      throw new Error('No fue posible validar la respuesta seleccionada.')
    }

    resultado.value = {
      correcta: data.correcta,
      explicacion: data.explicacion || '',
    }

    progreso.value = {
      respondidas: progreso.value.respondidas + 1,
      correctas: progreso.value.correctas + (data.correcta ? 1 : 0),
    }
    guardarProgreso()

    if (data.correcta) {
      toast.success('¡Respuesta correcta!')
    } else {
      toast.info('Respuesta incorrecta. Sigue practicando.')
    }
  } catch (error) {
    mensajeError.value = obtenerMensajeError(error)
  } finally {
    enviando.value = false
  }
}

function reiniciarContador() {
  progreso.value = { ...EMPTY_PROGRESS }

  if (storageKey.value) {
    try {
      localStorage.removeItem(storageKey.value)
    } catch {
      toast.warning('El navegador no permitió borrar el progreso guardado.')
      return
    }
  }

  toast.success('El contador se reinició.')
}

function claseOpcion(opcionId) {
  if (!resultado.value || opcionSeleccionada.value !== opcionId) return ''
  return resultado.value.correcta ? 'es-correcta' : 'es-incorrecta'
}

function obtenerMensajeError(error) {
  if (isTimeoutError(error)) return error.message

  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return 'Falta instalar las funciones SQL de Cloudbook para responder preguntas.'
  }

  return error?.message || 'Ocurrió un error al cargar la actividad.'
}
</script>

<template>
  <main class="responder-page py-3 py-lg-5">
    <div class="container-xl">
      <header class="page-header d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2 gap-lg-3 mb-3 mb-lg-4">
        <div>
          <span class="eyebrow">Práctica por área</span>
          <h1 class="page-title fw-bold mb-1">Preguntas de {{ areaLabel }} · Grado {{ gradoNumero }}</h1>
          <p class="page-subtitle text-secondary mb-0">Selecciona una opción y envía tu respuesta.</p>
        </div>

        <button
          type="button"
          class="btn btn-outline-secondary align-self-start align-self-lg-center"
          :disabled="cargando || enviando"
          @click="reiniciarContador"
        >
          <i class="bi bi-arrow-counterclockwise me-2" aria-hidden="true"></i>
          <span class="d-none d-sm-inline">Reiniciar contador</span>
          <span class="d-sm-none">Reiniciar</span>
        </button>
      </header>

      <section class="filter-card mb-3 mb-lg-4" aria-label="Elegir área y grado">
        <div class="row g-3">
          <div class="col-12 col-sm-7">
            <label class="form-label" for="responder-area">Área</label>
            <select
              id="responder-area"
              class="form-select"
              :value="area"
              :disabled="cargando || enviando"
              @change="cambiarFiltro('area', $event.target.value)"
            >
              <option v-for="opcion in CBK_AREAS" :key="opcion.key" :value="opcion.key">
                {{ opcion.label }}
              </option>
            </select>
          </div>
          <div class="col-12 col-sm-5">
            <label class="form-label" for="responder-grado">Grado</label>
            <select
              id="responder-grado"
              class="form-select"
              :value="grado"
              :disabled="cargando || enviando"
              @change="cambiarFiltro('grado', $event.target.value)"
            >
              <option v-for="opcion in GRADOS" :key="opcion" :value="opcion">
                {{ opcion }}° de primaria
              </option>
            </select>
          </div>
        </div>
      </section>

      <section class="row g-3 mb-4" aria-label="Progreso guardado en este navegador">
        <div class="col-4">
          <div class="stat-card">
            <span>Respondidas</span>
            <strong>{{ progreso.respondidas }}</strong>
          </div>
        </div>
        <div class="col-4">
          <div class="stat-card">
            <span>Correctas</span>
            <strong>{{ progreso.correctas }}</strong>
          </div>
        </div>
        <div class="col-4">
          <div class="stat-card">
            <span>Aciertos</span>
            <strong>{{ porcentajeAciertos }}%</strong>
          </div>
        </div>
      </section>

      <div v-if="cargando" class="question-card text-center" role="status" aria-live="polite">
        <div class="spinner-border text-primary mb-3" aria-hidden="true"></div>
        <p class="mb-0 text-secondary">Preparando una pregunta...</p>
      </div>

      <div v-else-if="mensajeError && !pregunta" class="alert alert-danger shadow-sm" role="alert">
        <h2 class="h6 fw-bold">No se pudo cargar la pregunta</h2>
        <p class="mb-3">{{ mensajeError }}</p>
        <button type="button" class="btn btn-danger" @click="cargarPregunta">
          Intentar de nuevo
        </button>
      </div>

      <article v-else-if="pregunta" class="question-card">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span class="badge text-bg-primary">{{ pregunta.tema }}</span>
          <span class="badge text-bg-light border">{{ dificultad }}</span>
          <span v-if="pregunta.estado === 'borrador'" class="badge text-bg-warning">Modo prueba</span>
        </div>

        <p v-if="pregunta.contexto" class="question-context mb-2">{{ pregunta.contexto }}</p>
        <h2 class="question-title">{{ pregunta.enunciado }}</h2>

        <form class="mt-4" @submit.prevent="enviarRespuesta">
          <fieldset :disabled="enviando || Boolean(resultado)">
            <legend class="visually-hidden">Opciones de respuesta</legend>

            <div class="d-grid gap-3">
              <label
                v-for="(opcion, indice) in pregunta.opciones"
                :key="opcion.id"
                class="answer-option"
                :class="[
                  claseOpcion(opcion.id),
                  { seleccionada: opcionSeleccionada === opcion.id },
                ]"
              >
                <input
                  v-model="opcionSeleccionada"
                  class="form-check-input"
                  type="radio"
                  name="respuesta"
                  :value="opcion.id"
                >
                <span class="option-letter" aria-hidden="true">
                  {{ String.fromCharCode(65 + indice) }}
                </span>
                <span>{{ opcion.texto }}</span>
              </label>
            </div>
          </fieldset>

          <div
            v-if="mensajeError"
            class="alert alert-danger mt-4 mb-0"
            role="alert"
          >
            {{ mensajeError }}
          </div>

          <div
            v-if="resultado"
            class="feedback mt-4"
            :class="resultado.correcta ? 'feedback-correcto' : 'feedback-incorrecto'"
            role="status"
            aria-live="polite"
          >
            <div class="d-flex gap-3">
              <i
                class="bi fs-4"
                :class="resultado.correcta ? 'bi-check-circle-fill' : 'bi-x-circle-fill'"
                aria-hidden="true"
              ></i>
              <div>
                <strong>{{ resultado.correcta ? '¡Correcto!' : 'Respuesta incorrecta' }}</strong>
                <p v-if="resultado.explicacion" class="mb-0 mt-1">{{ resultado.explicacion }}</p>
              </div>
            </div>
          </div>

          <div class="d-flex flex-column flex-sm-row gap-2 mt-4">
            <button
              v-if="!resultado"
              type="submit"
              class="btn btn-primary btn-lg"
              :disabled="!puedeEnviar"
            >
              <span
                v-if="enviando"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              {{ enviando ? 'Validando...' : 'Enviar respuesta' }}
            </button>

            <button
              v-else
              type="button"
              class="btn btn-primary btn-lg"
              @click="cargarPregunta"
            >
              Siguiente pregunta
              <i class="bi bi-arrow-right ms-2" aria-hidden="true"></i>
            </button>
          </div>
        </form>
      </article>
    </div>
  </main>
</template>

<style scoped>
.responder-page {
  min-height: 100%;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 90% 8%, rgba(13, 110, 253, 0.09), transparent 28rem),
    #f7f8fa;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 0.35rem;
  color: #0d6efd;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.page-title {
  color: #172033;
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1.2;
}

.page-subtitle {
  font-size: 0.92rem;
}

.stat-card,
.question-card,
.filter-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.stat-card {
  display: flex;
  min-height: 96px;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
}

.filter-card {
  padding: 1rem 1.25rem;
  border-radius: 1rem;
}

.filter-card .form-label {
  margin-bottom: 0.35rem;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 700;
}

.stat-card span {
  color: #6c757d;
  font-size: 0.78rem;
  font-weight: 650;
}

.stat-card strong {
  color: #172033;
  font-size: clamp(1.4rem, 4vw, 2rem);
  line-height: 1.1;
}

.question-card {
  max-width: 900px;
  margin-inline: auto;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  border-radius: 1.25rem;
}

.question-context {
  color: #64748b;
  font-size: 0.95rem;
}

.question-title {
  margin-bottom: 0;
  color: #172033;
  font-size: clamp(1.35rem, 3vw, 2rem);
  font-weight: 750;
  line-height: 1.3;
}

.answer-option {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border: 2px solid #e4e8ee;
  border-radius: 0.85rem;
  background: #ffffff;
  color: #273244;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.answer-option:hover {
  border-color: #9ec5fe;
  background: #f7fbff;
  transform: translateY(-1px);
}

.answer-option.seleccionada {
  border-color: #0d6efd;
  background: #eef5ff;
}

.answer-option.es-correcta {
  border-color: #198754;
  background: #eaf7f0;
}

.answer-option.es-incorrecta {
  border-color: #dc3545;
  background: #fff0f1;
}

.answer-option .form-check-input {
  flex: 0 0 auto;
  margin: 0;
}

.option-letter {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #eef1f5;
  color: #4b5563;
  font-size: 0.82rem;
  font-weight: 800;
}

.feedback {
  padding: 1rem;
  border-radius: 0.85rem;
}

.feedback-correcto {
  background: #eaf7f0;
  color: #146c43;
}

.feedback-incorrecto {
  background: #fff0f1;
  color: #b02a37;
}

@media (max-width: 575.98px) {
  .responder-page {
    padding-inline: 0.35rem;
  }

  .page-header {
    gap: 0.55rem !important;
  }

  .eyebrow {
    margin-bottom: 0.2rem;
    font-size: 0.68rem;
  }

  .page-title {
    font-size: 1.35rem;
  }

  .page-subtitle {
    font-size: 0.82rem;
  }

  .page-header > button {
    min-height: 44px;
  }

  .stat-card {
    min-height: 82px;
    padding: 0.65rem 0.35rem;
    text-align: center;
  }

  .filter-card {
    padding: 0.85rem;
    border-radius: 0.9rem;
  }

  .stat-card span {
    font-size: 0.68rem;
  }

  .stat-card strong {
    font-size: 1.35rem;
  }

  .question-card {
    padding: 1rem;
    border-radius: 0.9rem;
  }

  .question-context {
    font-size: 0.84rem;
  }

  .question-title {
    font-size: 1.2rem;
  }

  .answer-option {
    gap: 0.65rem;
    min-height: 58px;
    padding: 0.75rem;
    font-size: 0.93rem;
  }

  .option-letter {
    width: 30px;
    height: 30px;
    flex-basis: 30px;
    font-size: 0.76rem;
  }

  .feedback {
    padding: 0.85rem;
    font-size: 0.9rem;
  }

  .btn-lg {
    --bs-btn-padding-y: 0.65rem;
    font-size: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .answer-option {
    transition: none;
  }
}
</style>

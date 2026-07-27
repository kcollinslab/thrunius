<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import DOMPurify from 'dompurify'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { withTimeout, isTimeoutError } from '../../lib/asyncTimeout'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const POST_EDITOR_ROLES = ['admin', 'editor']
const SAVE_TIMEOUT_MS = 15000

const post = ref(null)
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const feedback = ref({ type: '', message: '' })
const editorHtml = ref('')
const originalHtml = ref('')
const currentUserId = ref('')

const postId = computed(() => String(route.params.id || '').trim())
const editorText = computed(() => stripHtml(editorHtml.value).trim())
const wordCount = computed(() => editorText.value ? editorText.value.split(/\s+/).filter(Boolean).length : 0)
const characterCount = computed(() => editorText.value.length)
const hasChanges = computed(() => normalizeHtml(editorHtml.value) !== normalizeHtml(originalHtml.value))
const saveButtonLabel = computed(() => saving.value ? 'Guardando...' : 'Guardar contenido')
const previewRoute = computed(() => postId.value ? `/posts/preview/${postId.value}` : '/posts')
const editRoute = computed(() => postId.value ? `/posts/edit/${postId.value}` : '/posts')

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [2, 3, 4],
      },
    }),
    Link.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
  ],
  editorProps: {
    attributes: {
      class: 'editor-surface',
      spellcheck: 'true',
    },
  },
  onUpdate: ({ editor }) => {
    editorHtml.value = editor.getHTML()
  },
})

onMounted(async () => {
  await fetchPost()
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

async function fetchPost() {
  loading.value = true
  loadError.value = ''
  feedback.value = { type: '', message: '' }

  if (!hasSupabaseConfig || !supabase) {
    loadError.value = 'Supabase no está configurado en esta aplicación.'
    loading.value = false
    return
  }

  if (!postId.value) {
    loadError.value = 'No se encontró el ID de la publicación.'
    loading.value = false
    return
  }

  try {
    await assertEditorPermission()

    const abortController = new AbortController()
    const { data, error } = await withTimeout(
      supabase
        .from('posts')
        .select('id, title, subtitle, slug, content, updated_at')
        .eq('id', postId.value)
        .maybeSingle()
        .abortSignal(abortController.signal),
      {
        timeout: SAVE_TIMEOUT_MS,
        message: 'No se pudo cargar la publicación a tiempo.',
        onTimeout: () => abortController.abort(),
      },
    )

    if (error) throw error

    if (!data) {
      loadError.value = 'No se encontró la publicación o no tienes permiso para editarla.'
      return
    }

    post.value = data
    originalHtml.value = data.content || ''
    editorHtml.value = data.content || ''
    editor.value?.commands.setContent(data.content || '', false)
  } catch (error) {
    console.error('Error loading post content editor:', error)
    loadError.value = getLoadErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function assertEditorPermission() {
  const { data: sessionData, error: sessionError } = await withTimeout(
    supabase.auth.getSession(),
    {
      timeout: SAVE_TIMEOUT_MS,
      message: 'No se pudo validar la sesión a tiempo.',
    },
  )

  if (sessionError) throw sessionError

  const session = sessionData?.session
  if (!session?.user) {
    router.push('/login')
    throw new Error('AUTH_REQUIRED')
  }

  const abortController = new AbortController()
  const { data: profile, error: profileError } = await withTimeout(
    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .abortSignal(abortController.signal),
    {
      timeout: SAVE_TIMEOUT_MS,
      message: 'No se pudo validar el rol a tiempo.',
      onTimeout: () => abortController.abort(),
    },
  )

  const role = String(profile?.role || '').trim().toLowerCase()
  if (profileError || !POST_EDITOR_ROLES.includes(role)) {
    throw new Error('EDITOR_REQUIRED')
  }

  currentUserId.value = session.user.id
}

async function handleSaveContent() {
  if (saving.value || !editor.value) return

  saving.value = true
  feedback.value = { type: '', message: '' }

  try {
    await assertEditorPermission()

    const sanitizedContent = sanitizeHtml(editor.value.getHTML())
    const abortController = new AbortController()
    const { data, error } = await withTimeout(
      supabase
        .from('posts')
        .update({
          content: sanitizedContent,
          editor_id: currentUserId.value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId.value)
        .select('id, updated_at')
        .maybeSingle()
        .abortSignal(abortController.signal),
      {
        timeout: SAVE_TIMEOUT_MS,
        message: 'La actualización tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
        onTimeout: () => abortController.abort(),
      },
    )

    if (error) throw error
    if (!data?.id) throw new Error('No se actualizó ninguna publicación.')

    originalHtml.value = sanitizedContent
    editorHtml.value = sanitizedContent
    post.value = {
      ...post.value,
      content: sanitizedContent,
      updated_at: data.updated_at,
    }

    editor.value.commands.setContent(sanitizedContent, false)
    toast.success('Contenido actualizado correctamente.')
    feedback.value = { type: 'success', message: 'Contenido guardado correctamente.' }
  } catch (error) {
    console.error('Error updating post content:', error)
    feedback.value = {
      type: 'danger',
      message: getUpdateErrorMessage(error),
    }
  } finally {
    saving.value = false
  }
}

function sanitizeHtml(value) {
  return DOMPurify.sanitize(String(value || ''), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
  })
}

function normalizeHtml(value) {
  const sanitizedValue = sanitizeHtml(value)
  return sanitizedValue === '<p></p>' ? '' : sanitizedValue.trim()
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ')
}

function runCommand(command) {
  if (!editor.value || saving.value) return
  command(editor.value.chain().focus()).run()
}

function isActive(name, attributes) {
  return Boolean(editor.value?.isActive(name, attributes))
}

function setLink() {
  if (!editor.value || saving.value) return

  const currentHref = editor.value.getAttributes('link').href || ''
  const url = window.prompt('URL del enlace', currentHref)
  if (url === null) return

  if (!url.trim()) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

function getLoadErrorMessage(error) {
  if (error?.message === 'AUTH_REQUIRED') return 'Tu sesión terminó. Inicia sesión nuevamente.'
  if (error?.message === 'EDITOR_REQUIRED') return 'No tienes permisos para editar el contenido de publicaciones.'
  if (isTimeoutError(error)) return 'La carga tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'

  return error?.message || 'No se pudo cargar el editor de contenido.'
}

function getUpdateErrorMessage(error) {
  if (error?.message === 'AUTH_REQUIRED') return 'Tu sesión terminó. Inicia sesión nuevamente.'
  if (error?.message === 'EDITOR_REQUIRED') return 'No tienes permisos para editar el contenido de publicaciones.'
  if (isTimeoutError(error)) return 'La actualización tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'

  return error?.message || 'No se pudo guardar el contenido.'
}

function formatDate(value) {
  if (!value) return 'Sin guardar'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin guardar'

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<template>
  <main class="container-fluid py-3 edit-content-view">
    <div class="row justify-content-center">
      <div class="col-12 col-xxl-10">
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-dark" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="text-muted small mt-3 mb-0">Cargando editor...</p>
        </div>

        <section v-else-if="loadError" class="edit-state-card text-center">
          <i class="bi bi-file-earmark-x" aria-hidden="true"></i>
          <h1 class="h5 mb-2">No se pudo abrir el editor</h1>
          <p class="text-muted mb-4">{{ loadError }}</p>
          <div class="d-flex flex-column flex-sm-row justify-content-center gap-2">
            <button type="button" class="btn btn-dark px-4" @click="fetchPost">
              Reintentar
            </button>
            <router-link to="/posts" class="btn btn-light border px-4">
              Volver a publicaciones
            </router-link>
          </div>
        </section>

        <template v-else-if="post">
          <section class="content-editor-card">
            <div class="editor-topbar">
              <div>
                <p class="section-kicker mb-1">Cuerpo de la publicación</p>
                <h1 class="section-title mb-1">{{ post.title || 'Publicación sin título' }}</h1>
                <p class="text-muted small mb-0">
                  {{ wordCount }} palabras · {{ characterCount }} caracteres · Actualizado {{ formatDate(post.updated_at) }}
                </p>
              </div>

              <div class="d-flex flex-wrap gap-2">
                <router-link :to="editRoute" class="btn btn-light border editor-link">
                  <i class="bi bi-pencil me-2" aria-hidden="true"></i>
                  Datos
                </router-link>
                <router-link :to="previewRoute" class="btn btn-light border editor-link">
                  <i class="bi bi-eye me-2" aria-hidden="true"></i>
                  Vista previa
                </router-link>
              </div>
            </div>

            <div
              v-if="feedback.message"
              class="alert alert-dismissible fade show d-flex align-items-start gap-2 m-3 mb-0"
              :class="`alert-${feedback.type}`"
              role="alert"
            >
              <i
                class="bi flex-shrink-0 mt-1"
                :class="feedback.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"
                aria-hidden="true"
              ></i>
              <div>{{ feedback.message }}</div>
              <button
                type="button"
                class="btn-close"
                aria-label="Cerrar mensaje"
                @click="feedback.message = ''"
              ></button>
            </div>

            <div class="editor-toolbar" aria-label="Herramientas de edición">
              <div class="toolbar-group">
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('paragraph') }"
                  title="Párrafo"
                  aria-label="Párrafo"
                  @click="runCommand(chain => chain.setParagraph())"
                >
                  <i class="bi bi-text-paragraph" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('heading', { level: 2 }) }"
                  title="Título H2"
                  aria-label="Título H2"
                  @click="runCommand(chain => chain.toggleHeading({ level: 2 }))"
                >
                  H2
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('heading', { level: 3 }) }"
                  title="Título H3"
                  aria-label="Título H3"
                  @click="runCommand(chain => chain.toggleHeading({ level: 3 }))"
                >
                  H3
                </button>
              </div>

              <div class="toolbar-group">
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('bold') }"
                  title="Negrita"
                  aria-label="Negrita"
                  @click="runCommand(chain => chain.toggleBold())"
                >
                  <i class="bi bi-type-bold" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('italic') }"
                  title="Cursiva"
                  aria-label="Cursiva"
                  @click="runCommand(chain => chain.toggleItalic())"
                >
                  <i class="bi bi-type-italic" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('strike') }"
                  title="Tachado"
                  aria-label="Tachado"
                  @click="runCommand(chain => chain.toggleStrike())"
                >
                  <i class="bi bi-type-strikethrough" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('link') }"
                  title="Enlace"
                  aria-label="Enlace"
                  @click="setLink"
                >
                  <i class="bi bi-link-45deg" aria-hidden="true"></i>
                </button>
              </div>

              <div class="toolbar-group">
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('bulletList') }"
                  title="Lista con viñetas"
                  aria-label="Lista con viñetas"
                  @click="runCommand(chain => chain.toggleBulletList())"
                >
                  <i class="bi bi-list-ul" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('orderedList') }"
                  title="Lista numerada"
                  aria-label="Lista numerada"
                  @click="runCommand(chain => chain.toggleOrderedList())"
                >
                  <i class="bi bi-list-ol" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  :class="{ active: isActive('blockquote') }"
                  title="Cita"
                  aria-label="Cita"
                  @click="runCommand(chain => chain.toggleBlockquote())"
                >
                  <i class="bi bi-quote" aria-hidden="true"></i>
                </button>
              </div>

              <div class="toolbar-group ms-lg-auto">
                <button
                  type="button"
                  class="tool-button"
                  title="Deshacer"
                  aria-label="Deshacer"
                  @click="runCommand(chain => chain.undo())"
                >
                  <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="tool-button"
                  title="Rehacer"
                  aria-label="Rehacer"
                  @click="runCommand(chain => chain.redo())"
                >
                  <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <EditorContent :editor="editor" class="editor-frame" />

            <div class="editor-actions">
              <span class="change-state" :class="{ 'has-changes': hasChanges }">
                {{ hasChanges ? 'Cambios sin guardar' : 'Todo guardado' }}
              </span>

              <div class="action-stack">
                <button
                  type="button"
                  class="btn btn-dark px-4"
                  :disabled="saving || !hasChanges"
                  @click="handleSaveContent"
                >
                  <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                  {{ saveButtonLabel }}
                </button>
                <router-link to="/posts" class="btn btn-light border px-4">
                  Cancelar
                </router-link>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped>
.edit-content-view {
  min-height: calc(100vh - 4rem);
}

.content-editor-card,
.edit-state-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 0.5rem 1.5rem rgba(17, 24, 39, 0.06);
}

.edit-state-card {
  padding: clamp(2rem, 6vw, 4rem) 1.25rem;
}

.edit-state-card > i {
  display: block;
  margin-bottom: 1rem;
  color: #9ca3af;
  font-size: 2.5rem;
}

.editor-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.section-kicker {
  color: #6c757d;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.section-title {
  color: #111827;
  font-size: 1rem;
  font-weight: 700;
}

.editor-link,
.btn,
.tool-button {
  border-radius: 0.5em;
}

.editor-link,
.editor-actions .btn {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  min-height: 44px;
}

.editor-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.96);
}

.toolbar-group {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid #d7dce1;
  border-radius: 0.5rem;
  background: #ffffff;
}

.tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: 0;
  background: #ffffff;
  color: #343a40;
  font-size: 0.86rem;
  font-weight: 800;
}

.tool-button + .tool-button {
  border-left: 1px solid #d7dce1;
}

.tool-button:hover {
  background: #f8f9fa;
}

.tool-button.active {
  background: #111827;
  color: #ffffff;
}

.editor-frame {
  background: #ffffff;
}

.editor-frame :deep(.editor-surface) {
  min-height: min(62vh, 720px);
  padding: clamp(1rem, 3vw, 2rem);
  color: #303030;
  font-size: 1.05rem;
  line-height: 1.85;
  outline: 0;
}

.editor-frame :deep(.editor-surface p) {
  margin: 0 0 1.25rem;
}

.editor-frame :deep(.editor-surface h2),
.editor-frame :deep(.editor-surface h3),
.editor-frame :deep(.editor-surface h4) {
  margin: 2rem 0 0.8rem;
  color: #111111;
  font-weight: 800;
  line-height: 1.25;
}

.editor-frame :deep(.editor-surface ul),
.editor-frame :deep(.editor-surface ol) {
  margin: 0 0 1.25rem;
  padding-left: 1.5rem;
}

.editor-frame :deep(.editor-surface blockquote) {
  margin: 1.5rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid #111111;
  background: #f8f9fa;
  color: #4f4f4f;
}

.editor-frame :deep(.editor-surface a) {
  color: #111111;
  font-weight: 700;
}

.editor-frame :deep(.editor-surface:focus) {
  box-shadow: inset 0 0 0 2px rgba(33, 37, 41, 0.12);
}

.editor-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -0.5rem 1rem rgba(255, 255, 255, 0.9);
}

.change-state {
  color: #6c757d;
  font-size: 0.8rem;
  font-weight: 700;
}

.change-state.has-changes {
  color: #8a5a00;
}

.action-stack {
  display: flex;
  gap: 0.75rem;
  width: min(100%, 24rem);
}

.action-stack .btn {
  flex: 1 1 0;
}

@media (max-width: 767.98px) {
  .editor-topbar,
  .editor-actions {
    flex-direction: column;
  }

  .editor-topbar > div,
  .editor-actions > * {
    width: 100%;
  }

  .action-stack {
    width: 100%;
  }
}

@media (max-width: 575.98px) {
  .editor-toolbar {
    align-items: stretch;
  }

  .toolbar-group {
    flex: 1 1 auto;
  }

  .tool-button {
    flex: 1 1 0;
  }
}
</style>

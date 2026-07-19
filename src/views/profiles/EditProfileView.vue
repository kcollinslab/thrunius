<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const ALLOWED_GENDERS = ['', 'Hombre', 'Mujer', 'Otro', 'Prefiero no decirlo']
const ALLOWED_ROLES = ['subscriber', 'editor', 'admin']
const EMPTY_FORM = {
  full_name: '',
  about: '',
  birth_date: '',
  gender: '',
  role: 'subscriber',
}

const loading = ref(true)
const saveLoading = ref(false)
const loadError = ref('')
const validationError = ref('')
const currentUserId = ref('')
const initialForm = ref({ ...EMPTY_FORM })
const form = ref({ ...EMPTY_FORM })
const didSave = ref(false)

const profileId = computed(() => String(route.params.id || ''))
const isOwnProfile = computed(() => profileId.value === currentUserId.value)
const today = new Date()
const maxBirthDate = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-')
const hasChanges = computed(() =>
  JSON.stringify(normalizeForm(form.value)) !== JSON.stringify(initialForm.value),
)

function normalizeForm(values) {
  return {
    full_name: values.full_name.trim(),
    about: values.about.trim(),
    birth_date: values.birth_date || '',
    gender: values.gender || '',
    role: values.role || 'subscriber',
  }
}

function validateForm() {
  const values = normalizeForm(form.value)

  if (!values.full_name) return 'El nombre completo es obligatorio.'
  if (values.full_name.length > 120) return 'El nombre no puede superar los 120 caracteres.'
  if (values.about.length > 500) return 'La descripción no puede superar los 500 caracteres.'
  if (!ALLOWED_GENDERS.includes(values.gender)) return 'Selecciona un género válido.'
  if (!ALLOWED_ROLES.includes(values.role)) return 'Selecciona un rol válido.'
  if (values.birth_date && values.birth_date > maxBirthDate) {
    return 'La fecha de nacimiento no puede estar en el futuro.'
  }

  return ''
}

async function getAuthenticatedAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')

  const { data: adminProfile, error: roleError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (roleError || String(adminProfile?.role || '').trim().toLowerCase() !== 'admin') {
    throw new Error('ADMIN_REQUIRED')
  }

  return userData.user
}

async function fetchProfile() {
  loading.value = true
  loadError.value = ''

  try {
    if (!profileId.value) throw new Error('PROFILE_NOT_FOUND')

    const user = await getAuthenticatedAdmin()
    currentUserId.value = user.id

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, about, birth_date, gender, role')
      .eq('id', profileId.value)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('PROFILE_NOT_FOUND')

    const loadedForm = normalizeForm({
      full_name: data.full_name || '',
      about: data.about || '',
      birth_date: data.birth_date || '',
      gender: ALLOWED_GENDERS.includes(data.gender) ? data.gender : '',
      role: ALLOWED_ROLES.includes(data.role) ? data.role : 'subscriber',
    })

    form.value = { ...loadedForm }
    initialForm.value = { ...loadedForm }
  } catch (error) {
    console.error('Error al cargar el perfil:', error)

    if (error.message === 'AUTH_REQUIRED') {
      await router.replace({ name: 'login' })
      return
    }

    if (error.message === 'ADMIN_REQUIRED') {
      toast.error('No tienes permisos para editar perfiles.')
      await router.replace({ name: 'profile' })
      return
    }

    loadError.value = error.message === 'PROFILE_NOT_FOUND'
      ? 'El perfil solicitado no existe o ya no está disponible.'
      : 'No se pudo cargar el perfil. Comprueba tu conexión e inténtalo de nuevo.'
  } finally {
    loading.value = false
  }
}

async function handleUpdateProfile() {
  validationError.value = validateForm()
  if (validationError.value) return
  if (!hasChanges.value || saveLoading.value) return

  saveLoading.value = true

  try {
    const user = await getAuthenticatedAdmin()
    const values = normalizeForm(form.value)
    const updatePayload = {
      full_name: values.full_name,
      about: values.about || null,
      birth_date: values.birth_date || null,
      gender: values.gender || null,
      updated_at: new Date().toISOString(),
    }

    // Un administrador no puede modificar su propio rol desde esta pantalla.
    if (user.id !== profileId.value) updatePayload.role = values.role

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileId.value)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('PROFILE_NOT_FOUND')

    didSave.value = true
    initialForm.value = normalizeForm(form.value)
    toast.success('Perfil actualizado correctamente.')
    await router.push({ name: 'profiles' })
  } catch (error) {
    console.error('Error al actualizar el perfil:', error)
    const message = error.message === 'ADMIN_REQUIRED'
      ? 'Tu sesión ya no tiene permisos para editar perfiles.'
      : error.message === 'AUTH_REQUIRED'
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : error.message === 'PROFILE_NOT_FOUND'
          ? 'El perfil ya no existe o no tienes permiso para modificarlo.'
          : 'No se pudo actualizar el perfil. Inténtalo de nuevo.'
    toast.error(message)
  } finally {
    saveLoading.value = false
  }
}

function handleBeforeUnload(event) {
  if (!hasChanges.value || didSave.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(() => {
  if (!hasChanges.value || didSave.value) return true
  return window.confirm('Tienes cambios sin guardar. ¿Quieres salir de todos modos?')
})

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  fetchProfile()
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))
</script>

<template>
  <main class="container-fluid edit-profile-page py-3">
    <div class="mx-auto edit-profile-shell">
      <div v-if="loading" class="profile-state-card text-center" aria-live="polite">
        <div class="spinner-border text-dark" role="status">
          <span class="visually-hidden">Cargando perfil...</span>
        </div>
      </div>

      <section v-else-if="loadError" class="profile-state-card text-center" role="alert">
        <i class="bi bi-person-x fs-2 text-danger" aria-hidden="true"></i>
        <h1 class="h5 fw-bold mt-2">No se pudo abrir el perfil</h1>
        <p class="text-muted mb-3">{{ loadError }}</p>
        <div class="d-flex flex-wrap justify-content-center gap-2">
          <button type="button" class="btn btn-dark action-button" @click="fetchProfile">
            <i class="bi bi-arrow-clockwise me-2"></i>Reintentar
          </button>
          <router-link :to="{ name: 'profiles' }" class="btn btn-outline-secondary action-button">
            Volver
          </router-link>
        </div>
      </section>

      <template v-else>
        <form novalidate @submit.prevent="handleUpdateProfile">
          <div class="card border-0 shadow-sm profile-card">
            <div class="card-header profile-header d-flex align-items-center justify-content-between gap-3">
              <h1 class="h5 fw-bold mb-0">Editar perfil</h1>
              <span v-if="hasChanges" class="unsaved-label">
                <i class="bi bi-circle-fill me-1"></i>Sin guardar
              </span>
            </div>

            <div class="card-body p-3 p-md-4">
              <div v-if="validationError" class="alert alert-danger d-flex align-items-center py-2 mb-3" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2" aria-hidden="true"></i>
                <div>{{ validationError }}</div>
                <button
                  type="button"
                  class="btn-close ms-auto"
                  aria-label="Cerrar mensaje"
                  @click="validationError = ''"
                ></button>
              </div>

              <div class="row g-3">
                <div class="col-12">
                  <label for="full-name" class="form-label">Nombre completo</label>
                  <input
                    id="full-name"
                    v-model="form.full_name"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': validationError && !form.full_name.trim() }"
                    maxlength="120"
                    autocomplete="name"
                    placeholder="Nombre y apellidos"
                    required
                    @input="validationError = ''"
                  >
                </div>

                <div class="col-md-6">
                  <label for="user-role" class="form-label">Rol</label>
                  <select id="user-role" v-model="form.role" class="form-select" :disabled="isOwnProfile">
                    <option value="subscriber">Suscriptor</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <div v-if="isOwnProfile" class="form-text">No puedes cambiar tu propio rol.</div>
                </div>

                <div class="col-md-6">
                  <label for="gender" class="form-label">Género</label>
                  <select id="gender" v-model="form.gender" class="form-select">
                    <option value="">Sin especificar</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Otro">Otro</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>

                <div class="col-md-6">
                  <label for="birth-date" class="form-label">Fecha de nacimiento</label>
                  <input
                    id="birth-date"
                    v-model="form.birth_date"
                    type="date"
                    class="form-control"
                    :max="maxBirthDate"
                  >
                </div>

                <div class="col-12">
                  <div class="d-flex justify-content-between gap-3">
                    <label for="about" class="form-label">Acerca de</label>
                    <span class="character-count">{{ form.about.length }}/500</span>
                  </div>
                  <textarea
                    id="about"
                    v-model="form.about"
                    class="form-control"
                    rows="3"
                    maxlength="500"
                    placeholder="Breve descripción..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="card-footer profile-actions d-flex flex-column-reverse flex-sm-row justify-content-end gap-2 p-3">
              <router-link :to="{ name: 'profiles' }" class="btn btn-light border action-button px-4">
                Cancelar
              </router-link>
              <button type="submit" class="btn btn-dark action-button px-4" :disabled="saveLoading || !hasChanges">
                <span v-if="saveLoading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                <i v-else class="bi bi-check2 me-2" aria-hidden="true"></i>
                {{ saveLoading ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            </div>
          </div>
        </form>
      </template>
    </div>
  </main>
</template>

<style scoped>
.edit-profile-page {
  color: #202124;
}

.edit-profile-shell {
  max-width: 760px;
}

.profile-card,
.profile-state-card {
  border-radius: 0.75rem;
}

.profile-state-card {
  background: #fff;
  border: 1px solid #e9ecef;
  padding: 3rem 1.5rem;
}

.profile-header {
  background: #fff;
  border-bottom: 1px solid #e9ecef;
  padding: 1rem 1.25rem;
}

.unsaved-label {
  color: #8a6100;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.unsaved-label .bi {
  font-size: 0.45rem;
}

.form-label {
  color: #343a40;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.form-control,
.form-select {
  border-color: #ced4da;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  height: 2.5rem;
}

textarea.form-control {
  height: auto;
  min-height: 5.5rem;
  resize: vertical;
}

.form-control:focus,
.form-select:focus {
  border-color: #495057;
  box-shadow: 0 0 0 0.18rem rgba(33, 37, 41, 0.08);
}

.form-text,
.character-count {
  color: #7a828a;
  font-size: 0.75rem;
}

.profile-actions {
  background: #fafafa;
  border-top: 1px solid #e9ecef;
}

.action-button {
  align-items: center;
  border-radius: 0.5rem;
  display: inline-flex;
  font-size: 0.9rem;
  font-weight: 600;
  height: 2.5rem;
  justify-content: center;
}

@media (max-width: 575.98px) {
  .profile-actions .btn {
    width: 100%;
  }
}
</style>

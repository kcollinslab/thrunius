<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const toast = useToast()

function createEmptyProfile() {
  return {
    full_name: '',
    about: '',
    birth_date: '',
    gender: '',
    role: 'subscriber',
    updated_at: null,
  }
}

const user = ref(null)
const profile = ref(createEmptyProfile())
const originalProfile = ref(null)
const loading = ref(true)
const loadError = ref('')
const isEditing = ref(false)
const updateLoading = ref(false)

const ROLE_LABELS = {
  admin: { label: 'Administrador', class: 'role-admin' },
  editor: { label: 'Editor', class: 'role-editor' },
  subscriber: { label: 'Suscriptor', class: 'role-subscriber' },
}

const displayName = computed(() => profile.value.full_name?.trim() || 'Usuario de Thrunius')

const userInitials = computed(() => {
  const initials = displayName.value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')

  return initials.toUpperCase() || 'U'
})

const aboutLength = computed(() => profile.value.about?.length || 0)

function getRoleBadge(role) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  return ROLE_LABELS[normalizedRole] || { label: 'Sin rol', class: 'role-default' }
}

function formatBirthDate(dateValue) {
  if (!dateValue) return 'No especificada'

  const [year, month, day] = String(dateValue).split('-').map(Number)

  if (!year || !month || !day) return dateValue

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

async function loadProfile() {
  loading.value = true
  loadError.value = ''

  if (!supabase) {
    loadError.value = 'Supabase no está configurado en esta aplicación.'
    loading.value = false
    return
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const authenticatedUser = userData?.user

    if (userError) throw userError

    if (!authenticatedUser) {
      await router.replace({ name: 'login' })
      return
    }

    user.value = authenticatedUser

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, about, birth_date, gender, role, updated_at')
      .eq('id', authenticatedUser.id)
      .single()

    if (profileError) throw profileError

    profile.value = {
      ...createEmptyProfile(),
      ...data,
      about: data?.about || '',
      birth_date: data?.birth_date || '',
      gender: data?.gender || '',
    }
  } catch (error) {
    console.error('[ProfileView] No se pudo cargar el perfil:', error)
    loadError.value = 'No pudimos cargar tu perfil. Intenta nuevamente.'
  } finally {
    loading.value = false
  }
}

function startEditing() {
  originalProfile.value = { ...profile.value }
  isEditing.value = true
}

function cancelEditing() {
  if (originalProfile.value) {
    profile.value = { ...originalProfile.value }
  }

  isEditing.value = false
  originalProfile.value = null
}

async function handleUpdateProfile() {
  const fullName = profile.value.full_name?.trim()

  if (!fullName) {
    toast.warning('El nombre completo es obligatorio.')
    return
  }

  updateLoading.value = true

  try {
    if (!supabase || !user.value?.id) {
      throw new Error('No se encontró una sesión válida para actualizar el perfil.')
    }

    const payload = {
      full_name: fullName,
      about: profile.value.about?.trim() || null,
      birth_date: profile.value.birth_date || null,
      gender: profile.value.gender || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.value.id)
      .select('full_name, about, birth_date, gender, role, updated_at')
      .single()

    if (profileError) throw profileError

    profile.value = {
      ...profile.value,
      ...data,
      about: data?.about || '',
      birth_date: data?.birth_date || '',
      gender: data?.gender || '',
    }

    const { error: authMetadataError } = await supabase.auth.updateUser({
      data: {
        display_name: fullName,
        full_name: fullName,
      },
    })

    if (authMetadataError) {
      console.warn('[ProfileView] El perfil se guardó, pero no se sincronizó Auth:', authMetadataError)
    }

    originalProfile.value = null
    isEditing.value = false
    toast.success('Perfil actualizado correctamente.')
  } catch (error) {
    console.error('[ProfileView] Error al actualizar el perfil:', error)
    toast.error(error.message || 'No se pudo actualizar el perfil.')
  } finally {
    updateLoading.value = false
  }
}

function goToPasswordRecovery() {
  router.push({
    name: 'forgot-password',
    query: { from: 'profile' },
  })
}

onMounted(loadProfile)
</script>

<template>
  <main class="profile-view">
    <div class="container-fluid profile-shell">
      <header class="profile-page-header">
        <div>
          <p class="profile-eyebrow">Cuenta</p>
          <h1>Mi perfil</h1>
          <p>Consulta y actualiza la información asociada a tu cuenta.</p>
        </div>
      </header>

      <section v-if="loading" class="profile-state-card" aria-live="polite">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span>Cargando perfil...</span>
      </section>

      <section v-else-if="loadError" class="profile-state-card profile-error" role="alert">
        <span class="state-icon" aria-hidden="true">
          <i class="bi bi-exclamation-circle"></i>
        </span>
        <div>
          <h2>No fue posible mostrar tu perfil</h2>
          <p>{{ loadError }}</p>
        </div>
        <button type="button" class="btn profile-secondary-action" @click="loadProfile">
          Reintentar
        </button>
      </section>

      <div v-else-if="user" class="row g-4 align-items-start">
        <div class="col-12 col-lg-4">
          <aside class="identity-card">
            <div class="profile-avatar" aria-hidden="true">{{ userInitials }}</div>
            <h2>{{ displayName }}</h2>
            <p class="profile-email">{{ user.email }}</p>
            <span class="role-badge" :class="getRoleBadge(profile.role).class">
              {{ getRoleBadge(profile.role).label }}
            </span>

            <div class="account-status">
              <span aria-hidden="true"></span>
              Cuenta activa
            </div>

            <button
              type="button"
              class="btn profile-password-action"
              @click="goToPasswordRecovery"
            >
              <i class="bi bi-key" aria-hidden="true"></i>
              Reestablecer contraseña
            </button>
          </aside>
        </div>

        <div class="col-12 col-lg-8">
          <section class="profile-content-card">
            <header class="content-card-header">
              <div>
                <h2>{{ isEditing ? 'Editar información' : 'Información personal' }}</h2>
                <p>
                  {{
                    isEditing
                      ? 'Actualiza únicamente los datos que necesites.'
                      : 'Estos datos ayudan a personalizar tu experiencia.'
                  }}
                </p>
              </div>

              <button
                v-if="!isEditing"
                type="button"
                class="btn profile-primary-action"
                @click="startEditing"
              >
                <i class="bi bi-pencil" aria-hidden="true"></i>
                Editar perfil
              </button>
            </header>

            <div v-if="!isEditing" class="profile-details-grid">
              <article class="profile-detail">
                <span class="detail-icon" aria-hidden="true">
                  <i class="bi bi-person"></i>
                </span>
                <div>
                  <span class="detail-label">Nombre completo</span>
                  <strong>{{ profile.full_name || 'No especificado' }}</strong>
                </div>
              </article>

              <article class="profile-detail">
                <span class="detail-icon" aria-hidden="true">
                  <i class="bi bi-envelope"></i>
                </span>
                <div>
                  <span class="detail-label">Correo electrónico</span>
                  <strong>{{ user.email }}</strong>
                </div>
              </article>

              <article class="profile-detail">
                <span class="detail-icon" aria-hidden="true">
                  <i class="bi bi-person-vcard"></i>
                </span>
                <div>
                  <span class="detail-label">Género</span>
                  <strong>{{ profile.gender || 'No especificado' }}</strong>
                </div>
              </article>

              <article class="profile-detail">
                <span class="detail-icon" aria-hidden="true">
                  <i class="bi bi-calendar3"></i>
                </span>
                <div>
                  <span class="detail-label">Fecha de nacimiento</span>
                  <strong>{{ formatBirthDate(profile.birth_date) }}</strong>
                </div>
              </article>

              <article class="profile-detail profile-detail-wide">
                <span class="detail-icon" aria-hidden="true">
                  <i class="bi bi-card-text"></i>
                </span>
                <div>
                  <span class="detail-label">Sobre mí</span>
                  <p>{{ profile.about || 'Aún no has agregado una descripción.' }}</p>
                </div>
              </article>
            </div>

            <form v-else class="profile-form" @submit.prevent="handleUpdateProfile">
              <div class="row g-3">
                <div class="col-12">
                  <label for="profile-full-name" class="form-label">Nombre completo</label>
                  <input
                    id="profile-full-name"
                    v-model="profile.full_name"
                    type="text"
                    class="form-control"
                    placeholder="Nombre y apellidos"
                    autocomplete="name"
                    maxlength="120"
                    required
                    :disabled="updateLoading"
                  >
                </div>

                <div class="col-12 col-md-6">
                  <label for="profile-gender" class="form-label">Género</label>
                  <select
                    id="profile-gender"
                    v-model="profile.gender"
                    class="form-select"
                    :disabled="updateLoading"
                  >
                    <option value="">Sin especificar</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Otro">Otro</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>

                <div class="col-12 col-md-6">
                  <label for="profile-birth-date" class="form-label">Fecha de nacimiento</label>
                  <input
                    id="profile-birth-date"
                    v-model="profile.birth_date"
                    type="date"
                    class="form-control"
                    autocomplete="bday"
                    :disabled="updateLoading"
                  >
                </div>

                <div class="col-12">
                  <div class="d-flex align-items-center justify-content-between gap-3">
                    <label for="profile-about" class="form-label">Sobre mí</label>
                    <span class="character-count">{{ aboutLength }}/500</span>
                  </div>
                  <textarea
                    id="profile-about"
                    v-model="profile.about"
                    class="form-control"
                    rows="5"
                    maxlength="500"
                    placeholder="Cuéntanos brevemente sobre ti..."
                    :disabled="updateLoading"
                  ></textarea>
                </div>
              </div>

              <div class="profile-form-actions">
                <button type="submit" class="btn profile-primary-action" :disabled="updateLoading">
                  <span
                    v-if="updateLoading"
                    class="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  ></span>
                  {{ updateLoading ? 'Guardando...' : 'Guardar cambios' }}
                </button>
                <button
                  type="button"
                  class="btn profile-secondary-action"
                  :disabled="updateLoading"
                  @click="cancelEditing"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.profile-view {
  --profile-radius: 0.4em;
  min-height: 100vh;
  padding: clamp(1.5rem, 4vw, 3rem);
  background:
    radial-gradient(circle at 92% 8%, rgba(148, 163, 184, 0.12), transparent 24rem),
    #f7f8fa;
  color: #17191c;
}

.profile-shell {
  max-width: 1120px;
  padding: 0;
}

.profile-page-header {
  margin-bottom: 1.75rem;
}

.profile-eyebrow {
  margin: 0 0 0.35rem;
  color: #8a919b;
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.profile-page-header h1 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  font-weight: 760;
  letter-spacing: -0.045em;
}

.profile-page-header > div > p:last-child {
  margin: 0.55rem 0 0;
  color: #747b85;
  font-size: 0.94rem;
}

.profile-state-card,
.identity-card,
.profile-content-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: var(--profile-radius);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.06);
}

.profile-state-card {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #626a75;
}

.profile-error {
  justify-content: flex-start;
  padding: 1.5rem;
}

.profile-error .state-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  border-radius: var(--profile-radius);
  background: #fff1f2;
  color: #be123c;
  font-size: 1.15rem;
}

.profile-error h2 {
  margin: 0;
  color: #25292e;
  font-size: 1rem;
  font-weight: 700;
}

.profile-error p {
  margin: 0.25rem 0 0;
  font-size: 0.86rem;
}

.profile-error .profile-secondary-action {
  margin-left: auto;
}

.identity-card {
  padding: 2rem 1.5rem 1.5rem;
  text-align: center;
}

.profile-avatar {
  display: inline-flex;
  width: 88px;
  height: 88px;
  align-items: center;
  justify-content: center;
  border-radius: var(--profile-radius);
  background: #17191c;
  color: #ffffff;
  font-size: 1.55rem;
  font-weight: 780;
  letter-spacing: -0.03em;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.16);
}

.identity-card h2 {
  margin: 1.25rem 0 0.25rem;
  font-size: 1.2rem;
  font-weight: 740;
  letter-spacing: -0.025em;
}

.profile-email {
  overflow: hidden;
  margin: 0;
  color: #7a818b;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-badge {
  display: inline-flex;
  margin-top: 1rem;
  padding: 0.45rem 0.7rem;
  border-radius: var(--profile-radius);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.role-admin {
  background: #17191c;
  color: #ffffff;
}

.role-editor {
  background: #e8eefc;
  color: #315795;
}

.role-subscriber,
.role-default {
  background: #eef0f2;
  color: #656d77;
}

.account-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid #eceef0;
  color: #717984;
  font-size: 0.76rem;
  font-weight: 600;
}

.account-status > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22a06b;
  box-shadow: 0 0 0 3px rgba(34, 160, 107, 0.12);
}

.profile-password-action {
  display: inline-flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  border: 1px solid #dfe2e6;
  border-radius: var(--profile-radius);
  background: #ffffff;
  color: #34383e;
  font-size: 0.82rem;
  font-weight: 700;
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.profile-password-action:hover {
  border-color: #c7cbd1;
  background: #f5f6f7;
  color: #17191c;
  transform: translateY(-1px);
}

.profile-content-card {
  overflow: hidden;
}

.content-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid #eceef0;
}

.content-card-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 740;
  letter-spacing: -0.02em;
}

.content-card-header p {
  margin: 0.35rem 0 0;
  color: #858c95;
  font-size: 0.8rem;
}

.profile-primary-action,
.profile-secondary-action {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 0.95rem;
  border-radius: var(--profile-radius);
  font-size: 0.82rem;
  font-weight: 700;
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.profile-primary-action {
  border-color: #17191c;
  background: #17191c;
  color: #ffffff;
}

.profile-primary-action:hover:not(:disabled) {
  border-color: #30343a;
  background: #30343a;
  color: #ffffff;
  transform: translateY(-1px);
}

.profile-secondary-action {
  border-color: #dfe2e6;
  background: #ffffff;
  color: #555d67;
}

.profile-secondary-action:hover:not(:disabled) {
  border-color: #c7cbd1;
  background: #f5f6f7;
  color: #17191c;
}

.profile-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1.5rem;
}

.profile-detail {
  display: flex;
  min-width: 0;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid #eceef0;
  border-radius: var(--profile-radius);
  background: #fafafb;
}

.profile-detail-wide {
  grid-column: 1 / -1;
}

.detail-icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: var(--profile-radius);
  background: #eef0f2;
  color: #59616c;
}

.profile-detail > div {
  min-width: 0;
}

.detail-label {
  display: block;
  margin-bottom: 0.25rem;
  color: #90969e;
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.065em;
  text-transform: uppercase;
}

.profile-detail strong,
.profile-detail p {
  overflow-wrap: anywhere;
  color: #34383e;
  font-size: 0.84rem;
  font-weight: 650;
  line-height: 1.5;
}

.profile-detail p {
  margin: 0;
  color: #656d77;
  font-weight: 450;
  white-space: pre-line;
}

.profile-form {
  padding: 1.5rem;
}

.profile-form .form-label {
  margin-bottom: 0.5rem;
  color: #43484f;
  font-size: 0.76rem;
  font-weight: 700;
}

.profile-form .form-control,
.profile-form .form-select {
  min-height: 48px;
  border-color: #dfe2e6;
  border-radius: var(--profile-radius);
  color: #24282d;
  font-size: 0.88rem;
  box-shadow: none;
}

.profile-form textarea.form-control {
  min-height: 124px;
  resize: vertical;
}

.profile-form .form-control:focus,
.profile-form .form-select:focus {
  border-color: #17191c;
  box-shadow: 0 0 0 0.2rem rgba(23, 25, 28, 0.1);
}

.character-count {
  color: #969ca4;
  font-size: 0.7rem;
}

.profile-form-actions {
  display: flex;
  gap: 0.65rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid #eceef0;
}

@media (max-width: 767.98px) {
  .profile-view {
    padding: 1.25rem 1rem 2rem;
  }

  .content-card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .content-card-header .profile-primary-action {
    width: 100%;
  }

  .profile-details-grid {
    grid-template-columns: 1fr;
  }

  .profile-detail-wide {
    grid-column: auto;
  }

  .profile-error {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-error .profile-secondary-action {
    width: 100%;
    margin-left: 0;
  }

  .profile-form-actions {
    flex-direction: column;
  }

  .profile-form-actions .btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-primary-action,
  .profile-secondary-action,
  .profile-password-action {
    transition: none;
  }
}
</style>

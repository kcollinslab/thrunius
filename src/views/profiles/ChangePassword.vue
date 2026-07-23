<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import '../../assets/styles/auth.css'

const router = useRouter()
const toast = useToast()

const form = ref({
  password: '',
  confirmPassword: '',
})
const user = ref(null)
const hasPassword = ref(false)
const isLoading = ref(true)
const isSubmitting = ref(false)
const loadError = ref('')
const feedback = ref({
  type: '',
  message: '',
})
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const feedbackClasses = {
  error: 'alert-danger',
  success: 'alert-success',
  warning: 'alert-warning',
}

const canSubmit = computed(() => (
  hasSupabaseConfig
  && Boolean(user.value)
  && !isLoading.value
  && !isSubmitting.value
  && !loadError.value
))

const passwordDescription = computed(() => (
  hasPassword.value
    ? 'Tu cuenta ya tiene una contraseña. Al guardar, reemplazarás la actual.'
    : 'Tu cuenta aún no tiene una contraseña. Crea una para poder iniciar sesión con correo y contraseña.'
))

function setFeedback(type, message) {
  feedback.value = { type, message }
}

function getPasswordValidationError() {
  const password = form.value.password.trim()
  const confirmPassword = form.value.confirmPassword.trim()

  if (!password || !confirmPassword) {
    return 'Completa ambos campos para continuar.'
  }

  if (password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }

  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden.'
  }

  return ''
}

function isPasswordProvider(provider) {
  return provider === 'email' || provider === 'phone'
}

function detectPasswordIdentity(authenticatedUser, identities = []) {
  const identityProviders = identities
    .map((identity) => identity?.provider)
    .filter(Boolean)

  const metadataProviders = Array.isArray(authenticatedUser?.app_metadata?.providers)
    ? authenticatedUser.app_metadata.providers
    : []

  return [...identityProviders, ...metadataProviders].some(isPasswordProvider)
}

async function loadUser() {
  isLoading.value = true
  loadError.value = ''

  if (!supabase) {
    loadError.value = 'La configuración de Supabase no está completa en esta app.'
    isLoading.value = false
    return
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) throw userError

    const authenticatedUser = userData?.user

    if (!authenticatedUser) {
      await router.replace({ name: 'login' })
      return
    }

    let identities = authenticatedUser.identities || []

    if (typeof supabase.auth.getUserIdentities === 'function') {
      const { data: identityData, error: identityError } = await supabase.auth.getUserIdentities()

      if (identityError) throw identityError

      identities = identityData?.identities || identities
    }

    user.value = authenticatedUser
    hasPassword.value = detectPasswordIdentity(authenticatedUser, identities)
  } catch (error) {
    console.error('[ChangePassword] No se pudo cargar el usuario:', error)
    loadError.value = error.message || 'No se pudo validar tu cuenta.'
  } finally {
    isLoading.value = false
  }
}

async function handlePasswordUpdate() {
  feedback.value = { type: '', message: '' }

  const validationError = getPasswordValidationError()

  if (validationError) {
    setFeedback('warning', validationError)
    return
  }

  if (!supabase || !user.value) {
    setFeedback('error', 'No se encontró una sesión válida para actualizar la contraseña.')
    return
  }

  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: form.value.password.trim(),
    })

    if (error) throw error

    form.value = {
      password: '',
      confirmPassword: '',
    }
    hasPassword.value = true
    setFeedback('success', 'Tu contraseña se actualizó correctamente.')
    toast.success('Contraseña actualizada.')
  } catch (error) {
    console.error('[ChangePassword] No se pudo actualizar la contraseña:', error)
    setFeedback('error', error.message || 'No se pudo actualizar la contraseña.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(loadUser)
</script>

<template>
  <main class="auth-view">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
          <section class="auth-card bg-white overflow-hidden">
            <div class="auth-card-body">
              <div class="auth-brand" aria-label="Thrunius">
                <span class="auth-brand-mark" aria-hidden="true">T</span>
                <span>Thrunius</span>
              </div>

              <div class="auth-form-container">
                <div class="auth-heading">
                  <h1 class="auth-title h3 fw-bold">Cambiar contraseña</h1>
                  <p class="auth-subtitle">
                    {{ passwordDescription }}
                  </p>
                </div>

                <div v-if="isLoading" class="alert alert-secondary" role="status">
                  <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                  Validando tu cuenta...
                </div>

                <div v-else-if="loadError" class="alert alert-danger" role="alert">
                  {{ loadError }}
                  <button type="button" class="btn btn-link p-0 ms-1" @click="loadUser">
                    Reintentar
                  </button>
                </div>

                <form v-else class="auth-form" @submit.prevent="handlePasswordUpdate">
                  <div class="auth-field">
                    <label for="change-password" class="form-label">Nueva contraseña</label>
                    <div class="input-group">
                      <input
                        id="change-password"
                        v-model="form.password"
                        :type="showPassword ? 'text' : 'password'"
                        class="form-control"
                        placeholder="Mínimo 6 caracteres"
                        autocomplete="new-password"
                        minlength="6"
                        required
                        :disabled="!canSubmit"
                      >
                      <button
                        type="button"
                        class="btn password-toggle"
                        :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                        :disabled="isSubmitting"
                        @click="showPassword = !showPassword"
                      >
                        <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                      </button>
                    </div>
                  </div>

                  <div class="auth-field">
                    <label for="change-password-confirm" class="form-label">
                      Confirmar nueva contraseña
                    </label>
                    <div class="input-group">
                      <input
                        id="change-password-confirm"
                        v-model="form.confirmPassword"
                        :type="showConfirmPassword ? 'text' : 'password'"
                        class="form-control"
                        placeholder="Repite la nueva contraseña"
                        autocomplete="new-password"
                        minlength="6"
                        required
                        :disabled="!canSubmit"
                      >
                      <button
                        type="button"
                        class="btn password-toggle"
                        :aria-label="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                        :disabled="isSubmitting"
                        @click="showConfirmPassword = !showConfirmPassword"
                      >
                        <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="feedback.message"
                    class="alert alert-dismissible fade show"
                    :class="feedbackClasses[feedback.type]"
                    role="alert"
                  >
                    {{ feedback.message }}
                    <button
                      type="button"
                      class="btn-close"
                      aria-label="Cerrar"
                      @click="feedback.message = ''"
                    ></button>
                  </div>

                  <button
                    type="submit"
                    class="auth-submit btn btn-dark btn-lg w-100 fw-bold"
                    :disabled="!canSubmit"
                  >
                    <span
                      v-if="isSubmitting"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    {{ isSubmitting ? 'Actualizando...' : 'Actualizar contraseña' }}
                  </button>
                </form>
              </div>

              <div class="auth-footer">
                <p class="text-muted mb-0">
                  <RouterLink to="/profile" class="auth-link fw-bold text-decoration-none">
                    Volver a mi perfil
                  </RouterLink>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>

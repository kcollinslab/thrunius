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
const feedback = ref({
  type: '',
  message: '',
})
const isCheckingSession = ref(true)
const isSubmitting = ref(false)
const hasRecoverySession = ref(false)

const feedbackClasses = {
  error: 'alert-danger',
  success: 'alert-success',
  warning: 'alert-warning',
}

const canSubmit = computed(() => (
  hasSupabaseConfig
  && hasRecoverySession.value
  && !isCheckingSession.value
  && !isSubmitting.value
))

function setFeedback(type, message) {
  feedback.value = { type, message }
}

function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
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

async function checkRecoverySession() {
  if (!supabase) {
    setFeedback('error', 'La configuración de Supabase no está completa en esta app.')
    isCheckingSession.value = false
    return
  }

  const hashParams = getHashParams()
  const recoveryError = hashParams.get('error_description') || hashParams.get('error')

  if (recoveryError) {
    setFeedback('error', recoveryError.replace(/\+/g, ' '))
    isCheckingSession.value = false
    return
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    setFeedback('error', error.message || 'No se pudo validar el enlace de recuperación.')
    isCheckingSession.value = false
    return
  }

  if (!data?.session) {
    setFeedback(
      'warning',
      'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.',
    )
    isCheckingSession.value = false
    return
  }

  hasRecoverySession.value = true
  isCheckingSession.value = false
}

async function handlePasswordUpdate() {
  feedback.value = { type: '', message: '' }

  if (!supabase) {
    setFeedback('error', 'La configuración de Supabase no está completa en esta app.')
    return
  }

  const validationError = getPasswordValidationError()

  if (validationError) {
    setFeedback('warning', validationError)
    return
  }

  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: form.value.password.trim(),
    })

    if (error) {
      throw error
    }

    form.value = {
      password: '',
      confirmPassword: '',
    }
    setFeedback('success', 'Tu contraseña se actualizó correctamente.')
    toast.success('Contraseña actualizada.')

    await supabase.auth.signOut()

    setTimeout(() => {
      router.push({ name: 'login' })
    }, 1200)
  } catch (error) {
    setFeedback('error', error.message || 'No se pudo actualizar la contraseña.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  checkRecoverySession()
})
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
                  <h2 class="auth-title h3 fw-bold">Nueva contraseña</h2>
                  <p class="auth-subtitle">
                    Elige una contraseña segura que no uses en otros servicios.
                  </p>
                </div>

                <form class="auth-form" @submit.prevent="handlePasswordUpdate">
                  <div class="auth-field">
                    <label for="new-password" class="form-label">Contraseña</label>
                    <input
                      id="new-password"
                      v-model="form.password"
                      type="password"
                      class="form-control"
                      placeholder="Mínimo 6 caracteres"
                      autocomplete="new-password"
                      required
                      :disabled="!canSubmit"
                    >
                  </div>

                  <div class="auth-field">
                    <label for="confirm-new-password" class="form-label">
                      Confirmar contraseña
                    </label>
                    <input
                      id="confirm-new-password"
                      v-model="form.confirmPassword"
                      type="password"
                      class="form-control"
                      placeholder="Repite tu contraseña"
                      autocomplete="new-password"
                      required
                      :disabled="!canSubmit"
                    >
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
                      v-if="isSubmitting || isCheckingSession"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    {{
                      isCheckingSession
                        ? 'Validando enlace...'
                        : isSubmitting
                          ? 'Actualizando...'
                          : 'Actualizar contraseña'
                    }}
                  </button>
                </form>
              </div>

              <div class="auth-footer">
                <p class="text-muted mb-0">
                  ¿Ya tienes acceso?
                  <RouterLink to="/login" class="auth-link fw-bold text-decoration-none">
                    Inicia sesión
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

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { getAppUrl } from '../../lib/appUrl'
import {
  forgetPasswordRecoveryRequest,
  rememberPasswordRecoveryRequest,
} from '../../lib/passwordRecoveryFlow'
import '../../assets/styles/auth.css'

const route = useRoute()
const toast = useToast()

const form = ref({
  email: '',
})
const feedback = ref({
  type: '',
  message: '',
})
const isSubmitting = ref(false)
const isLoadingUserEmail = ref(false)
const isAuthenticatedRecovery = ref(false)

const feedbackClasses = {
  error: 'alert-danger',
  success: 'alert-success',
  warning: 'alert-warning',
}

const isFromProfile = computed(() => route.query?.from === 'profile')

const pageTitle = computed(() => (
  isAuthenticatedRecovery.value ? 'Restablecer contraseña' : 'Recuperar contraseña'
))

const pageSubtitle = computed(() => (
  isAuthenticatedRecovery.value
    ? 'Enviaremos un enlace seguro al correo de tu cuenta para asignar una nueva contraseña.'
    : 'Escribe el correo de tu cuenta y te enviaremos un enlace seguro.'
))

const submitLabel = computed(() => (
  isSubmitting.value ? 'Enviando...' : 'Enviar enlace'
))

const footerCopy = computed(() => (
  isAuthenticatedRecovery.value
    ? '¿Quieres volver a tu perfil?'
    : '¿Ya recordaste tu contraseña?'
))

const footerLink = computed(() => (
  isAuthenticatedRecovery.value
    ? { to: '/profile', label: 'Volver al perfil' }
    : { to: '/login', label: 'Inicia sesión' }
))

function setFeedback(type, message) {
  feedback.value = { type, message }
}

function getEmailValidationError(email) {
  if (!email) return 'Ingresa tu correo electrónico para continuar.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Ingresa un correo electrónico válido.'
  }
  return ''
}

async function loadAuthenticatedUserEmail() {
  if (!supabase || !isFromProfile.value) return

  isLoadingUserEmail.value = true

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error

    const email = data?.user?.email

    if (email) {
      form.value.email = email
      isAuthenticatedRecovery.value = true
    }
  } catch (error) {
    console.warn('No se pudo precargar el correo del usuario:', error)
  } finally {
    isLoadingUserEmail.value = false
  }
}

async function handlePasswordRecovery() {
  setFeedback('', '')

  if (!supabase) {
    setFeedback('error', 'La configuración de Supabase no está completa en esta app.')
    return
  }

  const email = form.value.email.trim().toLowerCase()
  const validationError = getEmailValidationError(email)

  if (validationError) {
    setFeedback('warning', validationError)
    return
  }

  isSubmitting.value = true

  try {
    rememberPasswordRecoveryRequest()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAppUrl('new-password'),
    })

    if (error) throw error

    setFeedback(
      'success',
      'Si el correo está registrado, recibirás un enlace para asignar una nueva contraseña.',
    )
    toast.success('Solicitud enviada. Revisa tu correo.')
    form.value.email = ''
  } catch (error) {
    forgetPasswordRecoveryRequest()
    console.error('Error al enviar recuperación de contraseña:', error)
    setFeedback('error', error.message || 'No se pudo enviar el correo de recuperación.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadAuthenticatedUserEmail()
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
                  <h2 class="auth-title h3 fw-bold">{{ pageTitle }}</h2>
                  <p class="auth-subtitle">
                    {{ pageSubtitle }}
                  </p>
                </div>

                <form class="auth-form" novalidate @submit.prevent="handlePasswordRecovery">
                  <div class="auth-field">
                    <label for="recovery-email" class="form-label">Correo electrónico</label>
                    <input
                      id="recovery-email"
                      v-model="form.email"
                      type="email"
                      class="form-control"
                      placeholder="tu@correo.com"
                      autocomplete="email"
                      required
                      :disabled="isSubmitting || isLoadingUserEmail"
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
                    :disabled="isSubmitting || isLoadingUserEmail || !hasSupabaseConfig"
                  >
                    <span
                      v-if="isSubmitting || isLoadingUserEmail"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    {{ isLoadingUserEmail ? 'Cargando correo...' : submitLabel }}
                  </button>
                </form>
              </div>

              <div class="auth-footer">
                <p class="text-muted mb-0">
                  {{ footerCopy }}
                  <RouterLink :to="footerLink.to" class="auth-link fw-bold text-decoration-none">
                    {{ footerLink.label }}
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

<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import '../../assets/auth.css'

const toast = useToast()

const form = ref({
  email: '',
})
const feedback = ref({
  type: '',
  message: '',
})
const isSubmitting = ref(false)

const feedbackClasses = {
  error: 'alert-danger',
  success: 'alert-success',
  warning: 'alert-warning',
}

function getRecoveryRedirectUrl() {
  const basePath = import.meta.env.BASE_URL || '/'
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`

  return new URL(`${normalizedBasePath}login`, window.location.origin).toString()
}

async function handlePasswordRecovery() {
  feedback.value = { type: '', message: '' }

  if (!supabase) {
    feedback.value = {
      type: 'error',
      message: 'La configuración de Supabase no está completa en esta app.',
    }
    return
  }

  const email = form.value.email.trim()

  if (!email) {
    feedback.value = {
      type: 'warning',
      message: 'Ingresa tu correo electrónico para continuar.',
    }
    return
  }

  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRecoveryRedirectUrl(),
    })

    if (error) {
      throw error
    }

    feedback.value = {
      type: 'success',
      message: 'Te enviamos un enlace para recuperar tu contraseña. Revisa tu correo.',
    }
    toast.success('Solicitud enviada. Revisa tu correo.')
    form.value.email = ''
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error.message || 'No se pudo enviar el correo de recuperación.',
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="auth-view">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
          <section class="auth-card bg-white overflow-hidden">
            <div class="auth-card-body">
              <div class="auth-form-container">
                <div class="auth-heading">
                  <h2 class="auth-title h3 fw-bold">Recuperar contraseña</h2>
                </div>

                <form class="auth-form" @submit.prevent="handlePasswordRecovery">
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
                      :disabled="isSubmitting"
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
                    :disabled="isSubmitting || !hasSupabaseConfig"
                  >
                    <span
                      v-if="isSubmitting"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    {{ isSubmitting ? 'Enviando...' : 'Enviar enlace' }}
                  </button>
                </form>
              </div>

              <div class="text-center">
                <p class="text-muted mb-0">
                  ¿Ya recordaste tu contraseña?
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

<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { getAppUrl } from '../lib/appUrl'

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
  warning: 'alert-warning',
  success: 'alert-success',
}

async function handleLogin() {
  feedback.value = { type: '', message: '' }

  if (!supabase) {
    feedback.value = {
      type: 'error',
      message: 'La configuracion de Supabase no esta completa en esta app.',
    }
    return
  }

  const email = form.value.email.trim().toLowerCase()

  if (!email) {
    feedback.value = {
      type: 'warning',
      message: 'Completa el correo electronico para continuar.',
    }
    return
  }

  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: getAppUrl('profile'),
      },
    })

    if (error) {
      throw error
    }

    feedback.value = {
      type: 'success',
      message: 'Te enviamos un magic link. Revisa tu correo para iniciar sesion.',
    }
    toast.success('Magic link enviado. Revisa tu correo para iniciar sesion.')

    form.value.email = ''
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error.message || 'No se pudo enviar el magic link.',
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-form-container">
    <div class="auth-heading">
      <h2 class="auth-title h3 fw-bold">Acceso por enlace</h2>
      <p class="auth-subtitle">
        Te enviaremos un enlace de acceso seguro a tu correo.
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleLogin">
      <div class="auth-field">
        <label for="email-login-email" class="form-label">Correo electronico</label>
        <input
          id="email-login-email"
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
        {{ isSubmitting ? 'Enviando...' : 'Enviar link de inicio' }}
      </button>
    </form>
  </div>
</template>

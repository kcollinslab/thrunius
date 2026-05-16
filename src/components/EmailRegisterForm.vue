<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

const toast = useToast()

const form = ref({
  name: '',
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

async function handleRegister() {
  feedback.value = { type: '', message: '' }

  if (!supabase) {
    feedback.value = {
      type: 'error',
      message: 'La configuracion de Supabase no esta completa en esta app.',
    }
    return
  }

  const name = form.value.name.trim()
  const email = form.value.email.trim().toLowerCase()

  if (!name || !email) {
    feedback.value = {
      type: 'warning',
      message: 'Completa tu nombre y correo electronico para continuar.',
    }
    return
  }

  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/profile`,
        data: {
          name,
          full_name: name,
        },
      },
    })

    if (error) {
      throw error
    }

    feedback.value = {
      type: 'success',
      message: 'Te enviamos un magic link. Revisa tu correo para iniciar sesion.',
    }
    toast.success('Registro enviado. Revisa tu correo para usar el magic link.')

    form.value.name = ''
    form.value.email = ''
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error.message || 'No se pudo completar el registro.',
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-form-container">
    <div class="auth-heading">
      <h2 class="auth-title h3 fw-bold">Crear cuenta</h2>
    </div>

    <form class="auth-form" @submit.prevent="handleRegister">
      <div class="auth-field">
        <label for="email-register-name" class="form-label">Nombre y apellido</label>
        <input
          id="email-register-name"
          v-model="form.name"
          type="text"
          class="form-control"
          placeholder="Tu nombre y apellido"
          autocomplete="name"
          required
          :disabled="isSubmitting"
        >
      </div>

      <div class="auth-field">
        <label for="email-register-email" class="form-label">Correo electronico</label>
        <input
          id="email-register-email"
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
        {{ isSubmitting ? 'Enviando...' : 'Registrarme' }}
      </button>
    </form>
  </div>
</template>

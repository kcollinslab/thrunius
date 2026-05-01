<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

const router = useRouter()
const toast = useToast()

const form = ref({
  email: '',
  password: '',
})
const feedback = ref({
  type: '',
  message: '',
})
const isSubmitting = ref(false)
const showPassword = ref(false)

const feedbackClasses = {
  error: 'alert-danger',
  warning: 'alert-warning',
}

async function handleLogin() {
  feedback.value = { type: '', message: '' }

  if (!supabase) {
    feedback.value = {
      type: 'error',
      message: 'La configuración de Supabase no está completa en esta app.',
    }
    return
  }

  if (!form.value.email || !form.value.password) {
    feedback.value = {
      type: 'warning',
      message: 'Completa el correo y la contraseña para continuar.',
    }
    return
  }

  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })

    if (error) {
      throw error
    }

    toast.success('Inicio de sesión exitoso. Redirigiendo...')

    setTimeout(() => {
      router.push('/profile')
    }, 1500)
    form.value.email = ''
    form.value.password = ''
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error.message || 'No se pudo iniciar sesión.',
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-form-container">
    <div class="auth-heading">
      <h2 class="auth-title h3 fw-bold">Bienvenido</h2>
    </div>

    <form class="auth-form" @submit.prevent="handleLogin">
      <div class="auth-field">
        <label for="login-email" class="form-label">Correo electrónico</label>
        <input
          id="login-email"
          v-model="form.email"
          type="email"
          class="form-control"
          placeholder="tu@correo.com"
          autocomplete="email"
          required
          :disabled="isSubmitting"
        >
      </div>

      <div class="auth-field">
        <label for="login-password" class="form-label">Contraseña</label>
        <div class="input-group">
          <input
            id="login-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="form-control"
            placeholder="Tu contraseña"
            autocomplete="current-password"
            required
            :disabled="isSubmitting"
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

      <div class="auth-secondary-action">
        <RouterLink to="/forgot-password" class="small text-decoration-none">
          ¿Olvidaste tu contraseña?
        </RouterLink>
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
        {{ isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión' }}
      </button>
    </form>
  </div>
</template>

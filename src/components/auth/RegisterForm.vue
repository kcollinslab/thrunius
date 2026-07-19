<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'

const router = useRouter()
const toast = useToast()

const form = ref({
  email: '',
  password: '',
  confirmPassword: '',
})
const feedback = ref({
  type: '',
  message: '',
})
const isSubmitting = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const feedbackClasses = {
  error: 'alert-danger',
  warning: 'alert-warning',
}

async function handleRegister() {
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

  if (form.value.password.length < 6) {
    feedback.value = {
      type: 'warning',
      message: 'La contraseña debe tener al menos 6 caracteres.',
    }
    return
  }

  if (form.value.password !== form.value.confirmPassword) {
    feedback.value = {
      type: 'error',
      message: 'La confirmación de la contraseña no coincide.',
    }
    return
  }

  isSubmitting.value = true

  try {
    const { data, error } = await supabase.auth.signUp({
      email: form.value.email,
      password: form.value.password,
    })

    if (error) {
      throw error
    }

    toast.success(
      data.session
        ? 'Registro completado. Redirigiendo...'
        : 'Registro enviado. Revisa tu correo para confirmar la cuenta.',
    )

    if (data.session) {
      setTimeout(() => {
        router.push('/profile')
      }, 1500)
    }
    form.value.email = ''
    form.value.password = ''
    form.value.confirmPassword = ''
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
      <p class="auth-subtitle">
        Registra tu correo y crea una contraseña segura.
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleRegister">
      <div class="auth-field">
        <label for="register-email" class="form-label">Correo electrónico</label>
        <input
          id="register-email"
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
        <label for="register-password" class="form-label">Contraseña</label>
        <div class="input-group">
          <input
            id="register-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="form-control"
            placeholder="Mínimo 6 caracteres"
            autocomplete="new-password"
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

      <div class="auth-field">
        <label for="register-confirm-password" class="form-label">Confirmar contraseña</label>
        <div class="input-group">
          <input
            id="register-confirm-password"
            v-model="form.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            class="form-control"
            placeholder="Repite tu contraseña"
            autocomplete="new-password"
            required
            :disabled="isSubmitting"
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
        :disabled="isSubmitting || !hasSupabaseConfig"
      >
        <span
          v-if="isSubmitting"
          class="spinner-border spinner-border-sm me-2"
          aria-hidden="true"
        ></span>
        {{ isSubmitting ? 'Registrando...' : 'Registrarse' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LoginForm from '../../components/LoginForm.vue'
import EmailLoginForm from '../../components/EmailLoginForm.vue'
import '../../assets/styles/auth.css'

const route = useRoute()

const isMagicLinkLogin = computed(() => route.meta.authMethod === 'magic-link')
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

              <nav class="auth-method-switch" aria-label="Método de inicio de sesión">
                <RouterLink
                  :to="{ name: 'login' }"
                  class="auth-method-option"
                  exact-active-class="active"
                >
                  Contraseña
                </RouterLink>
                <RouterLink
                  :to="{ name: 'login-link' }"
                  class="auth-method-option"
                  exact-active-class="active"
                >
                  Magic link
                </RouterLink>
              </nav>

              <EmailLoginForm v-if="isMagicLinkLogin" />
              <LoginForm v-else />

              <div class="auth-footer">
                <p class="text-muted mb-0">
                  ¿No tienes una cuenta?
                  <RouterLink to="/register" class="auth-link fw-bold text-decoration-none">
                    Regístrate
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

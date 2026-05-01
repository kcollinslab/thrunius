<script setup>
import LoginForm from '../../components/LoginForm.vue'
import '../../assets/auth.css'
</script>

<template>
  <main class="auth-view">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
          <section class="auth-card bg-white overflow-hidden">
            <div class="auth-card-body">
              <LoginForm />

              <div class="text-center">
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

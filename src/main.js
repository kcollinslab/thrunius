import { createApp } from 'vue'
import 'animate.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'vue-toastification/dist/index.css'
import 'bootstrap'
import './style.css'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import Toast from 'vue-toastification'

const app = createApp(App)
app.use(router)
app.use(vuetify)
app.use(Toast, {
  position: 'top-right',
  timeout: 3500,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  hideProgressBar: false,
})
app.mount('#app')

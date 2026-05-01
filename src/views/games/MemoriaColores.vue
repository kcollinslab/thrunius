<script setup>
import { computed, nextTick, ref } from 'vue'

const TOTAL_ROUNDS = 5

const colors = [
  { id: 'rojo', name: 'Rojo', value: '#dc3545' },
  { id: 'azul', name: 'Azul', value: '#0d6efd' },
  { id: 'verde', name: 'Verde', value: '#198754' },
  { id: 'amarillo', name: 'Amarillo', value: '#ffc107' },
  { id: 'morado', name: 'Morado', value: '#6f42c1' },
  { id: 'naranja', name: 'Naranja', value: '#fd7e14' },
  { id: 'rosa', name: 'Rosa', value: '#d63384' },
  { id: 'cian', name: 'Cian', value: '#0dcaf0' },
  { id: 'lima', name: 'Lima', value: '#8bc34a' },
  { id: 'indigo', name: 'Indigo', value: '#3f51b5' },
  { id: 'turquesa', name: 'Turquesa', value: '#20c997' },
  { id: 'coral', name: 'Coral', value: '#ff6f61' },
  { id: 'vino', name: 'Vino', value: '#8b1e3f' },
  { id: 'menta', name: 'Menta', value: '#98ff98' },
  { id: 'gris', name: 'Gris', value: '#6c757d' },
  { id: 'negro', name: 'Negro', value: '#212529' },
]

const round = ref(0)
const sequence = ref([])
const playerSequence = ref([])
const activeColor = ref(null)
const message = ref('Presiona iniciar para comenzar.')
const isShowingSequence = ref(false)
const gameStatus = ref('idle')
const showMonkey = ref(false)
const monkeyAnimationKey = ref(0)

const canPlay = computed(() => gameStatus.value === 'playing' && !isShowingSequence.value)
const progressText = computed(() => `${round.value} de ${TOTAL_ROUNDS}`)
const messageClass = computed(() => {
  if (gameStatus.value === 'lost') return 'alert-danger'
  if (gameStatus.value === 'won') return 'alert-success'
  return 'alert-info'
})

const gameBackgroundClass = computed(() => {
  if (gameStatus.value === 'lost') return 'game-background-lost'
  if (gameStatus.value === 'won') return 'game-background-won'
  return ''
})

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function getRandomColor() {
  const randomIndex = Math.floor(Math.random() * colors.length)
  return colors[randomIndex].id
}

function findColor(colorId) {
  return colors.find((color) => color.id === colorId)
}

async function startGame() {
  round.value = 0
  sequence.value = []
  playerSequence.value = []
  showMonkey.value = false
  monkeyAnimationKey.value += 1
  gameStatus.value = 'playing'
  message.value = 'Observa la secuencia.'

  await nextTick()
  showMonkey.value = true
  await nextRound()
}

async function nextRound() {
  round.value += 1
  playerSequence.value = []
  sequence.value.push(getRandomColor())
  message.value = `Ronda ${round.value}: memoriza la secuencia.`

  await showSequence()
}

async function showSequence() {
  isShowingSequence.value = true
  await wait(600)

  for (const color of sequence.value) {
    const currentColor = findColor(color)
    activeColor.value = color
    message.value = `Recuerda: ${currentColor.name}`
    await wait(700)
    activeColor.value = null
    await wait(250)
  }

  isShowingSequence.value = false
  message.value = 'Tu turno. Presiona los colores en el mismo orden.'
}

async function chooseColor(colorId) {
  if (!canPlay.value) return

  playerSequence.value.push(colorId)

  const currentIndex = playerSequence.value.length - 1
  const expectedColor = sequence.value[currentIndex]
  const isCorrect = colorId === expectedColor

  activeColor.value = colorId
  await wait(180)
  activeColor.value = null

  if (!isCorrect) {
    const expectedColorName = findColor(expectedColor).name
    gameStatus.value = 'lost'
    message.value = `Perdiste. El color correcto era ${expectedColorName}.`
    return
  }

  if (playerSequence.value.length !== sequence.value.length) return

  if (round.value === TOTAL_ROUNDS) {
    gameStatus.value = 'won'
    message.value = 'Ganaste. Completaste las cinco rondas.'
    return
  }

  message.value = 'Correcto. Vamos con la siguiente ronda.'
  await wait(900)
  await nextRound()
}
</script>

<template>
  <main class="memoria-colores py-4 py-md-5" :class="gameBackgroundClass">
    <section class="game-header mb-4">
      <p class="text-uppercase text-muted small fw-bold mb-2">Juego de memoria</p>
      <h1 class="h3 fw-bold mb-2">Welcome to Memoria de Colores</h1>
      <p class="text-muted mb-0">
        Recuerda la secuencia y presiona los colores en el mismo orden.
      </p>
    </section>

    <img
      v-if="showMonkey"
      :key="monkeyAnimationKey"
      src="/images/monito.jpeg"
      alt="Monito"
      class="monkey-image img-fluid mb-4 animate__animated animate__fadeInUpBig"
    >

    <section class="game-panel">
      <div class="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
        <div>
          <p class="text-muted mb-1">Ronda</p>
          <p class="h4 fw-bold mb-0">{{ progressText }}</p>
        </div>

        <button class="btn btn-primary" type="button" @click="startGame">
          {{ gameStatus === 'idle' ? 'Iniciar' : 'Reiniciar' }}
        </button>
      </div>

      <p class="alert mb-4" :class="messageClass" role="status">
        {{ message }}
      </p>

      <div class="color-grid">
        <button
          v-for="color in colors"
          :key="color.id"
          class="color-button"
          :class="{ active: activeColor === color.id }"
          type="button"
          :disabled="!canPlay"
          :style="{ backgroundColor: color.value }"
          @click="chooseColor(color.id)"
        >
          {{ color.name }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.memoria-colores {
  min-height: 100vh;
  padding-inline: 1rem;
  transition: background-color 0.25s ease;
}

.game-background-lost {
  background-color: #f8d7da;
}

.game-background-won {
  background-color: #d1e7dd;
}

.game-header,
.game-panel {
  max-width: 900px;
  margin-inline: auto;
}

.game-panel {
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 8px;
  padding: 1rem;
}

.monkey-image {
  display: block;
  max-height: 200px;
  margin-inline: auto;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.color-button {
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  font-weight: 700;
  min-height: 86px;
  opacity: 0.78;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.color-button:disabled {
  cursor: not-allowed;
}

.color-button.active,
.color-button:enabled:hover {
  opacity: 1;
  transform: scale(1.03);
}

@media (min-width: 576px) {
  .color-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .game-panel {
    padding: 1.5rem;
  }
}
</style>

import test from 'node:test'
import assert from 'node:assert/strict'
import * as cbk from '../../src/constants/catalogs/cloudbook.js'

const catalogs = [
  [cbk.CBK_AREAS, cbk.normalizeCbkArea, cbk.getCbkAreaLabel],
  [cbk.CBK_PREGUNTA_TIPOS, cbk.normalizeCbkPreguntaTipo, cbk.getCbkPreguntaTipoLabel],
  [cbk.CBK_PREGUNTA_ESTADOS, cbk.normalizeCbkPreguntaEstado, cbk.getCbkPreguntaEstadoLabel],
  [cbk.CBK_PROCEDENCIAS, cbk.normalizeCbkProcedencia, cbk.getCbkProcedenciaLabel],
  [cbk.CBK_RECURSO_TIPOS, cbk.normalizeCbkRecursoTipo, cbk.getCbkRecursoTipoLabel],
  [cbk.CBK_DIFICULTADES, cbk.normalizeCbkDificultad, cbk.getCbkDificultadLabel],
]

test('keys estables, opciones inmutables y normalizacion de labels', () => {
  for (const [options, normalize, getLabel] of catalogs) {
    assert.ok(Object.isFrozen(options))
    assert.equal(new Set(options.map(({ key }) => key)).size, options.length)
    for (const option of options) {
      assert.ok(Object.isFrozen(option))
      assert.match(option.key, /^[a-z]+(?:_[a-z]+)*$/)
      assert.equal(normalize(option.key), option.key)
      assert.equal(normalize(`  ${option.label.toUpperCase()}  `), option.key)
      assert.equal(getLabel(option.key), option.label)
    }
    for (const value of [undefined, null, '', 'desconocido']) {
      assert.equal(normalize(value), '')
      assert.equal(normalize(value, 'fallback'), 'fallback')
    }
  }
})

test('areas no inventan IDs y cubren las cinco areas aprobadas', () => {
  assert.equal(cbk.CBK_AREAS.length, 5)
  assert.ok(cbk.CBK_AREAS.every((option) => !('id' in option)))
  assert.equal(cbk.normalizeCbkArea('Matematicas'), cbk.CBK_AREA_KEYS.MATEMATICAS)
  assert.equal(cbk.normalizeCbkArea(1), '')
})

test('dificultad conserva los valores numericos de la base de datos', () => {
  for (const { key, label, valor } of cbk.CBK_DIFICULTADES) {
    assert.equal(cbk.normalizeCbkDificultad(valor), key)
    assert.equal(cbk.normalizeCbkDificultad(String(valor)), key)
    assert.equal(cbk.getCbkDificultadValor(key), valor)
    assert.equal(cbk.getCbkDificultadValor(label), valor)
    assert.equal(cbk.getCbkDificultadLabel(valor), label)
  }
  for (const value of [0, 4, null, 'desconocido']) assert.equal(cbk.getCbkDificultadValor(value), null)
})

test('tipos y estados corresponden a los valores aprobados de preguntas', () => {
  assert.deepEqual(cbk.CBK_PREGUNTA_TIPOS.map(({ key }) => key), ['seleccion_unica'])
  assert.deepEqual(cbk.CBK_PREGUNTA_ESTADOS.map(({ key }) => key), ['borrador', 'publicada', 'retirada'])
  assert.deepEqual(cbk.CBK_PROCEDENCIAS.map(({ key }) => key), ['propia', 'adaptada', 'externa'])
  assert.deepEqual(cbk.CBK_RECURSO_TIPOS.map(({ key }) => key), ['imagen', 'audio'])
})

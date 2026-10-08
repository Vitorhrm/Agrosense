import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'

// Executa o serviço real com o objeto que WebMessageListener injeta no Android.
const code = ts.transpileModule(readFileSync(new URL('../src/AndroidBridge.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function setup(response) {
  const sent = []
  const bridge = { onmessage: null, postMessage(text) {
    const request = JSON.parse(text)
    sent.push(request)
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ callbackId: request.callbackId, ...response(request) }) }))
  } }
  const context = { exports: {}, window: { AndroidBridge: bridge, addEventListener() {} }, crypto: webcrypto, setTimeout, clearTimeout }
  vm.runInNewContext(code, context)
  return { service: context.exports.bridgeService, sent }
}
const user = { id: 'usuario-teste', email: 'teste@example.invalid', firstName: 'Teste', lastName: 'Local' }
test('login usa JSON/postMessage e recebe o perfil', async () => {
  const { service, sent } = setup(() => ({ success: true, data: user }))
  const result = await service.login(user.email, 'senha-de-teste')
  assert.equal(result.id, user.id)
  assert.equal(sent[0].type, 'login')
  assert.equal(sent[0].payload.email, user.email)
})
test('sessão ausente é sucesso com null', async () => {
  const { service } = setup(() => ({ success: true, data: null }))
  assert.equal(await service.getSession(), null)
})
test('cadastro pendente de e-mail não autentica', async () => {
  const { service } = setup(() => ({ success: true, data: { user: null, requiresEmailConfirmation: true } }))
  const result = await service.signup(user.email, 'senha-de-teste', 'Teste', 'Local')
  assert.equal(result.user, null)
  assert.equal(result.requiresEmailConfirmation, true)
})
test('falha do Kotlin chega à interface sem falso sucesso', async () => {
  const { service } = setup(() => ({ success: false, error: 'Credenciais inválidas.' }))
  await assert.rejects(service.login(user.email, 'incorreta'), /Credenciais inválidas/)
})
test('perfil malformado é rejeitado', async () => {
  const { service } = setup(() => ({ success: true, data: {} }))
  await assert.rejects(service.login(user.email, 'incorreta'), /inválida/)
})

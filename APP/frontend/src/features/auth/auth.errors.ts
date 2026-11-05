/** Mensagens conhecidas ficam em português, sem expor detalhes internos do servidor. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Não foi possível concluir a operação."
  const code = "code" in error ? error.code : undefined
  if (code === "invalid_credentials") return "E-mail ou senha incorretos."
  if (code === "email_not_confirmed") return "Confirme seu e-mail antes de entrar."
  if (code === "user_already_exists") return "Já existe uma conta com este e-mail."
  if (code === "weak_password") return "Escolha uma senha mais forte, com pelo menos 8 caracteres."
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  if (/fetch|network|timeout/i.test(error.message)) return "Não foi possível conectar. Verifique sua internet e tente novamente."
  return error.message || "Não foi possível concluir a operação."
}

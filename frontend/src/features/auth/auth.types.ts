export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
}
export interface SignupResult {
  user: AuthUser | null
  requiresEmailConfirmation: boolean
}

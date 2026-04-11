import { LoginForm } from "./_components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Cobranza</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de gestión de cobranza
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-medium">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">
              Ingresá con tu cuenta de administrador
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

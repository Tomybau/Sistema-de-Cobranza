import { LoginForm } from "./_components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Panel izquierdo — brand */}
      <div className="hidden lg:flex flex-col bg-primary px-12 py-10 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white/15 grid place-items-center shrink-0">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold">Cobranza</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-xs">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Sistema de gestión<br />de cobranza
          </h1>
          <p className="mt-3 text-primary-foreground/70 text-sm leading-relaxed">
            Contratos, tickets, pagos y mails en un solo lugar. Reemplaza el flujo manual en Excel.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              "Tickets de cobro recurrentes automáticos",
              "Control de morosidad y vencimientos",
              "Envío de mails desde templates personalizados",
              "Dashboard con KPIs en tiempo real",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-primary-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/35">
          Sistema interno · uso exclusivo de administradores
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Logo móvil */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-primary grid place-items-center mb-3">
              <span className="text-primary-foreground font-bold">C</span>
            </div>
            <h1 className="text-xl font-semibold">Cobranza</h1>
            <p className="text-sm text-muted-foreground">Sistema de gestión</p>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="text-xl font-semibold tracking-tight">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresá con tu cuenta de administrador
            </p>
          </div>

          <div className="lg:hidden mb-5">
            <h2 className="text-base font-medium">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">
              Ingresá con tu cuenta de administrador
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}

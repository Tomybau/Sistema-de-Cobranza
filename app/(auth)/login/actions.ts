"use server"

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth"
import { AuthError } from "next-auth"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
})

export type LoginActionResult =
  | { success: true }
  | { success: false; error: string }

export async function loginAction(
  formData: FormData
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await nextAuthSignIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    })
    return { success: true }
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Email o contraseña incorrectos" }
        default:
          return { success: false, error: "Error de autenticación" }
      }
    }
    // next-auth redirige lanzando NEXT_REDIRECT — re-throw para que funcione
    throw error
  }
}

export async function logoutAction() {
  await nextAuthSignOut({ redirectTo: "/login" })
}

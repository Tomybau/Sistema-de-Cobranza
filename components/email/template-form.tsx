"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createEmailTemplateAction, updateEmailTemplateAction } from "@/app/actions/email-templates"

const formSchema = z.object({
  companyId: z.string().min(1, "La empresa es obligatoria"),
  name: z.string().min(1, "El nombre es obligatorio"),
  subject: z.string().min(1, "El asunto es obligatorio"),
  bodyHtml: z.string().min(1, "El cuerpo del email es obligatorio"),
  isDefault: z.boolean().default(false),
})

type FormData = z.infer<typeof formSchema>

interface TemplateFormProps {
  companies: { id: string; legalName: string }[]
  initialData?: any
}

const AVAILABLE_VARIABLES = [
  "client_name",
  "client_email",
  "company_name",
  "ticket_number",
  "ticket_amount",
  "ticket_due_date",
  "ticket_period",
  "contract_name",
  "payment_link",
]

export function TemplateForm({ companies, initialData }: TemplateFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: initialData?.companyId || "",
      name: initialData?.name || "",
      subject: initialData?.subject || "",
      bodyHtml: initialData?.bodyHtml || "",
      isDefault: initialData?.isDefault || false,
    },
  })

  // Watch for preview
  const bodyHtml = form.watch("bodyHtml")

  const validateVars = () => {
    const subject = form.getValues("subject")
    const body = form.getValues("bodyHtml")
    const combined = `${subject} ${body}`
    const matches = combined.match(/{{(.*?)}}/g) || []
    
    const invalidVars = new Set<string>()
    for (const match of matches) {
      const varName = match.replace(/[{}]/g, "").trim()
      if (!AVAILABLE_VARIABLES.includes(varName)) {
        invalidVars.add(varName)
      }
    }

    const errors = Array.from(invalidVars)
    setValidationErrors(errors)

    if (errors.length === 0) {
      toast.success("Todas las variables son válidas")
    } else {
      toast.error(`Variables inválidas encontradas: ${errors.join(", ")}`)
    }

    return errors.length === 0
  }

  const onSubmit = async (data: FormData) => {
    if (!validateVars()) {
      return
    }

    setIsPending(true)
    let res
    if (initialData?.id) {
      res = await updateEmailTemplateAction(initialData.id, data)
    } else {
      res = await createEmailTemplateAction(data)
    }
    
    setIsPending(false)

    if (res.success) {
      toast.success(`Template ${initialData?.id ? "actualizado" : "creado"} exitosamente`)
      router.push("/email-templates")
    } else {
      toast.error(res.error)
    }
  }

  const insertVariable = (variable: string) => {
    // Inserta al final del bodyHtml por simplicidad, ojalá en pos del cursor, pero en textareas nativos es complejo
    const currentBody = form.getValues("bodyHtml")
    form.setValue("bodyHtml", `${currentBody} {{${variable}}}`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.legalName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Template</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Recordatorio Vencimiento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asunto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Factura {{ticket_number}}" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Marcar como Por Defecto
                    </FormLabel>
                    <FormDescription>
                      Este template se seleccionará por defecto al enviar un ticket para esta empresa.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <div className="rounded-md border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Variables Disponibles</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map(v => (
                  <Badge 
                    key={v} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => insertVariable(v)}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
            
            {validationErrors.length > 0 && (
              <div className="rounded-md border border-destructive p-4 bg-destructive/10">
                <p className="text-sm font-medium text-destructive mb-1">Variables no reconocidas:</p>
                <div className="flex flex-wrap gap-2">
                  {validationErrors.map(err => (
                    <Badge key={err} variant="destructive">
                      {err}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="bodyHtml"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuerpo (HTML)</FormLabel>
                  <FormControl>
                    <textarea 
                      className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono" 
                      placeholder="<p>Hola {{client_name}}, ...</p>" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="rounded-md border h-[300px] flex flex-col overflow-hidden">
              <div className="bg-muted px-4 py-2 border-b text-sm font-medium">
                Vista Previa HTML
              </div>
              <div className="flex-1 bg-white p-4 overflow-auto">
                 {/* Security note: using iframe srcdoc to avoid polluting the app styles, dangerouslySetInnerHTML could break Next's layout */}
                <iframe
                  srcDoc={bodyHtml}
                  className="w-full h-full border-none"
                  title="Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={validateVars}>
            Validar variables
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar Template"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/email-templates")}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}

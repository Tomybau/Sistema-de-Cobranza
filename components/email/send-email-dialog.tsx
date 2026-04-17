"use client"

import { useState } from "react"
import { Send, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { sendTicketEmailAction } from "@/app/actions/email-send"

interface SendEmailDialogProps {
  ticketId: string
  templates: { id: string; name: string; isDefault: boolean; subject: string }[]
  disabled?: boolean
}

export function SendEmailDialog({ ticketId, templates, disabled }: SendEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  
  const defaultTemplateId = templates.find(t => t.isDefault)?.id || templates[0]?.id || ""
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplateId)

  const handleSend = async () => {
    if (!selectedTemplate) return

    setIsPending(true)
    const res = await sendTicketEmailAction(ticketId, selectedTemplate)
    setIsPending(false)

    if (res.success) {
      toast.success("Email enviado exitosamente")
      setOpen(false)
    } else {
      toast.error(res.error)
    }
  }

  const selectedTpl = templates.find(t => t.id === selectedTemplate)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={disabled || templates.length === 0} title={templates.length === 0 ? "No hay templates para esta empresa" : disabled ? "No se puede enviar email para DRAFT/CANCELLED" : ""} />
        }
      >
        <Send className="mr-2 h-4 w-4" />
        Enviar Email
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Email al Cliente</DialogTitle>
          <DialogDescription>
            Seleccione el template para enviar por correo electrónico. Las variables correspondientes serán reemplazadas automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Template a utilizar</label>
            <Select value={selectedTemplate} onValueChange={(v) => { if (v !== null) setSelectedTemplate(v) }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.isDefault && "(Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTpl && (
            <div className="rounded-md border p-3 bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Preview aproximada del asunto:</p>
              <p className="text-sm font-medium">{selectedTpl.subject}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!selectedTemplate || isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Confirmar Envío"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

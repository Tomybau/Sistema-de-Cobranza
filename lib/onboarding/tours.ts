// Definición de tours por sección. Cada tour tiene pasos con selector + popover.
// Los selectores buscan `[data-tour="<id>"]` en el DOM.

export interface TourStep {
  selector: string
  title: string
  description: string
  side?: "top" | "right" | "bottom" | "left"
}

export interface Tour {
  id: string
  steps: TourStep[]
}

export const TOURS: Record<string, Tour> = {
  dashboard: {
    id: "dashboard",
    steps: [
      {
        selector: '[data-tour="kpi-cards"]',
        title: "KPIs del mes",
        description:
          "Acá ves cuánto facturaste, cuánto cobraste, la tasa de cobro y los vencidos del mes actual.",
      },
      {
        selector: '[data-tour="company-filter"]',
        title: "Filtrar por empresa",
        description:
          "Cambiá los KPIs y gráficos para ver solo lo de una empresa específica.",
      },
    ],
  },

  companies: {
    id: "companies",
    steps: [
      {
        selector: '[data-tour="companies-table"]',
        title: "Empresas",
        description:
          "Acá están todas las empresas clientes con sus totales facturados, cobrados y morosidad.",
      },
      {
        selector: '[data-tour="new-company"]',
        title: "Nueva empresa",
        description:
          "Cargá una empresa cliente nueva. Después podés crear contratos y contactos asociados.",
      },
    ],
  },

  contractDetail: {
    id: "contractDetail",
    steps: [
      {
        selector: '[data-tour="add-item"]',
        title: "Agregar item",
        description:
          "Un contrato se compone de items. Cada item (fijo, variable, único o cuotas) genera tickets de cobro periódicos.",
      },
      {
        selector: '[data-tour="generate-tickets"]',
        title: "Generar tickets",
        description:
          "Cuando llega el período de facturación, generá los tickets de los items recurrentes. Si son variables, te va a pedir la cantidad.",
      },
    ],
  },

  tickets: {
    id: "tickets",
    steps: [
      {
        selector: '[data-tour="tickets-filters"]',
        title: "Filtros",
        description:
          "Buscá por número, empresa o ítem. También filtrás por estado.",
      },
      {
        selector: '[data-tour="generate-all"]',
        title: "Generar tickets de todos los contratos",
        description:
          "Generá tickets del período seleccionado para todos los contratos activos en un solo paso.",
      },
    ],
  },

  payments: {
    id: "payments",
    steps: [
      {
        selector: '[data-tour="new-payment"]',
        title: "Registrar pago",
        description:
          "Cargá un pago recibido. Vas a poder seleccionar a qué tickets se aplica y el sistema actualiza el estado de cada uno.",
      },
    ],
  },
}

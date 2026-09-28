export type LeadResource = {
  slug: string;
  title: string;
  description: string;
  href: string;
  cta: string;
};

const SITE_URL = "https://doscientos.es";

const RESOURCES = {
  "calculadora-coste-oculto": {
    slug: "calculadora-coste-oculto",
    title: "Calculadora del coste del trabajo manual",
    description:
      "Calcula cuántas horas y cuánto dinero consume cada año ese proceso repetitivo de tu equipo.",
    href: `${SITE_URL}/automatizar-excel?ref=email-confirmacion#calculadora-coste`,
    cta: "Abrir calculadora",
  },
  "recurso-checklist-crm-excel": {
    slug: "recurso-checklist-crm-excel",
    title: "Checklist para saber si Excel ya no puede ser tu CRM",
    description:
      "Senales, riesgos y criterios para decidir si toca pasar de una hoja a un sistema trazable.",
    href: `${SITE_URL}/recursos/excel-como-crm-cuando-cambiar?ref=email-recurso-crm`,
    cta: "Abrir checklist",
  },
  "recurso-guia-mvp": {
    slug: "recurso-guia-mvp",
    title: "Guia para validar un MVP sin construir de mas",
    description:
      "Una estructura de 6 semanas para validar alcance, usuarios, metricas y siguiente decision.",
    href: `${SITE_URL}/recursos/validar-mvp-6-semanas?ref=email-recurso-mvp`,
    cta: "Abrir guia",
  },
  "recurso-guia-coste-app": {
    slug: "recurso-guia-coste-app",
    title: "Guia de presupuesto para una app en 2026",
    description: "Rangos, partidas y decisiones que cambian el coste antes de pedir presupuesto.",
    href: `${SITE_URL}/recursos/cuanto-cuesta-desarrollar-app-2026?ref=email-recurso-coste-app`,
    cta: "Abrir guia",
  },
  "recurso-plantilla-saas-vs-medida": {
    slug: "recurso-plantilla-saas-vs-medida",
    title: "Plantilla para comparar SaaS vs software a medida",
    description:
      "Una matriz simple para comparar coste total, control, integraciones, riesgo y dependencia.",
    href: `${SITE_URL}/recursos/software-a-medida-vs-saas?ref=email-recurso-saas-vs-medida`,
    cta: "Abrir plantilla",
  },
  "recurso-checklist-automatizacion": {
    slug: "recurso-checklist-automatizacion",
    title: "Checklist para elegir que automatizar primero",
    description:
      "Puntua procesos por horas, riesgo, frecuencia y retorno antes de invertir en software.",
    href: `${SITE_URL}/recursos/automatizacion-procesos-empresariales?ref=email-recurso-automatizacion`,
    cta: "Abrir checklist",
  },
} satisfies Record<string, LeadResource>;

type SelectLeadResourceInput = {
  resourceSlug?: string | null;
  landingRef?: string | null;
  landingSubject?: string | null;
  calculatorCost?: string | null;
  calculatorHours?: string | null;
  language?: "es" | "ca" | "en" | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function selectLeadResource(input: SelectLeadResourceInput): LeadResource {
  const chosen = (slug: keyof typeof RESOURCES): LeadResource => {
    const resource = RESOURCES[slug];
    if (input.language !== "ca" && input.language !== "en") return resource;
    const localeCopy: Record<string, { title: string; description: string; cta: string }> =
      input.language === "ca"
        ? {
            "calculadora-coste-oculto": {
              title: "Calculadora del cost del treball manual",
              description:
                "Calcula quantes hores i quants diners consumeix cada any aquest procés repetitiu del teu equip.",
              cta: "Obrir la calculadora",
            },
            "recurso-checklist-crm-excel": {
              title: "Llista per saber si Excel ja no et serveix de CRM",
              description:
                "Senyals, riscos i criteris per decidir si cal passar d’un full de càlcul a un sistema traçable.",
              cta: "Obrir la llista",
            },
            "recurso-guia-mvp": {
              title: "Guia per validar un MVP sense construir de més",
              description:
                "Una estructura de 6 setmanes per validar l’abast, els usuaris, les mètriques i la propera decisió.",
              cta: "Obrir la guia",
            },
            "recurso-guia-coste-app": {
              title: "Guia de pressupost per a una app el 2026",
              description:
                "Rangs, partides i decisions que canvien el cost abans de demanar pressupost.",
              cta: "Obrir la guia",
            },
            "recurso-plantilla-saas-vs-medida": {
              title: "Plantilla per comparar SaaS i programari a mida",
              description:
                "Una matriu senzilla per comparar el cost total, el control, les integracions, els riscos i la dependència.",
              cta: "Obrir la plantilla",
            },
            "recurso-checklist-automatizacion": {
              title: "Llista per triar què automatitzar primer",
              description:
                "Puntua els processos per hores, risc, freqüència i retorn abans d’invertir en programari.",
              cta: "Obrir la llista",
            },
          }
        : {
            "calculadora-coste-oculto": {
              title: "Manual work cost calculator",
              description:
                "Estimate the hours and money your team spends each year on a repetitive process.",
              cta: "Open calculator",
            },
            "recurso-checklist-crm-excel": {
              title: "Checklist: has Excel stopped working as your CRM?",
              description:
                "Signals, risks, and criteria to decide whether to move from a spreadsheet to a traceable system.",
              cta: "Open checklist",
            },
            "recurso-guia-mvp": {
              title: "Guide to validating an MVP without overbuilding",
              description:
                "A six-week structure to validate scope, users, metrics, and the next decision.",
              cta: "Open guide",
            },
            "recurso-guia-coste-app": {
              title: "App budgeting guide for 2026",
              description:
                "Price ranges, cost items, and decisions that affect the budget before you ask for one.",
              cta: "Open guide",
            },
            "recurso-plantilla-saas-vs-medida": {
              title: "Template to compare SaaS and custom software",
              description:
                "A simple matrix to compare total cost, control, integrations, risk, and dependency.",
              cta: "Open template",
            },
            "recurso-checklist-automatizacion": {
              title: "Checklist for choosing what to automate first",
              description:
                "Score processes by time, risk, frequency, and return before investing in software.",
              cta: "Open checklist",
            },
          };
    return { ...resource, ...localeCopy[slug] };
  };
  if (input.resourceSlug && input.resourceSlug in RESOURCES) {
    return chosen(input.resourceSlug as keyof typeof RESOURCES);
  }

  if (input.calculatorCost || input.calculatorHours || input.landingRef?.includes("calculadora")) {
    return chosen("calculadora-coste-oculto");
  }

  const text = normalize([input.landingRef, input.landingSubject].filter(Boolean).join(" "));
  if (text.includes("crm") || text.includes("excel") || text.includes("renovacion")) {
    return chosen("recurso-checklist-crm-excel");
  }
  if (text.includes("mvp") || text.includes("app")) {
    return chosen("recurso-guia-mvp");
  }
  if (text.includes("saas") || text.includes("medida")) {
    return chosen("recurso-plantilla-saas-vs-medida");
  }

  return chosen("recurso-checklist-automatizacion");
}

import { Card, CardContent } from '@/components/ui/card'
import { getQuarterlyVatForecast } from '@/lib/finance/quarterly-vat-query'
import { formatEUR } from '@/lib/utils'

export async function QuarterlyVatForecast() {
  const forecast = await getQuarterlyVatForecast()
  const date = forecast.today.split('-').reverse().join('/')

  return (
    <section aria-labelledby="quarterly-vat-title">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h2 id="quarterly-vat-title" className="text-lg font-semibold">
              Previsión de IVA · {forecast.period.label}
            </h2>
            <p className="text-sm text-muted-foreground">Datos registrados hasta el {date}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">IVA facturado</p>
              <p className="text-lg font-semibold tabular-nums">{formatEUR(forecast.charged)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">IVA en gastos</p>
              <p className="text-lg font-semibold tabular-nums">{formatEUR(forecast.paid)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo acumulado</p>
              <p className="text-lg font-semibold tabular-nums">{formatEUR(forecast.balance)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Previsión a reservar</p>
              <p className="text-2xl font-semibold tabular-nums">{formatEUR(forecast.reserve)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Proyección lineal del saldo acumulado ({forecast.elapsedDays} de {forecast.totalDays}{' '}
            días). Si el saldo previsto es negativo, se recomienda reservar 0 €. Incluye facturas
            emitidas y gastos no cancelados, estén o no pagados; excluye documentos con fecha
            futura. La estimación puede variar mucho al inicio del trimestre.
          </p>
          <p className="text-xs text-muted-foreground">
            Orientativo: supone deducible todo el IVA registrado en gastos y no contempla ajustes ni
            saldos de trimestres anteriores. La gestoría debe revisar la liquidación definitiva.
          </p>
          {forecast.excludedCurrencyCount > 0 && (
            <p className="text-xs text-destructive">
              {forecast.excludedCurrencyCount} documentos en otra moneda o sin moneda quedan fuera:
              no se convierten a euros.
            </p>
          )}
          {forecast.missingTaxCount > 0 && (
            <p className="text-xs text-destructive">
              {forecast.missingTaxCount} documentos sin IVA válido quedan fuera del cálculo.
            </p>
          )}
          {forecast.rectificationCount > 0 && (
            <p className="text-xs text-destructive">
              Hay facturas rectificativas: se usan sus importes registrados. Revisa su tratamiento
              con la gestoría.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

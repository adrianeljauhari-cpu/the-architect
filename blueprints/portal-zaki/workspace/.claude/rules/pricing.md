---
description: Pricing cascade, offers resolution and money math
paths:
  - "src/lib/pricing/**"
  - "src/lib/money.ts"
---

# Motor de precios (la parte más delicada)

- La cascada es **multiplicativa**, no aditiva:
  `neto_unit = prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)`. `0+6+17+12` NO es 35%.
- Posiciones: p1 = oferta `pos_ofer=0` (proveedor); **p2 = 0 (confirmado: `descuen` vacía)**;
  p3 = oferta `pos_ofer=1` (droguería); p4 = `customers.desc_glob`.
- **Las ofertas se aplican por SEGMENTO del cliente**, no por texto: una oferta aplica cuando
  `customers.co_seg` cae en `[co_seg_d, co_seg_h]` **o** el `co_cli` en `[co_cli_d, co_cli_h]`, y el
  producto entra en su alcance. Segmentos: 10=A, 20=B, 30=C, 40=D, 60=NUEVO, **70=EXCLUIDOS**.
- **EXCLUIDOS = segmento 70:** un cliente de segmento 70 solo toma ofertas de segmento 70. No hay
  emparejamiento por texto ni lógica de "gemela EXCLUIDOS".
- `oferta_cli` aplica por tipo/grupo (`tipo_d/h`) o por cliente (`co_cli_d/h`). *La regla de
  combinación con las ofertas por segmento se confirma antes del corte.*
- Solo ofertas **vigentes**: `now` entre `fec_inic` y `fec_fin`. Nunca traer `offer_lines` sin filtrar
  por vigencia.
- Tope `product_caps.porc_max`: **no-op en v1 (`art_ext` vacía)**; la función lo aplica defensivamente
  si algún día hay datos.
- 1% global: solo si `customers.cond_1pct`. Se aplica al subtotal del pedido, no por línea.
- Aritmética con `big.js`: `Big(prec).times(...)`, redondeo a 2 con `toFixed(2)` para netos/totales.
  Nunca floats, nunca sumar porcentajes.
- Los tests al céntimo de `tests/unit/pricing.test.ts` (5 líneas de factura reales) son sagrados; si
  cambian, algo está mal.

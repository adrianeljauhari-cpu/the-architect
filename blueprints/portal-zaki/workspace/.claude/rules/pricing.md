---
description: Pricing cascade, offers resolution and money math
paths:
  - "src/lib/pricing/**"
  - "src/lib/money.ts"
---

# Motor de precios (la parte más delicada)

- La cascada es **multiplicativa**, no aditiva:
  `neto_unit = prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)`. `0+6+17+12` NO es 35%.
- Posiciones: p1 = oferta `pos_ofer=0` (proveedor); p2 = escalas de volumen (**0 en v1**, fuera de
  alcance); p3 = oferta `pos_ofer=1` (droguería); p4 = `customers.desc_glob`.
- **Ofertas en pares EXCLUIDOS:** cada oferta tiene una gemela "EXCLUIDOS". Si un artículo está en la
  oferta general Y en su gemela de excluidos, **manda la exclusión** (esa posición aporta 0). Olvidarlo
  vende bajo costo.
- Solo ofertas **vigentes**: `now` entre `fec_inic` y `fec_fin`. Nunca traer `offer_lines` sin filtrar
  por vigencia.
- Tope: aplicar `product_caps.porc_max` como techo duro sobre el descuento total (productos regulados).
- 1% global: solo si `customers.cond_1pct`. Se aplica al subtotal del pedido, no por línea.
- Aritmética con `big.js`: `Big(prec).times(...)`, redondeo a 2 con `toFixed(2)` para netos/totales.
  Nunca floats, nunca sumar porcentajes.
- Los tests al céntimo de `tests/unit/pricing.test.ts` (5 líneas de factura reales) son sagrados; si
  cambian, algo está mal.

---
description: On-prem Profit sync agent conventions
paths:
  - "src/agent/**"
---

# Agente de sincronización on-prem

- **Solo lectura** de Profit Plus. El agente jamás hace INSERT/UPDATE/DELETE en SQL Server.
- Lee incremental por `row_id` (rowversion): `WHERE row_id > @cursor ORDER BY row_id`. Guarda el cursor
  por tabla; nunca reenvía el catálogo completo si hay `row_id`.
- Los códigos `char` de Profit vienen con relleno de espacios: aplicar `RTRIM` a `co_art`, `co_cli`,
  `co_ofer` antes de emitir.
- Disponible: `stock_act - stock_com`, nunca negativo (mostrar 0).
- Sincronizar `clientes.co_seg` (segmento) y los rangos de `oferta` (`co_seg_d/h`, `co_cli_d/h`). Las
  ofertas se aplican por segmento del cliente; **EXCLUIDOS = segmento 70**, no por texto.
- Tasa de cambio: leer de la tabla **`tasas`** (la actualiza un operador a las 12:00).
- Empuje al portal: arma lote con `event_id` (uuid), firma HMAC con `SYNC_SHARED_SECRET`, POST a
  `INGEST_URL`. El agente carga env con `import "dotenv/config"`.
- **SQL Server 2019 Enterprise (confirmado):** TLS estándar del driver `mssql`; sin workaround legacy.
  `trustServerCertificate=true` solo si hay certificado autofirmado. Nunca exponer el SQL Server.
- Sin React, sin `components/`. Comparte solo `src/lib/db/schema.ts`, `src/lib/env.ts`, `src/lib/money.ts`.

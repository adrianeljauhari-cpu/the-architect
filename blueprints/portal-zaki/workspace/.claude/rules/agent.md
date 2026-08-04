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
- `is_exclusion`: derivar si `ofer_des` termina en "EXCLUIDOS" (frágil; documentado como riesgo).
- Empuje al portal: arma lote con `event_id` (uuid), firma HMAC con `SYNC_SHARED_SECRET`, POST a
  `INGEST_URL`. El agente carga env con `import "dotenv/config"`.
- TLS legacy: SQL Server 2005/2008 puede requerir `options.encrypt=false` y
  `options.trustServerCertificate=true`. Solo válido dentro de la red local; nunca exponer el SQL Server.
- Sin React, sin `components/`. Comparte solo `src/lib/db/schema.ts`, `src/lib/env.ts`, `src/lib/money.ts`.

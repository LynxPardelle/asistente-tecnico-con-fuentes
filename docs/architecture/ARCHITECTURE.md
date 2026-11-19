# Arquitectura de Asistente Técnico con Fuentes

## Contexto y límites

La persona administradora publica documentación privada en una base de su organización. Una persona con acceso a esa base pregunta por un procedimiento y abre los fragmentos que respaldan la respuesta. La aplicación necesita distinguir versiones documentales, permisos y consumo del modelo en cada solicitud.

El primer piloto supone hasta 200 documentos de texto o Markdown y 10 MiB de texto extraído por revisión de base. Son límites de diseño para medir latencia y precisión con un índice que quepa en la memoria de Lambda. El aumento de corpus se decide con las medidas del piloto. La documentación de clientes requiere una incorporación autorizada y una política de retención acordada.

## Componentes

| Componente | Responsabilidad | Entrega actual |
| --- | --- | --- |
| Angular standalone y NgRx SignalStore | Navegar bases autorizadas, consultar, mostrar citas y estado de ingesta. | Pantalla de arranque y comprobación de salud. |
| API Gateway HTTP API y Lambda Node.js 24 | Atender solicitudes y aplicar autorización por organización y base. | `GET /api/health` público y sin datos de negocio. |
| Bucket S3 privado | Originales versionados y artefactos de extracción por revisión. | Recurso privado con bloqueo público, SSE y versionado. |
| DynamoDB bajo demanda | Metadatos, permisos, revisión publicada, consumo e idempotencia. | Tabla cifrada con recuperación puntual. |
| SQS, Lambda de ingesta y DLQ | Procesar extracción y reintentos por versión de objeto. | Diseño y tareas de fase 2. |
| Lambda de consulta | Recuperar fragmentos y validar resultado. | Contrato y validador de dominio puro. |
| Proveedor de modelo por solicitud | Generar una respuesta acotada con citas. | Selección y conexión pendientes de la fase 4. |

La plantilla actual solo expone salud y concede a esa Lambda escritura en su grupo de logs. La ingesta, los permisos de datos y las llamadas a un modelo se incorporan con sus pruebas. API y Lambda conservan logs durante 14 días.

[Diagrama Mermaid](diagram.mmd) · [ADR de recuperación por revisión](adr/0001-recuperacion-por-revision.md)

## Ingesta privada y publicación

1. Una ruta autenticada crea el registro de fuente con organización y base derivadas del contexto validado. Genera un identificador opaco y una URL de carga breve limitada a una clave y tamaño autorizados.
2. El objeto se carga en `sources/<tenantId>/<knowledgeBaseId>/<sourceId>/original`. La revisión documental referencia el `versionId` de S3 y su checksum.
3. La notificación de objeto llega a SQS. El worker verifica que bucket, clave, versión y registro de carga coincidan. El texto del archivo y sus metadatos carecen de autoridad para seleccionar organización o permisos.
4. La extracción produce fragmentos con identificador, texto y localizador reproducible en el documento. Escribe un manifiesto con checksum y un índice léxico inmutable en `indexes/<tenantId>/<knowledgeBaseId>/<revisionId>/`.
5. La persona administradora revisa las fuentes y publica el manifiesto cuando todas sus entradas estén listas. Una condición en DynamoDB cambia el puntero a la nueva revisión. Los documentos en proceso o retirados quedan fuera de la recuperación.

Los eventos pueden repetirse o llegar desordenados. La clave de idempotencia de extracción combina organización, base, fuente y versión exacta del objeto. El worker reclama trabajo con una condición y una concesión con vencimiento comprobado. Solo un propietario vigente puede marcar ese trabajo como listo. La expiración TTL es limpieza, no un mecanismo de exclusión.

La cola futura configura `ReportBatchItemFailures`, tiempo de visibilidad de al menos seis veces el timeout de Lambda y DLQ tras cinco intentos. El replay usa el mismo identificador y vuelve a validar el registro antes de escribir. El bucket de origen y los prefijos de índices son distintos para evitar que un índice vuelva a disparar la ingesta. [Procesamiento SQS y reintentos](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html) · [Configuración de SQS para Lambda](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html)

## Recuperación y generación

La primera recuperación usa un índice léxico de términos y localizadores, almacenado en S3 por revisión y cargado en memoria de Lambda. Filtra por organización, base, permiso y estado antes de seleccionar hasta ocho fragmentos de 8.000 caracteres como máximo cada uno. Un corpus que supere el límite o un índice ausente produce una respuesta de disponibilidad o abstención, sin escanear otra organización.

El servidor obtiene el puntero de revisión desde DynamoDB con lectura consistente. Un caché en memoria se identifica por organización, base y revisión inmutable. El permiso y el estado vigente de las fuentes se comprueban en cada solicitud. Un retiro inmediato deshabilita la fuente aunque el índice anterior siga disponible. Después de generar se vuelven a comprobar permisos y estado antes de entregar citas.

La solicitud al modelo delimita pregunta y fragmentos como datos de menor confianza. El contenido documental puede incluir instrucciones hostiles y jamás autoriza herramientas, acceso a red, ejecución de código, cambios de permisos ni cambios de cuotas. La respuesta se pide como afirmaciones con citas. El backend valida ese contrato y la aplicación representa texto mediante interpolación, sin insertar HTML del modelo.

Si la recuperación no alcanza el umbral calibrado o el validador falla, la respuesta es una abstención. Para abrir una cita, una ruta autorizada consulta la misma revisión y fragmento y genera acceso temporal a esa versión de origen. Los enlaces los construye el servidor desde metadatos verificados. El modelo entrega identificadores y texto citado.

El primer índice evita una base vectorial de capacidad permanente. Una búsqueda vectorial administrada con cobro por uso o artefactos vectoriales acotados en S3 puede evaluarse si la recuperación léxica pierde consultas relevantes. La decisión depende del conjunto de evaluación y costo observados.

## Contratos previstos

La ruta de salud implementada es `GET /api/health`. Las rutas siguientes corresponden a las próximas fases.

| Ruta | Operación |
| --- | --- |
| `POST /api/v1/knowledge-bases/{baseId}/sources` | Autorizar una carga y crear la fuente. |
| `GET /api/v1/knowledge-bases/{baseId}/sources` | Consultar estado de ingesta paginado. |
| `POST /api/v1/knowledge-bases/{baseId}/revisions` | Publicar una revisión con condición sobre la revisión anterior. |
| `POST /api/v1/knowledge-bases/{baseId}/questions` | Recuperar y producir respuesta o abstención con `Idempotency-Key`. |
| `GET /api/v1/knowledge-bases/{baseId}/citations/{citationId}` | Leer un fragmento autorizado de su revisión. |
| `GET /api/v1/usage` | Consultar consumo de la organización verificada. |

El contexto de dominio es `{ tenantId, knowledgeBaseId, revisionId }`, derivado por el servidor. Un fragmento contiene esos campos más `sourceId`, `sourceRevisionId`, `chunkId`, `status` y `text`. Solo `status=published` es elegible para la revisión seleccionada.

El modelo devuelve `{ claims: [{ text, citations: [{ sourceId, sourceRevisionId, chunkId, quote }] }] }`. El validador permite hasta ocho afirmaciones, tres citas por afirmación y 1.500 caracteres por afirmación o cita. Una cita debe identificar un fragmento elegible y su texto debe ser una subcadena exacta. Claves de fragmento duplicadas producen abstención por evidencia ambigua.

El resultado tiene `status=answered` con las afirmaciones validadas o `status=abstained` con un motivo interno y un mensaje fijo. El dominio comprueba procedencia estructural. Las pruebas de evaluación deben medir por separado si el fragmento sustenta el significado de la afirmación. Aceptar una cita textual válida no acredita por sí solo esa correspondencia.

## Metadatos y aislamiento

| Registro | PK | SK |
| --- | --- | --- |
| Pertenencia a la base | `TENANT#<tenantId>#MEMBER#<subjectId>` | `KB#<baseId>` |
| Configuración y puntero publicado | `TENANT#<tenantId>#KB#<baseId>` | `META` |
| Fuente | `TENANT#<tenantId>#KB#<baseId>` | `SOURCE#<sourceId>` |
| Trabajo de extracción | `TENANT#<tenantId>#KB#<baseId>` | `INGEST#<sourceId>#<sourceVersionId>` |
| Revisión | `TENANT#<tenantId>#KB#<baseId>` | `REVISION#<revisionId>` |
| Reserva y resultado de consulta | `TENANT#<tenantId>#REQUEST#<requestId>` | `META` |
| Consumo diario | `TENANT#<tenantId>` | `USAGE#<YYYY-MM-DD UTC>` |

Los roles de consulta e ingesta usan recursos de su ambiente y operaciones necesarias. La membresía se verifica antes de construir claves. Un `baseId` externo o una versión incluida en la pregunta carecen de autoridad para alterar ese contexto. El estado de cuota se lee con consistencia y se actualiza transaccionalmente. Los logs contienen identificador de solicitud, fase, latencia, tokens y resultado, conservando fuera del log las preguntas y los fragmentos privados.

## Cuotas y costo

Antes de llamar a un modelo, el servidor crea una reserva idempotente y descuenta el máximo previsto mediante una transacción condicional. La política de la organización fija solicitudes diarias, límite de tokens de entrada y salida, límite de ingesta y presupuesto diario en unidades monetarias enteras. La ausencia de una política válida impide la llamada.

La reserva usa precio y versión de modelo explícitos y límites de contexto verificados con el contador del proveedor elegido. El identificador de idempotencia queda asociado al hash de pregunta, revisión y actor. Un reintento idéntico devuelve el trabajo o resultado existente y un contenido diferente devuelve `409`.

Al terminar se reconcilia uso real contra la reserva. Si un timeout deja incierto el consumo del proveedor, la reserva se conserva para conciliación y no se libera ni se repite la llamada automáticamente. Las abstenciones previas al modelo consumen la capacidad de API definida por la política y cero tokens de inferencia. El tamaño acotado de índice y contexto reduce el trabajo por consulta. [Transacciones e idempotencia en DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html)

## Ambientes y operación

Cada ambiente usa su propio stack, tabla, bucket y logs. `development` y `testing` corresponden a sus ramas homónimas y `production` a `main`. Los recursos de datos tienen retención al eliminar o reemplazar el stack. La retirada de datos requiere contemplar versiones antiguas del bucket y su política de retención.

La verificación local cubre dominio, frontend y template. El ensayo de un ambiente debe probar identidad, acceso cruzado, publicación concurrente, eventos duplicados, replay de DLQ, reserva de cuota, cita revocada y recuperación del manifiesto publicado antes de incorporar fuentes privadas.

---
goal: Primera consulta técnica privada con citas verificables
version: '1.0'
date_created: '2026-11-19'
last_updated: '2026-11-19'
owner: ZooBeriah Systems
status: 'In progress'
tags: [architecture, feature, serverless, rag]
---

# Introduction

La base incorpora Angular, salud HTTP, almacenamiento privado y validación pura de citas. Las siguientes fases construyen la ingesta y consulta de una revisión publicada, verifican aislamiento y fijan el costo por consulta antes del piloto.

## 1. Requirements & Constraints

- **REQ-001** La persona administradora carga fuentes privadas, comprueba la extracción y publica una revisión de base.
- **REQ-002** Una consulta usa únicamente fuentes permitidas de la organización, base y revisión seleccionadas por el servidor.
- **REQ-003** Cada afirmación requiere citas verificables. La ausencia de evidencia suficiente produce abstención.
- **SEC-001** Los documentos son datos. El contenido de una fuente no concede permisos ni autoriza herramientas.
- **SEC-002** Validar membresía y estado de fuente antes de recuperar y antes de entregar la respuesta.
- **CON-001** La base usa Node.js 24, Angular 22.3, NgRx 22 y ejecución por solicitud. El primer índice es léxico y reside en S3.
- **CON-002** La política por organización fija cuotas y presupuesto. Una solicitud requiere una reserva transaccional idempotente antes de llamar al modelo.
- **CON-003** Desarrollo y testing usan sus ramas homónimas. Producción recibe `main`. Cada ambiente conserva almacenamiento separado.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001** Verificar la base local con el contrato de salud y el dominio puro.

| Tarea | Entrega | Completada | Fecha |
| --- | --- | --- | --- |
| TASK-001 | Entregar producto, arquitectura, ADR y diagramas en `docs/`; conservar sincronizados `infra/template.yaml`, `infra/environments.json` y `infra/samconfig.toml`. | Sí | 2026-11-19 |
| TASK-002 | Implementar `services/domain/grounded-answer.mjs` y probar citas ajenas, revisiones antiguas, fragmentos inventados, afirmaciones sin cita y abstención. | Sí | 2026-11-19 |
| TASK-003 | Verificar salud, instalación reproducible, tests y build Angular, validación SAM y correspondencia de los tres ambientes. Registrar resultados y límites de ejecución en el cierre de la base. | Sí | 2026-11-19 |

### Implementation Phase 2

- **GOAL-002** Cargar y publicar una revisión privada reproducible. Depende de la fase 1.

| Tarea | Entrega | Completada | Fecha |
| --- | --- | --- | --- |
| TASK-004 | Agregar a `infra/template.yaml` autorizador y rutas de fuentes en `services/sources/`. Crear registros y URLs de carga limitadas a clave y tamaño desde la organización verificada. | Pendiente | |
| TASK-005 | Agregar SQS, DLQ y worker en `services/ingestion/`. Extraer texto y Markdown por versión S3, validar tamaños y checksum, y producir fragmentos con localizadores e índice inmutable. Usar idempotencia, concesión con vencimiento y respuestas parciales de lote. | Pendiente | |
| TASK-006 | Implementar publicación condicional de manifiestos listos en `services/sources/publish.mjs` y UI de carga/estado en `web/src/app/features/sources/`. Probar duplicados, carga fuera de base, evento de otra organización y publicaciones concurrentes. | Pendiente | |

### Implementation Phase 3

- **GOAL-003** Recuperar fragmentos autorizados y abrir sus citas. Depende de la fase 2.

| Tarea | Entrega | Completada | Fecha |
| --- | --- | --- | --- |
| TASK-007 | Implementar índice léxico acotado en `services/retrieval/` con límite inicial de 200 documentos y 10 MiB de texto. Obtener el puntero publicado con lectura consistente, aplicar permisos y recuperar hasta ocho fragmentos. | Pendiente | |
| TASK-008 | Implementar ruta de cita en `services/citations/` y UI de fragmentos en `web/src/app/features/questions/`. Derivar enlaces desde metadatos autorizados de la misma revisión y probar fuente revocada entre consulta y apertura. | Pendiente | |

### Implementation Phase 4

- **GOAL-004** Incorporar generación y cuotas con evidencia evaluada. Depende de la fase 3.

| Tarea | Entrega | Completada | Fecha |
| --- | --- | --- | --- |
| TASK-009 | Crear `services/usage/` para reserva idempotente, presupuesto diario UTC, reconciliación de tokens y resultado persistido. Probar solicitudes concurrentes sobre la última cuota y un timeout con consumo incierto. | Pendiente | |
| TASK-010 | Crear adaptador de modelo en `services/generation/` con precio/versionado explícitos y máximos de entrada/salida. Recuperar antes de generar, tratar contexto como datos y validar cada afirmación con el dominio. Limitar IAM al modelo elegido. | Pendiente | |
| TASK-011 | Crear `services/evaluation/` con al menos 30 preguntas sintéticas etiquetadas, incluidos ausencia de respuesta, fuente retirada, fuente ajena e instrucciones hostiles en documentos. Medir recuperación, respaldo semántico de cada afirmación y costo. Bloquear el piloto si aparece una respuesta ajena o una instrucción documental ejecutada. | Pendiente | |

### Implementation Phase 5

- **GOAL-005** Verificar el flujo con un comprador y fuentes autorizadas. Depende de la fase 4.

| Tarea | Entrega | Completada | Fecha |
| --- | --- | --- | --- |
| TASK-012 | Preparar un ambiente de prueba aislado, usuarios de dos organizaciones y corpus sintéticos. Ensayar restauración del manifiesto, replay de DLQ, retiro de fuente y límites de consumo. | Pendiente | |
| TASK-013 | Incorporar una familia de manuales de un equipo que autorice el piloto. Registrar tiempo de búsqueda, consultas con respaldo verificable, abstenciones, errores detectados y costo por consulta. Obtener una decisión del comprador sobre renovación con precio explícito. | Pendiente | |

## 3. Alternatives

- **ALT-001** Buscador vectorial gestionado. Evaluarlo con el corpus y las medidas de recuperación cuando el índice léxico incumpla los objetivos.
- **ALT-002** Procesamiento síncrono del archivo al cargarlo. La cola prevista permite separar extracción, reintentos y publicación.
- **ALT-003** Entregar respuesta libre con una lista global de enlaces. El contrato elegido exige citas por afirmación y conserva el fragmento exacto.

## 4. Dependencies

- **DEP-001** Node.js 24, lockfile Angular/NgRx y pruebas locales de salud.
- **DEP-002** Proveedor de identidad, membresías y fuentes autorizadas para el ambiente de prueba.
- **DEP-003** Modelo por solicitud con tokens medibles y política de presupuesto válida para la fase 4.
- **DEP-004** Documentos sintéticos y evaluación etiquetada de respaldo semántico.

## 5. Files

- **FILE-001** `infra/template.yaml`, `infra/environments.json` y `infra/samconfig.toml`.
- **FILE-002** `services/domain/`, `services/sources/`, `services/ingestion/`, `services/retrieval/` y `services/citations/`.
- **FILE-003** `services/usage/`, `services/generation/` y `services/evaluation/`.
- **FILE-004** `web/src/app/features/sources/` y `web/src/app/features/questions/`.

## 6. Testing

- **TEST-001** Ejecutar `node --test services/domain/grounded-answer.test.mjs` y las pruebas de salud de la base.
- **TEST-002** Validar SAM y los parámetros de los tres ambientes, y compilar el frontend desde su lockfile.
- **TEST-003** Probar ingesta duplicada, evento fuera del prefijo, concurrencia de publicación y replay idempotente.
- **TEST-004** Probar organización ajena, membresía retirada y fuente revocada antes y después de generar.
- **TEST-005** Comparar cada afirmación con su cita en el conjunto etiquetado. Medir abstención ante fuentes insuficientes.
- **TEST-006** Probar reserva de la última cuota, reintento idéntico, hash distinto y consumo incierto sin liberar saldo.
- **TEST-007** Recorrer carga, publicación, consulta y apertura de cita con dos organizaciones de prueba.

## 7. Risks & Assumptions

- **RISK-001** Un fragmento textual válido puede respaldar una afirmación incorrecta. Evaluar correspondencia semántica además del validador estructural.
- **RISK-002** Un índice inmutable puede contener una fuente recién retirada. Comprobar su estado antes de entregar una respuesta o abrir una cita.
- **RISK-003** La recuperación léxica puede perder sinónimos. Medir consultas etiquetadas y conservar una abstención explícita.
- **ASSUMPTION-001** El primer corpus cabe en los límites documentados y los archivos iniciales son texto o Markdown.
- **ASSUMPTION-002** El comprador acepta un precio de prueba y comparte únicamente documentos autorizados.

## 8. Related Specifications / Further Reading

- [Producto](../docs/PRODUCTO.md)
- [Arquitectura](../docs/architecture/ARCHITECTURE.md)
- [ADR](../docs/architecture/adr/0001-recuperacion-por-revision.md)
- [Lambda y SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Transacciones de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html)

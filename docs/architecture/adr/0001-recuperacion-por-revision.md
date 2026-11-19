# ADR 0001. Recuperación acotada por revisión publicada

- Estado: aceptada para la base
- Fecha: 2026-11-19

## Contexto

El producto consulta manuales privados de organizaciones distintas. Necesita relacionar una respuesta con la versión exacta de cada fuente y mantener el consumo acotado. El corpus inicial es pequeño y su calidad de recuperación debe medirse antes de elegir un almacén de vectores.

## Decisión

Separar el plano HTTP de la ingesta asíncrona. Guardar documentos versionados y artefactos inmutables en S3 privado y permisos, estado, cuotas y puntero publicado en DynamoDB bajo demanda. Usar API Gateway y Lambda por solicitud.

La primera recuperación será léxica sobre un índice por organización, base y revisión que quepa en Lambda. La ingesta prevista pasa por SQS y Lambda con DLQ. La publicación cambia un puntero mediante una condición de concurrencia. La base entrega almacenamiento y salud, y mantiene las operaciones de conocimiento en el plan.

Cada afirmación generada requiere citas al corpus elegible. El validador puro verifica identificadores, revisión y texto exacto. La fidelidad semántica requiere un conjunto de evaluación propio antes de la llamada de generación del piloto.

## Alternativas y efectos

- Un buscador vectorial de capacidad permanente facilita recuperación semántica y escalado de corpus. Añade una base de costo antes de medir necesidad, tamaño y demanda.
- Una base de conocimiento gestionada reduce tareas de ingesta y recuperación. Sus capacidades y precios se evalúan junto con el filtro de permisos y el costo por consulta al pasar del corpus inicial.
- Reprocesar el corpus durante la consulta simplifica el almacenamiento de índices. Aumenta la latencia y repite extracción ya realizada.
- Un índice léxico acotado hace visibles las fuentes y costos del piloto. Puede perder sinónimos y preguntas indirectas. Las métricas de recuperación deciden si debe complementarse con vectores.

## Revisión de la decisión

Revisar el almacenamiento del índice cuando el corpus publicado supere 10 MiB de texto, cuando el tiempo de carga incumpla el objetivo del piloto o cuando las consultas etiquetadas muestren pérdida de recuperación relevante. El cambio conserva organización, base, revisión, citas y cuotas como contrato.

[Fuentes y citas en recuperación aumentada](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html) · [SQS con Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

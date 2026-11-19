# Asistente Técnico con Fuentes

Base de un asistente para consultar documentación técnica privada y obtener respuestas acompañadas de fragmentos verificables. La persona administradora publica una revisión de fuentes por organización. La persona usuaria pregunta dentro de una base autorizada y puede abrir el fragmento que respalda cada afirmación.

La base entrega el arranque Angular y la comprobación pública `GET /api/health`, infraestructura SAM y reglas puras de validación de citas. La ingesta, la recuperación documental y la conexión de un modelo están planificadas por fases. Esta implementación usa código y ejemplos nuevos.

## Documentación

- [Producto y piloto](docs/PRODUCTO.md)
- [Arquitectura, contratos y datos](docs/architecture/ARCHITECTURE.md)
- [Decisiones de infraestructura y recuperación](docs/architecture/adr/0001-recuperacion-por-revision.md)
- [Plan de implementación](plan/architecture-foundation-1.md)
- [Guía para agentes](AGENTS.md)

## Verificación local

Desde la raíz del repositorio, verifica el dominio con Node.js 24.

```sh
node --test services/domain/grounded-answer.test.mjs
```

Para validar la infraestructura usa AWS SAM CLI o cfn-lint.

```sh
sam validate --lint --template-file infra/template.yaml
cfn-lint --template infra/template.yaml
```

La configuración de ambientes está en `infra/environments.json` y `infra/samconfig.toml`. El template declara HTTP API, una Lambda de salud, una tabla DynamoDB bajo demanda y un bucket privado con versionado. La función de salud tiene permisos para su grupo de logs.

## Límites de la validación de respuestas

El dominio recibe evidencia seleccionada por el servidor y valida que cada afirmación cite texto presente en un fragmento publicado de la organización, base y revisión consultadas. Una cita desconocida, ajena o sin correspondencia textual produce abstención de toda la respuesta. El validador entrega solo los campos de texto y citas del contrato.

La verificación estructural acredita la procedencia de una cita. La evaluación de recuperación y generación debe probar también que el texto citado sustenta la afirmación. La arquitectura incluye esa evaluación antes del piloto.

## Base compartida y operación local

Ver [base local](docs/BASE-LOCAL.md) y [promoción](docs/promocion.md). Instalar con npm --prefix web ci; validar con npm test, npm run check:config, npm run test:web y npm run build:web. Para el recorrido local abrir dos terminales: npm run dev:api y npm run dev:web. Los resultados de preparación quedarán en [verificación](docs/VERIFICACION.md).

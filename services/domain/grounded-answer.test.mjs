import assert from 'node:assert/strict';
import test from 'node:test';

import { validateGroundedAnswer } from './grounded-answer.mjs';

const context = {
  tenantId: 'organizacion-de-prueba',
  knowledgeBaseId: 'manuales',
  revisionId: 'revision-2',
};

const evidence = {
  ...context,
  sourceId: 'procedimiento',
  sourceRevisionId: 'documento-3',
  chunkId: 'fragmento-1',
  status: 'published',
  text: 'Verifica el indicador antes de abrir la tapa. Registra el resultado.',
};

const citation = {
  sourceId: evidence.sourceId,
  sourceRevisionId: evidence.sourceRevisionId,
  chunkId: evidence.chunkId,
  quote: 'Verifica el indicador antes de abrir la tapa.',
};

const claim = {
  text: 'Verifica el indicador antes de abrir la tapa.',
  citations: [citation],
};

test('acepta afirmaciones con citas exactas de la revisión autorizada', () => {
  const result = validateGroundedAnswer(context, [evidence], { claims: [claim] });

  assert.equal(result.status, 'answered');
  assert.deepEqual(result.claims, [claim]);
});

test('se abstiene si falta evidencia o el contexto autorizado está incompleto', () => {
  assert.equal(
    validateGroundedAnswer(context, [], { claims: [claim] }).status,
    'abstained',
  );
  assert.equal(
    validateGroundedAnswer({ ...context, tenantId: '' }, [evidence], { claims: [claim] })
      .status,
    'abstained',
  );
});

test('una cita idéntica de otra organización, base o revisión no habilita la respuesta', () => {
  for (const field of ['tenantId', 'knowledgeBaseId', 'revisionId']) {
    const result = validateGroundedAnswer(
      context,
      [{ ...evidence, [field]: 'otro-valor' }],
      { claims: [claim] },
    );

    assert.equal(result.status, 'abstained', field);
    assert.equal('claims' in result, false, field);
  }
});

test('los documentos retirados y los borradores no son evidencia elegible', () => {
  for (const status of ['draft', 'revoked', undefined]) {
    const result = validateGroundedAnswer(
      context,
      [{ ...evidence, status }],
      { claims: [claim] },
    );

    assert.equal(result.status, 'abstained');
  }
});

test('la respuesta completa requiere cita en cada afirmación', () => {
  const result = validateGroundedAnswer(context, [evidence], {
    claims: [claim, { text: 'Después reinicia el equipo.', citations: [] }],
  });

  assert.equal(result.status, 'abstained');
  assert.equal(result.reason, 'uncited_claim');
  assert.equal('claims' in result, false);
});

test('rechaza fragmento inventado, revisión de documento vieja y cita textual modificada', () => {
  for (const invalid of [
    { ...citation, chunkId: 'inexistente' },
    { ...citation, sourceRevisionId: 'documento-1' },
    { ...citation, quote: 'Abre la tapa sin verificar el indicador.' },
  ]) {
    const result = validateGroundedAnswer(context, [evidence], {
      claims: [{ ...claim, citations: [invalid] }],
    });

    assert.equal(result.status, 'abstained');
    assert.equal(result.reason, 'invalid_citation');
  }
});

test('una cita ajena entre varias citas válidas causa abstención', () => {
  const foreign = { ...evidence, tenantId: 'organizacion-ajena', chunkId: 'ajeno' };
  const result = validateGroundedAnswer(context, [evidence, foreign], {
    claims: [{ ...claim, citations: [citation, { ...citation, chunkId: 'ajeno' }] }],
  });

  assert.equal(result.status, 'abstained');
});

test('se abstiene frente a evidencia ambigua para la misma clave de fragmento', () => {
  const result = validateGroundedAnswer(
    context,
    [evidence, { ...evidence, text: 'Contenido distinto para el mismo fragmento.' }],
    { claims: [claim] },
  );

  assert.equal(result.status, 'abstained');
  assert.equal(result.reason, 'ambiguous_evidence');
});

test('acepta solo los campos del contrato y no modifica los objetos recibidos', () => {
  const input = {
    claims: [{ ...claim, action: { type: 'execute', command: 'dato-de-prueba' } }],
    toolCalls: ['dato-de-prueba'],
  };
  const original = structuredClone(input);
  const result = validateGroundedAnswer(context, [evidence], input);

  assert.deepEqual(result, { status: 'answered', claims: [claim] });
  assert.deepEqual(input, original);
});

test('rechaza una salida vacía, mal formada o fuera de los límites de respuesta', () => {
  for (const draft of [
    undefined,
    { claims: [] },
    { claims: [{ text: '', citations: [citation] }] },
    { claims: [{ ...claim, citations: 'una cita' }] },
    { claims: Array.from({ length: 9 }, () => claim) },
  ]) {
    assert.equal(validateGroundedAnswer(context, [evidence], draft).status, 'abstained');
  }
});

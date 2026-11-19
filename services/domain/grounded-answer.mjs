const abstain = (reason) => ({
  status: 'abstained',
  reason,
  message: 'No encontré evidencia elegible para responder esta consulta.',
});

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const citationKey = (value) =>
  JSON.stringify([value.sourceId, value.sourceRevisionId, value.chunkId]);

/**
 * Valida procedencia estructural sobre evidencia seleccionada por el servidor.
 * La autorización y la correspondencia semántica requieren controles adicionales.
 * @param {{tenantId: string, knowledgeBaseId: string, revisionId: string}} context
 * @param {Array<object>} evidence
 * @param {{claims: Array<{text: string, citations: Array<object>}>}} draft
 */
export function validateGroundedAnswer(context, evidence, draft) {
  if (
    !context ||
    !['tenantId', 'knowledgeBaseId', 'revisionId'].every((field) => isText(context[field]))
  ) {
    return abstain('invalid_context');
  }

  const eligible = new Map();

  for (const source of Array.isArray(evidence) ? evidence : []) {
    if (
      source?.tenantId !== context.tenantId ||
      source.knowledgeBaseId !== context.knowledgeBaseId ||
      source.revisionId !== context.revisionId ||
      source.status !== 'published' ||
      !['sourceId', 'sourceRevisionId', 'chunkId', 'text'].every((field) => isText(source[field]))
    ) {
      continue;
    }

    const key = citationKey(source);
    if (eligible.has(key)) {
      return abstain('ambiguous_evidence');
    }
    eligible.set(key, source);
  }

  if (eligible.size === 0) {
    return abstain('no_evidence');
  }

  if (!Array.isArray(draft?.claims) || draft.claims.length === 0 || draft.claims.length > 8) {
    return abstain('invalid_claims');
  }

  const claims = [];

  for (const claim of draft.claims) {
    if (!isText(claim?.text) || claim.text.length > 1500) {
      return abstain('invalid_claims');
    }
    if (!Array.isArray(claim.citations) || claim.citations.length === 0 || claim.citations.length > 3) {
      return abstain('uncited_claim');
    }

    const citations = [];
    for (const citation of claim.citations) {
      if (
        !citation ||
        !['sourceId', 'sourceRevisionId', 'chunkId', 'quote'].every((field) => isText(citation[field])) ||
        citation.quote.length > 1500 ||
        !eligible.get(citationKey(citation))?.text.includes(citation.quote)
      ) {
        return abstain('invalid_citation');
      }
      citations.push({
        sourceId: citation.sourceId,
        sourceRevisionId: citation.sourceRevisionId,
        chunkId: citation.chunkId,
        quote: citation.quote,
      });
    }
    claims.push({ text: claim.text, citations });
  }

  return { status: 'answered', claims };
}

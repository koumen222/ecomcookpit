/**
 * Parse ROBUSTE du JSON produit par un LLM — utilitaire PARTAGÉ.
 *  - extraction de la PREMIÈRE structure balancée, objet `{...}` OU tableau
 *    `[...]` (les {} [] à l'intérieur des chaînes — HTML/CSS inline, textes… —
 *    ne comptent pas) ;
 *  - réparations ciblées puis nouvelles tentatives :
 *      · \' (échappement ILLÉGAL en JSON, fréquent dans les textes français —
 *        cause typique de « Expected ',' or ']' after array element ») ;
 *      · virgules terminales avant } ou ] ;
 *      · réponse TRONQUÉE (max_tokens atteint) : coupe au dernier point sûr
 *        (fin de valeur complète) et referme les structures ouvertes.
 * Retourne null si vraiment imparsable — l'appelant décide (throw / message).
 */
export function parseAiJson(raw, { root = 'object' } = {}) {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const open = root === 'array' ? '[' : '{';
  const start = text.indexOf(open);
  if (start === -1) return null;

  // Walk balancé, insensible au contenu des chaînes. On note :
  //  - end : fermeture de la structure racine ;
  //  - safes : points de coupe sûrs (juste APRÈS une valeur complète) avec
  //    l'état de la pile à cet endroit — pour réparer une réponse tronquée.
  const stack = [];
  let inStr = false; let esc = false; let end = -1;
  const safes = [];
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { if (inStr) esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') { stack.push(ch); continue; }
    if (ch === '}' || ch === ']') {
      stack.pop();
      if (!stack.length) { end = i; break; }
      safes.push({ pos: i + 1, stack: stack.join('') });
      continue;
    }
    if (ch === ',') safes.push({ pos: i, stack: stack.join('') });
  }

  const candidates = [];
  if (end !== -1) {
    candidates.push(text.slice(start, end + 1));
  } else {
    // Racine jamais refermée = réponse tronquée. On tente les 3 derniers
    // points sûrs : coupe après la dernière valeur complète (la paire ou
    // l'élément en cours d'écriture est abandonné) + fermetures manquantes.
    for (const sp of safes.slice(-3).reverse()) {
      const closing = sp.stack.split('').reverse().map((c) => (c === '{' ? '}' : ']')).join('');
      candidates.push(text.slice(start, sp.pos) + closing);
    }
    candidates.push(text.slice(start)); // dernier recours
  }

  for (const cand of candidates) {
    const attempts = [
      cand,
      cand.replace(/\\'/g, "'"),
      cand.replace(/\\'/g, "'").replace(/,\s*([}\]])/g, '$1'),
    ];
    for (const s of attempts) {
      try { return JSON.parse(s); } catch { /* tentative suivante */ }
    }
  }
  return null;
}

/** Variante tableau : première structure `[...]` balancée. */
export function parseAiJsonArray(raw) {
  return parseAiJson(raw, { root: 'array' });
}

export default parseAiJson;

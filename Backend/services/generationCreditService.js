import EcomWorkspace from '../models/Workspace.js';

export class GenerationCreditError extends Error {
  constructor(message, payload = {}, status = 403) {
    super(message);
    this.name = 'GenerationCreditError';
    this.status = status;
    this.payload = payload;
  }
}

const CREDIT_SELECT = 'simpleGenerationsRemaining freeGenerationsRemaining paidGenerationsRemaining totalGenerations lastGenerationAt';

function toNonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

export function getGenerationCreditBalances(workspace = {}) {
  const simple = toNonNegativeNumber(workspace.simpleGenerationsRemaining);
  const free = toNonNegativeNumber(workspace.freeGenerationsRemaining);
  const paid = toNonNegativeNumber(workspace.paidGenerationsRemaining);
  return {
    simple,
    free,
    paid,
    total: simple + free + paid,
    totalUsed: toNonNegativeNumber(workspace.totalGenerations),
  };
}

export function buildGenerationCreditLimitPayload({ cost = 1, remaining = 0, pricing = null, purpose = 'pages produit' } = {}) {
  const message = cost > 1
    ? `🎯 Il te faut ${cost} crédits pour générer ${purpose} (tu en as ${remaining}).`
    : `🎯 Tu n'as plus de crédits !\n\nAchète des crédits pour générer ${purpose}.`;

  return {
    success: false,
    limitReached: true,
    message,
    remaining,
    pricing,
  };
}

export function assertGenerationCreditsAvailable(workspace, cost = 1, options = {}) {
  const balances = getGenerationCreditBalances(workspace);
  if (balances.total < cost) {
    throw new GenerationCreditError(
      'Insufficient generation credits',
      buildGenerationCreditLimitPayload({
        cost,
        remaining: balances.total,
        pricing: options.pricing || null,
        purpose: options.purpose || 'pages produit',
      })
    );
  }
  return balances;
}

function computeDeductions(balances, cost) {
  let remaining = cost;
  const simple = Math.min(balances.simple, remaining);
  remaining -= simple;
  const free = Math.min(balances.free, remaining);
  remaining -= free;
  const paid = Math.min(balances.paid, remaining);
  remaining -= paid;

  if (remaining > 0) {
    throw new GenerationCreditError(
      'Insufficient generation credits',
      buildGenerationCreditLimitPayload({ cost, remaining: balances.total })
    );
  }

  return { simple, free, paid };
}

export function getCreditSourceFromDeductions(deductions = {}) {
  const usedSources = Object.entries(deductions)
    .filter(([, value]) => value > 0)
    .map(([source]) => source);
  return usedSources.length > 1 ? 'mixed' : (usedSources[0] || 'unknown');
}

export async function chargeGenerationCredits(workspaceId, cost = 1, options = {}) {
  if (!workspaceId || cost <= 0) {
    return {
      workspace: null,
      deductions: { simple: 0, free: 0, paid: 0 },
      creditSource: 'unknown',
      remaining: 0,
      totalUsed: 0,
    };
  }

  const maxRetries = options.maxRetries || 5;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const workspace = await EcomWorkspace.findById(workspaceId).select(CREDIT_SELECT).lean();
    if (!workspace) {
      throw new GenerationCreditError('Workspace introuvable', {
        success: false,
        message: 'Workspace introuvable',
      }, 404);
    }

    const balances = assertGenerationCreditsAvailable(workspace, cost, options);
    const deductions = computeDeductions(balances, cost);
    const updated = await EcomWorkspace.findOneAndUpdate(
      {
        _id: workspaceId,
        $expr: {
          $and: [
            { $eq: [{ $ifNull: ['$simpleGenerationsRemaining', 0] }, balances.simple] },
            { $eq: [{ $ifNull: ['$freeGenerationsRemaining', 0] }, balances.free] },
            { $eq: [{ $ifNull: ['$paidGenerationsRemaining', 0] }, balances.paid] },
          ],
        },
      },
      {
        $inc: {
          simpleGenerationsRemaining: -deductions.simple,
          freeGenerationsRemaining: -deductions.free,
          paidGenerationsRemaining: -deductions.paid,
          totalGenerations: cost,
        },
        $set: { lastGenerationAt: new Date() },
      },
      { new: true, select: CREDIT_SELECT, lean: true }
    );

    if (updated) {
      const nextBalances = getGenerationCreditBalances(updated);
      return {
        workspace: updated,
        deductions,
        creditSource: getCreditSourceFromDeductions(deductions),
        remaining: nextBalances.total,
        totalUsed: nextBalances.totalUsed,
      };
    }
  }

  throw new GenerationCreditError('Impossible de réserver les crédits, réessaie.', {
    success: false,
    message: 'Impossible de réserver les crédits, réessaie.',
  }, 409);
}

export function isGenerationCreditError(error) {
  return error instanceof GenerationCreditError || error?.name === 'GenerationCreditError';
}

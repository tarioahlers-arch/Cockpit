import { Router } from 'express';
import { ownedShop } from '../auth/index.js';
import { aiConfig, isAiConfigured, questionsLastHour, runAdvisor, usageThisMonth, type ChatTurn } from '../ai/advisor.js';
import Anthropic from '@anthropic-ai/sdk';

export const aiRouter = Router();

const inFlight = new Set<number>();

aiRouter.get('/ai/status', (req, res) => {
  const used = usageThisMonth(req.user!.orgId);
  res.json({
    configured: isAiConfigured(),
    model: aiConfig.model,
    monthlyBudgetUsd: aiConfig.monthlyBudgetUsd,
    usedThisMonthUsd: Math.round(used * 100) / 100,
    budgetUsedShare: aiConfig.monthlyBudgetUsd ? Math.min(1, used / aiConfig.monthlyBudgetUsd) : 1,
    questionsLastHour: questionsLastHour(req.user!.id),
    questionsPerHour: aiConfig.questionsPerHour,
  });
});

function parseHistory(raw: unknown): ChatTurn[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const out: ChatTurn[] = [];
  for (const t of raw) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string' || !t.content.trim()) return null;
    out.push({ role: t.role, content: t.content.slice(0, 6000) });
  }
  // Muss mit einer Nutzerfrage beginnen und abwechseln
  if (out.length && out[0].role !== 'user') return null;
  for (let i = 1; i < out.length; i++) if (out[i].role === out[i - 1].role) return null;
  if (out.length && out[out.length - 1].role !== 'assistant') return null;
  return out;
}

aiRouter.post('/shops/:id/advisor', async (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  if (!isAiConfigured()) return res.status(503).json({ error: 'Der KI-Berater ist auf dieser Plattform noch nicht eingerichtet.' });

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 2000) return res.status(400).json({ error: 'Bitte eine Frage mit höchstens 2000 Zeichen stellen.' });
  const history = parseHistory(req.body?.history);
  if (!history) return res.status(400).json({ error: 'Ungültiger Gesprächsverlauf.' });

  if (questionsLastHour(req.user!.id) >= aiConfig.questionsPerHour) {
    return res.status(429).json({ error: `Stundenlimit erreicht (${aiConfig.questionsPerHour} Fragen). Bitte später erneut fragen.` });
  }
  if (usageThisMonth(req.user!.orgId) >= aiConfig.monthlyBudgetUsd) {
    return res.status(429).json({ error: 'Das monatliche KI-Kontingent Ihrer Organisation ist aufgebraucht. Es wird zum Monatsbeginn erneuert.' });
  }
  // Pro Person nur eine Frage gleichzeitig – verhindert, dass parallele Anfragen das Budget ueberziehen
  if (inFlight.has(req.user!.id)) return res.status(429).json({ error: 'Bitte warten Sie, bis die vorherige Antwort fertig ist.' });
  inFlight.add(req.user!.id);

  try {
    const result = await runAdvisor({ shop, orgId: req.user!.orgId, userId: req.user!.id, question, history });
    res.json(result);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(503).json({ error: 'Der KI-Dienst ist gerade ausgelastet. Bitte gleich erneut versuchen.' });
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('KI-Berater: API-Schlüssel ungültig');
      return res.status(503).json({ error: 'Der KI-Berater ist vorübergehend nicht verfügbar.' });
    }
    if (e instanceof Anthropic.APIError) {
      console.error('KI-Berater API-Fehler', e.status, e.message);
      return res.status(502).json({ error: 'Der KI-Dienst hat einen Fehler gemeldet. Bitte erneut versuchen.' });
    }
    console.error('KI-Berater:', e);
    res.status(500).json({ error: 'Interner Fehler im KI-Berater.' });
  } finally {
    inFlight.delete(req.user!.id);
  }
});

import express from 'express';
import cors from 'cors';
import { timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { auditProfile } from '../server/scraper-module.js';
import mondayIntegration from '../server/integrations/monday.js';
import { getFutureMeetings, getCalendarSnapshot } from '../server/integrations/calendar.js';
import { describeVybePanelSource, getVybePanelExecutiveSnapshot, getVybePanelPage } from '../server/integrations/vybe-panel.js';
import { buildExecutiveSnapshot } from '../server/domain/executive.js';
import { listDecisionRecords, saveDecisionRecord, updateDecisionRecord } from '../server/domain/executive-records.js';
import { createVersionedAuditRecord } from '../server/domain/audit-records.js';
import { buildClientHealthScore } from '../server/domain/health-score.js';
import { listExecutiveSnapshots, saveExecutiveSnapshot, summarizeSnapshotTrend, summarizeExecutiveDelta } from '../server/domain/executive-snapshots.js';
import { listImpactRecords, saveImpactRecord, updateImpactRecord } from '../server/domain/impact-records.js';
import { listHealthSnapshots, saveHealthSnapshot, summarizeHealthTrend } from '../server/domain/health-snapshots.js';
import { summarizeDecisionEffectiveness, detectPersistentRisks, summarizePortfolioPatterns, buildExecutiveBriefing } from '../server/domain/decision-analytics.js';
import { buildExecutiveBriefingDocument } from '../server/domain/executive-briefing.js';
import { buildExecutiveAlerts } from '../server/domain/executive-alerts.js';
import { buildDecisionMemory, buildExecutiveScenarios } from '../server/domain/executive-planning.js';
import { buildOutcomeLearning } from '../server/domain/outcome-learning.js';
import { describeRecordStore, getPersistenceHealth } from '../server/persistence/record-store.js';
import { buildReleaseMetadata } from '../server/release.js';
import { securityHeaders, createRateLimiter, rateLimitConfig } from '../server/security.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.NEXUS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const storageMode = (...storeNames) => {
  const modes = [...new Set(storeNames.map(storeName => describeRecordStore(storeName).mode))];
  return modes.length === 1 ? modes[0] : 'mixed';
};

const adminTokenMatches = req => {
  const expected = process.env.NEXUS_ADMIN_TOKEN || '';
  const received = req.get('x-nexus-admin-token') || req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
};

function requireAdminAccess(req, res, next) {
  if (!isProduction && !process.env.NEXUS_ADMIN_TOKEN) return next();
  if (!process.env.NEXUS_ADMIN_TOKEN) {
    return res.status(503).json({ error: 'NEXUS_ADMIN_TOKEN não configurado para esta operação.' });
  }
  if (!adminTokenMatches(req)) {
    return res.status(401).json({ error: 'Autorização administrativa necessária.' });
  }
  return next();
}

function blockLegacyFilePersistence(req, res, next) {
  if (isProduction) {
    return res.status(503).json({ error: 'Persistência legada em clients.js desativada. Configure o datastore versionado da Auditoria IA.' });
  }
  return next();
}

const app = express();
const rateLimits = rateLimitConfig();
app.use(securityHeaders);
app.use('/api', createRateLimiter({ ...rateLimits.public, name: 'public-api' }));
app.use(cors({
  origin(origin, callback) {
    if (!isProduction || !origin) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  }
}));
app.use(express.json());
app.use('/api/executive/decisions', createRateLimiter({ ...rateLimits.admin, name: 'admin-decisions' }));
app.use('/api/executive/impacts', createRateLimiter({ ...rateLimits.admin, name: 'admin-impacts' }));
app.use('/api/executive/snapshots', createRateLimiter({ ...rateLimits.admin, name: 'admin-snapshots' }));

app.get('/api/healthz', async (req, res) => {
  const production = process.env.NODE_ENV === 'production';
  const release = buildReleaseMetadata();
  const persistence = await getPersistenceHealth({ probe: req.query.probe !== 'false' });
  const storesReady = Object.values(persistence).every(store => store.ready);
  const ready = (!production || release.trackable) && storesReady;

  res.json({
    ok: true,
    ready,
    service: 'vybe-nexus-api',
    mode: production ? 'production' : 'development',
    commit: release.commit,
    release,
    access: 'public-link-read',
    integrations: {
      monday: Boolean(process.env.MONDAY_API_TOKEN),
      calendar: Boolean(process.env.GOOGLE_CALENDAR_ICAL_URL),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      instagram: Boolean(process.env.INSTAGRAM_COOKIES_JSON || process.env.INSTAGRAM_COOKIES_PATH)
    },
    persistence,
    generatedAt: new Date().toISOString()
  });
});

// Ponte read-only para o Vybe Painel: preserva organização, descrição e evidência
// sem permitir alterações no board ou nos status operacionais.
app.get('/api/executive/vybe-panel', async (req, res) => {
  try {
    const snapshot = await getVybePanelExecutiveSnapshot({
      limit: Math.min(Number(req.query.limit) || 200, 200),
      maxPages: Math.min(Number(req.query.maxPages) || 10, 10),
      budgetMs: Math.min(Number(req.query.budgetMs) || 12000, 15000)
    });
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.json({
      success: true,
      ...snapshot,
      mode: 'executive-summary',
      meta: {
        source: describeVybePanelSource(),
        access: 'public-link-read',
        readOnly: true,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[API] Erro ao ler o resumo do Vybe Painel:', error);
    res.set('Cache-Control', 'no-store');
    res.status(502).json({
      error: 'VYBE_PANEL_UNAVAILABLE',
      message: 'O contexto do Vybe Painel está temporariamente indisponível; as evidências do Monday continuam disponíveis.'
    });
  }
});

app.get('/api/executive/vybe-panel/page', async (req, res) => {
  try {
    const page = await getVybePanelPage({
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null,
      limit: Math.min(Number(req.query.limit) || 50, 100)
    });
    res.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
    res.json({ success: true, ...page, mode: 'read-only-drilldown', meta: { source: describeVybePanelSource(), access: 'public-link-read', readOnly: true } });
  } catch (error) {
    console.error('[API] Erro no drill-down do Vybe Painel:', error);
    res.set('Cache-Control', 'no-store');
    res.status(502).json({ error: 'VYBE_PANEL_PAGE_UNAVAILABLE', message: 'A página solicitada do Vybe Painel está temporariamente indisponível.' });
  }
});

const PORT = Number(process.env.PORT || 3005);

// Mapeamento dos IDs do clients.js para os Handles corretos do Scraper
const CLIENT_HANDLES = {
  conectasim: 'conectasimprovedor',
  antonov: 'antonovcenter',
  hebravet: 'hebravetoficial',
  copirece: 'copirece',
  lionstop: 'academialionstop',
  serragrande: 'gruposerragrandeoficial',
  brussolo: 'brussoloristorante',
  mangaba: 'mangaba_ai',
  voa: 'voasportswear',
  hellen: 'hellenrochax',
  deputado: 'deputadojoaobacelar',
  alpha1: 'alpha1consultoria_',
  experimente: 'experimentepapelaria',
  diacenter_clinica: 'diacenterbahia',
  labdiacenter: 'labdiacenter',
  gonzalez: 'gonzalezgastronomia',
  irecemodas: 'irecemodas'
};


const AI_PLACEHOLDER_MARKERS = [
  'um texto curto e direto relatando',
  'parágrafo forte, visão estratégica baseada',
  'nome do problema (baseado nos dados reais)',
  'fato comprovado que prova o problema',
  'por que isso é um problema?',
  'o que ganhamos ao resolver',
  'passo prático 1'
];

function validateAIAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    throw new Error('[INVALID_AI_OUTPUT] A análise precisa ser um objeto JSON.');
  }

  const text = value => typeof value === 'string' ? value.trim() : '';
  const hasPlaceholder = value => AI_PLACEHOLDER_MARKERS.some(marker => text(value).toLowerCase().includes(marker));
  const fields = [analysis.igStats, analysis.cmoDirective];
  if (fields.some(value => !text(value) || hasPlaceholder(value))) {
    throw new Error('[INVALID_AI_OUTPUT] A análise contém texto vazio ou placeholder. Nenhum dado foi salvo.');
  }
  if (!Array.isArray(analysis.issues) || analysis.issues.length === 0) {
    throw new Error('[INVALID_AI_OUTPUT] A análise precisa conter pelo menos um diagnóstico.');
  }

  const issues = analysis.issues.map(issue => ({
    title: text(issue?.title),
    evidence: text(issue?.evidence),
    rationale: text(issue?.rationale),
    impact: text(issue?.impact),
    steps: Array.isArray(issue?.steps) ? issue.steps.map(text).filter(Boolean) : []
  }));

  const invalidIssue = issues.some(issue =>
    Object.entries(issue).some(([key, value]) => key !== 'steps' && (!value || hasPlaceholder(value))) ||
    issue.steps.length === 0 || issue.steps.some(hasPlaceholder)
  );
  if (invalidIssue) {
    throw new Error('[INVALID_AI_OUTPUT] Um ou mais diagnósticos contêm texto vazio ou placeholder. Nenhum dado foi salvo.');
  }

  return { igStats: text(analysis.igStats), cmoDirective: text(analysis.cmoDirective), issues };
}

async function generateAIAnalysis(client, scrapedData) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const prompt = `Você é o Diretor de Marketing (CMO) da agência Vybe.
Você está auditando o perfil do Instagram do cliente "${client.name}" (Nicho: ${client.niche}).

ATENÇÃO: É PROIBIDO inventar informações. Analise EXCLUSIVAMENTE os dados reais fornecidos abaixo e use a ferramenta de busca do Google para obter o contexto mais atualizado possível sobre o cliente. O cliente possui publicações recentes e você deve identificar corretamente os padrões de engajamento baseados no volume completo.

Aqui estão os dados estruturados raspados ao vivo do Instagram deles agora mesmo (contendo as últimas dezenas de postagens):
${JSON.stringify(scrapedData, null, 2)}

Sua tarefa é analisar friamente estes dados reais e atualizar a análise deles.
Retorne APENAS um objeto JSON válido (sem \`\`\`json ou texto extra) com as seguintes propriedades:
{
  "igStats": "Um texto curto e direto ao ponto relatando APENAS os fatos observados nos dados acima (ex: Quantidade de seguidores, média real de dias sem postar, engajamento médio). Sem adjetivos ou jargões, apenas fatos concretos observados na raspagem e busca.",
  "cmoDirective": "Um parágrafo forte e implacável com a sua visão estratégica baseada nos fatos reais descritos. O que está errado? Qual o risco? Baseie-se apenas em dados verdadeiros.",
  "issues": [
    {
      "title": "Nome do Problema ou Oportunidade (Baseado nos dados reais raspados)",
      "evidence": "Fato comprovado extraído do scrape que prova o problema",
      "rationale": "Por que isso é um problema?",
      "impact": "O que ganhamos ao resolver",
      "steps": ["Passo prático 1", "Passo prático 2"]
    }
  ]
}

Se o perfil for privado, alerte isso.
Sempre retorne as chaves EXATAMENTE como pedidas.`;

  const modelsToTry = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-pro-latest"];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`[API] Tentando gerar análise com modelo: ${modelName}...`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        tools: [{ googleSearch: {} }] 
      });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      // Limpar markdown de json se houver
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error(`Erro com o modelo ${modelName}:`, error.message);
      if (modelName === modelsToTry[modelsToTry.length - 1]) {
        if (error.message.includes('429')) {
            throw new Error(`[QUOTA_EXCEEDED] Limite gratuito da API do Google Gemini atingido pelo volume de dados (raspar 30 posts consome mais tokens). Aguarde cerca de 30 a 60 segundos e clique em atualizar novamente.`);
        }
        throw new Error(`Todos os modelos falharam. Último erro: ${error.message}`);
      }
      console.log(`[API] Fallback automático! Tentando próximo modelo em 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

app.post('/api/audit/:id', requireAdminAccess, blockLegacyFilePersistence, async (req, res) => {
  const clientId = req.params.id;
  const handle = CLIENT_HANDLES[clientId];

  if (!handle) {
    return res.status(404).json({ error: 'Cliente não mapeado para um handle de Instagram.' });
  }

  try {
    console.log(`\n[API] Recebida requisição para auditar: ${clientId} (@${handle})`);
    
    // 1. Raspar Dados
    console.log(`[API] 1/3 - Raspando dados do Instagram de @${handle}...`);
    let scrapedData = await auditProfile(handle);
    console.log(`[DEBUG] Scraped Data:`, JSON.stringify(scrapedData, null, 2));
    
    if (scrapedData.error) {
      console.error(`[API] Erro na raspagem: ${scrapedData.error}. Prosseguindo apenas com IA e Busca.`);
      // Em vez de crashar, vamos avisar a IA que a raspagem falhou
      scrapedData = { 
        aviso: "O Instagram bloqueou a raspagem direta (HTTP 400/404). Os dados de postagens estão indisponíveis.", 
        instrucao: "Use a ferramenta googleSearch para buscar sobre este cliente e monte a análise APENAS com base nos resultados da web. Relate em igStats que a raspagem foi bloqueada." 
      };
    }

    // 2. Chamar LLM (Gemini)
    console.log(`[API] 2/3 - Enviando dados para o Gemini...`);
    
    const clientsFilePath = join(__dirname, '..', 'src', 'data', 'clients.js');
    let clientsFileContent = readFileSync(clientsFilePath, 'utf-8');
    
    // Extrai informacao base do cliente pra mandar pro prompt
    const match = new RegExp(`id:\\s*["']${clientId}["']\\s*,\\s*name:\\s*["'](.*?)["']\\s*,\\s*niche:\\s*["'](.*?)["']`).exec(clientsFileContent);
    const clientBase = { name: match ? match[1] : clientId, niche: match ? match[2] : '' };
    
    const aiAnalysis = validateAIAnalysis(await generateAIAnalysis(clientBase, scrapedData));

    // 3. Atualizar clients.js
    console.log(`[API] 3/3 - Atualizando src/data/clients.js...`);
    
    // Expressões regulares para substituir os valores no arquivo.
    // Como clients.js é um arquivo JS (não JSON), faremos manipulação de string pra evitar reescrever o arquivo inteiro e perder formatação.
    // Isso é um pouco rudimentar mas funciona para o arquivo atual.
    
    // Para simplificar, vamos importar o módulo e reescrevê-lo, ou fazer regex. Fazer regex é mais seguro pro formato.
    
    // Substitui igStats (busca do igStats atual até a chave cmoDirective)
    const igStatsRegex = new RegExp(`(id:\\s*["']${clientId}["'][\\s\\S]*?igStats:\\s*)([\\s\\S]*?)(\\s*\\}\\s*,\\s*cmoDirective:)`);
    clientsFileContent = clientsFileContent.replace(igStatsRegex, `$1\`${aiAnalysis.igStats.replace(/`/g, "'")}\`$3`);

    // Substitui cmoDirective (busca do cmoDirective até a chave kpis)
    const cmoRegex = new RegExp(`(id:\\s*["']${clientId}["'][\\s\\S]*?cmoDirective:\\s*)([\\s\\S]*?)(\\s*,\\s*kpis:)`);
    clientsFileContent = clientsFileContent.replace(cmoRegex, `$1\`${aiAnalysis.cmoDirective.replace(/`/g, "'")}\`$3`);
    
    // Atualiza issues inteiros no bloco do primeiro canal (Instagram) garantindo que só casa com o fechamento do array issues pela indentação
    const issuesRegex = new RegExp(`(id:\\s*["']${clientId}["'][\\s\\S]*?channels:\\s*\\[\\s*\\{[\\s\\S]*?issues:\\s*\\[)([\\s\\S]*?)(\\n\\s{8}\\]\\s*\\n\\s{6}\\})`);
    
    // Formatando os novos issues como JS string
    const newIssuesJs = aiAnalysis.issues.map(issue => `
          {
            title: \`${issue.title.replace(/`/g, "'")}\`,
            evidence: \`${issue.evidence.replace(/`/g, "'")}\`,
            rationale: \`${issue.rationale.replace(/`/g, "'")}\`,
            impact: \`${issue.impact.replace(/`/g, "'")}\`,
            steps: [
              ${issue.steps.map(s => `\`${s.replace(/`/g, "'")}\``).join(',\n              ')}
            ]
          }`).join(',');
          
    clientsFileContent = clientsFileContent.replace(issuesRegex, `$1\n${newIssuesJs}$3`);

    writeFileSync(clientsFilePath, clientsFileContent, 'utf-8');

    console.log(`[API] ✅ Cliente ${clientId} atualizado com sucesso!`);
    
    res.json({ success: true, aiAnalysis });

  } catch (error) {
    console.error("[API] Erro Geral:", error);
    res.status(500).json({ error: error.message });
  }
});

// NOVO ENDPOINT: Gera apenas o prompt para o usuário colar no ChatGPT
app.get('/api/prompt/:id', requireAdminAccess, async (req, res) => {
  const clientId = req.params.id;
  const handle = CLIENT_HANDLES[clientId];

  if (!handle) return res.status(404).json({ error: 'Cliente não mapeado.' });

  try {
    let scrapedData = await auditProfile(handle);
    if (scrapedData.error) {
      scrapedData = { aviso: "O Instagram bloqueou a raspagem direta. Use a ferramenta googleSearch." };
    }

    const clientsFilePath = join(__dirname, '..', 'src', 'data', 'clients.js');
    const clientsFileContent = readFileSync(clientsFilePath, 'utf-8');
    const match = new RegExp(`id:\\s*["']${clientId}["']\\s*,\\s*name:\\s*["'](.*?)["']\\s*,\\s*niche:\\s*["'](.*?)["']`).exec(clientsFileContent);
    const clientBase = { name: match ? match[1] : clientId, niche: match ? match[2] : '' };

    const prompt = `Você é o Diretor de Marketing (CMO) da agência Vybe.
Você está auditando o perfil do Instagram do cliente "${clientBase.name}" (Nicho: ${clientBase.niche}).

Aqui estão os dados estruturados raspados ao vivo do Instagram deles agora mesmo:
${JSON.stringify(scrapedData, null, 2)}

Sua tarefa é analisar friamente estes dados reais e atualizar a análise deles.
Retorne APENAS um objeto JSON válido (sem \`\`\`json ou texto extra) com as seguintes propriedades:
{
  "igStats": "Um texto curto e direto relatando APENAS fatos (seguidores, tempo sem postar, engajamento médio). Sem adjetivos ou jargões.",
  "cmoDirective": "Parágrafo forte, visão estratégica baseada nos fatos descritos. O que está errado? Qual o risco? Linguagem afiada.",
  "issues": [
    {
      "title": "Nome do Problema (Baseado nos dados reais)",
      "evidence": "Fato comprovado que prova o problema",
      "rationale": "Por que isso é um problema?",
      "impact": "O que ganhamos ao resolver",
      "steps": ["Passo prático 1", "Passo prático 2"]
    }
  ]
}
Sempre retorne as chaves EXATAMENTE como pedidas.`;

    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NOVO ENDPOINT: Salva o JSON colado pelo usuário
app.post('/api/save/:id', requireAdminAccess, blockLegacyFilePersistence, express.json(), (req, res) => {
  const clientId = req.params.id;

  try {
    const aiAnalysis = validateAIAnalysis(req.body);
    const clientsFilePath = join(__dirname, '..', 'src', 'data', 'clients.js');
    let clientsFileContent = readFileSync(clientsFilePath, 'utf-8');

    // Atualiza igStats e cmoDirective (forçando o uso de backticks para evitar quebra de aspas internas)
    const igStatsRegex = new RegExp(`(id:\\s*["']${clientId}["'][\\s\\S]*?igStats:\\s*)(["'\`][\\s\\S]*?["'\`])`);
    clientsFileContent = clientsFileContent.replace(igStatsRegex, `$1\`${aiAnalysis.igStats.replace(/`/g, "'")}\``);

    const cmoRegex = new RegExp(`(id:\\s*["']${clientId}["'][\\s\\S]*?cmoDirective:\\s*)(["'\`][\\s\\S]*?["'\`])`);
    clientsFileContent = clientsFileContent.replace(cmoRegex, `$1\`${aiAnalysis.cmoDirective.replace(/`/g, "'")}\``);

    // Substituindo Regex por um parser inteligente que encontra o final EXATO do array 'issues'
    const newIssuesJs = aiAnalysis.issues.map(issue => `          {
            title: \`${issue.title.replace(/`/g, "'")}\`,
            evidence: \`${issue.evidence.replace(/`/g, "'")}\`,
            rationale: \`${issue.rationale.replace(/`/g, "'")}\`,
            impact: \`${issue.impact.replace(/`/g, "'")}\`,
            steps: [
              ${issue.steps.map(s => `\`${s.replace(/`/g, "'")}\``).join(',\n              ')}
            ]
          }`).join(',');

    function replaceFirstChannelIssues(content, clientId, newIssuesJs) {
      const idMatch = new RegExp(`id:\\s*["']${clientId}["']`).exec(content);
      if (!idMatch) return content;
      const clientStartIdx = idMatch.index;
      
      const channelsStartIdx = content.indexOf(`channels: [`, clientStartIdx);
      if (channelsStartIdx === -1) return content;
      
      const issuesStartIdx = content.indexOf(`issues: [`, channelsStartIdx);
      if (issuesStartIdx === -1) return content;
      
      let bracketCount = 1;
      let issuesEndIdx = -1;
      let inString = false;
      let stringChar = null;
      let escapeNext = false;
      
      for (let i = issuesStartIdx + 9; i < content.length; i++) {
        const char = content[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (inString) {
          if (char === stringChar) inString = false;
          continue;
        }
        if (char === '"' || char === "'" || char === '\`') {
          inString = true;
          stringChar = char;
          continue;
        }
        
        if (char === '[') bracketCount++;
        if (char === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            issuesEndIdx = i;
            break;
          }
        }
      }
      
      if (issuesEndIdx !== -1) {
        return content.substring(0, issuesStartIdx + 9) + '\n' + newIssuesJs + '\n        ' + content.substring(issuesEndIdx);
      }
      
      return content;
    }

    clientsFileContent = replaceFirstChannelIssues(clientsFileContent, clientId, newIssuesJs);

        writeFileSync(clientsFilePath, clientsFileContent, 'utf-8');
    const auditRecord = createVersionedAuditRecord({ clientId, analysis: aiAnalysis, source: 'manual_json' });
    res.json({ success: true, auditRecord });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// NOVO ENDPOINT: Command Center / Métricas Executivas do Monday
app.get('/api/dashboard/metrics', async (req, res) => {
  console.log('[API] /api/dashboard/metrics called');
  const forceRefresh = ['1', 'true'].includes(String(req.query.refresh || '').toLowerCase());
  try {
    console.log('[API] Fetching from Monday...');
    const [bottlenecks, posts, demands, calendar] = await Promise.all([
      mondayIntegration.getClientBottlenecks(),
      mondayIntegration.getOpenPosts(),
      mondayIntegration.getDelayedDemands(),
      getCalendarSnapshot()
    ]);
    console.log('[API] Fetched from Monday successfully');
    const executiveSnapshot = buildExecutiveSnapshot({
      bottlenecks,
      posts,
      demands,
      calendar,
      generatedAt: new Date().toISOString()
    });
    let snapshotSaved = false;
    if (process.env.NEXUS_SNAPSHOT_AUTOSAVE === 'true') {
      try {
        await saveExecutiveSnapshot(executiveSnapshot);
        snapshotSaved = true;
      } catch (snapshotError) {
        console.warn('[API] Snapshot executivo não persistido:', snapshotError.message);
      }
    }

    let history = { status: 'unavailable', available: false, message: 'Histórico executivo indisponível nesta implantação.' };
    try {
      const storedSnapshots = await listExecutiveSnapshots({ limit: 3 });
      const baseline = snapshotSaved ? storedSnapshots[1] : storedSnapshots[0];
      history = summarizeExecutiveDelta(executiveSnapshot, baseline);
      history.snapshotsAvailable = storedSnapshots.length;
    } catch (historyError) {
      history = {
        status: historyError.code === 'SNAPSHOT_STORE_NOT_CONFIGURED' ? 'not_configured' : 'unavailable',
        available: false,
        message: historyError.code === 'SNAPSHOT_STORE_NOT_CONFIGURED' ? 'Configure o datastore de snapshots para acompanhar mudanças entre leituras.' : 'Não foi possível carregar o histórico executivo.'
      };
    }

    // A leitura normal custa três consultas ao Monday e alguns segundos. A CDN
    // guarda a resposta por um minuto para não multiplicar consultas para cada
    // espectador. Quando o gestor pede atualização manual, a leitura recebe
    // no-store para garantir que a resposta venha das fontes naquele momento.
    res.set('Cache-Control', forceRefresh ? 'no-store, max-age=0' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

    res.json({
      success: true,
      metrics: {
        executiveSnapshot
      },
      meta: {
        source: 'Monday.com',
        generatedAt: executiveSnapshot.generatedAt,
        freshness: 'live',
        snapshotSaved,
        history,
        sourceQuality: executiveSnapshot.sourceQuality
      }
    });
  } catch (error) {
    console.error("[API] Erro ao buscar métricas do Monday:", error);
    // Falha não pode ser cacheada: a próxima tentativa precisa ir ao Monday.
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ error: error.message });
  }
});

// Registro de Decisões Executivas — não altera status ou itens no Monday.
app.get('/api/executive/decisions', async (req, res) => {
  try {
    const decisions = await listDecisionRecords();
    const now = Date.now();
    const active = decisions.filter(decision => !['normalized', 'dismissed'].includes(decision.status));
    const atRisk = active.filter(decision => !decision.checkpointAt || new Date(decision.checkpointAt).getTime() < now);
    res.json({
      success: true,
      decisions,
      riskSummary: { total: decisions.length, active: active.length, atRisk: atRisk.length, overdueCheckpoint: atRisk.filter(decision => decision.checkpointAt).length, missingCheckpoint: atRisk.filter(decision => !decision.checkpointAt).length },
      meta: { source: 'Nexus Decision Registry', storage: storageMode('decisions') }
    });
  } catch (error) {
    const status = error.code === 'PERSISTENCE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/executive/decisions', requireAdminAccess, async (req, res) => {
  try {
    const decision = await saveDecisionRecord(req.body);
    res.status(201).json({ success: true, decision });
  } catch (error) {
    const status = error.code === 'INVALID_DECISION' ? 400 : error.code === 'PERSISTENCE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.patch('/api/executive/decisions/:id', requireAdminAccess, async (req, res) => {
  try {
    const decision = await updateDecisionRecord(req.params.id, req.body);
    res.json({ success: true, decision });
  } catch (error) {
    const status = error.code === 'INVALID_DECISION' ? 400 : error.code === 'DECISION_NOT_FOUND' ? 404 : error.code === 'PERSISTENCE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Histórico executivo — leitura aberta pelo link, escrita controlada pela infraestrutura.
app.get('/api/executive/snapshots', async (req, res) => {
  try {
    const snapshots = await listExecutiveSnapshots({ limit: Number(req.query.limit) || 90 });
    res.json({ success: true, snapshots, trend: summarizeSnapshotTrend(snapshots), meta: { source: 'Nexus Snapshot Registry', storage: storageMode('snapshots') } });
  } catch (error) {
    const status = error.code === 'SNAPSHOT_STORE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/executive/snapshots', requireAdminAccess, async (req, res) => {
  try {
    const snapshot = await saveExecutiveSnapshot(req.body?.snapshot || req.body);
    res.status(201).json({ success: true, snapshot });
  } catch (error) {
    const status = error.code === 'SNAPSHOT_STORE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Impacto executivo — leitura aberta por link, escrita técnica controlada.
app.get('/api/executive/impacts', async (req, res) => {
  try {
    const impacts = await listImpactRecords();
    res.json({ success: true, impacts, meta: { source: 'Nexus Impact Registry', storage: storageMode('impacts') } });
  } catch (error) {
    const status = error.code === 'IMPACT_PERSISTENCE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/executive/impacts', requireAdminAccess, async (req, res) => {
  try {
    const impact = await saveImpactRecord(req.body);
    res.status(201).json({ success: true, impact });
  } catch (error) {
    const status = error.code === 'INVALID_IMPACT' ? 400 : error.code === 'IMPACT_PERSISTENCE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.patch('/api/executive/impacts/:id', requireAdminAccess, async (req, res) => {
  try {
    const impact = await updateImpactRecord(req.params.id, req.body);
    res.json({ success: true, impact });
  } catch (error) {
    const status = error.code === 'INVALID_IMPACT' ? 400 : error.code === 'IMPACT_NOT_FOUND' ? 404 : error.code === 'IMPACT_PERSISTENCE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/executive/health/:clientId', async (req, res) => {
  try {
    const snapshots = await listHealthSnapshots(req.params.clientId);
    res.json({ success: true, snapshots, trend: summarizeHealthTrend(snapshots), meta: { source: 'Nexus Health Registry', storage: storageMode('health') } });
  } catch (error) {
    const status = error.code === 'HEALTH_SNAPSHOT_STORE_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/executive/memory', async (req, res) => {
  try {
    const [decisions, impacts] = await Promise.all([listDecisionRecords(), listImpactRecords()]);
    res.json({ success: true, memory: buildDecisionMemory({ decisions, impacts, query: req.query.q }), meta: { source: 'Nexus Executive Memory', storage: storageMode('decisions', 'impacts') } });
  } catch (error) {
    const status = ['PERSISTENCE_NOT_CONFIGURED', 'IMPACT_PERSISTENCE_NOT_CONFIGURED'].includes(error.code) ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/executive/scenarios', async (req, res) => {
  try {
    const [decisions, impacts, healthSnapshots] = await Promise.all([listDecisionRecords(), listImpactRecords(), listHealthSnapshots()]);
    const persistentRisks = detectPersistentRisks({ decisions, impacts, healthSnapshots });
    res.json({ success: true, scenarios: buildExecutiveScenarios({ decisions, impacts, healthSnapshots, risks: persistentRisks }), meta: { source: 'Nexus Executive Scenarios', mode: 'simulation', storage: storageMode('decisions', 'impacts', 'health') } });
  } catch (error) {
    const status = ['PERSISTENCE_NOT_CONFIGURED', 'IMPACT_PERSISTENCE_NOT_CONFIGURED', 'HEALTH_SNAPSHOT_STORE_NOT_CONFIGURED'].includes(error.code) ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/executive/analytics', async (req, res) => {
  try {
    const [decisions, impacts, healthSnapshots] = await Promise.all([
      listDecisionRecords(),
      listImpactRecords(),
      listHealthSnapshots()
    ]);
    let snapshot = {};
    try {
      const [bottlenecks, posts, demands] = await Promise.all([
        mondayIntegration.getClientBottlenecks(),
        mondayIntegration.getOpenPosts(),
        mondayIntegration.getDelayedDemands()
      ]);
      snapshot = buildExecutiveSnapshot({ bottlenecks, posts, demands, generatedAt: new Date().toISOString() });
    } catch (sourceError) {
      console.warn('[API] Briefing sem snapshot vivo:', sourceError.message);
    }
    const effectiveness = summarizeDecisionEffectiveness(decisions, impacts);
    const persistentRisks = detectPersistentRisks({ decisions, impacts, healthSnapshots });
    const patterns = summarizePortfolioPatterns({ decisions, impacts, healthSnapshots });
    const briefing = buildExecutiveBriefing({ snapshot, effectiveness, risks: persistentRisks, patterns });
    const briefingDocument = buildExecutiveBriefingDocument({ analytics: { effectiveness, persistentRisks, patterns, briefing } });
    const alerts = buildExecutiveAlerts({ risks: persistentRisks, effectiveness, freshness: 'live' });
    const learning = buildOutcomeLearning({ decisions, impacts, persistentRisks });
    res.json({ success: true, analytics: { effectiveness, persistentRisks, patterns, briefing, briefingDocument, alerts, learning }, meta: { source: 'Nexus Executive Analytics', storage: storageMode('decisions', 'impacts', 'health') } });
  } catch (error) {
    const status = ['PERSISTENCE_NOT_CONFIGURED', 'IMPACT_PERSISTENCE_NOT_CONFIGURED', 'HEALTH_SNAPSHOT_STORE_NOT_CONFIGURED'].includes(error.code) ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Client Logs (Dossiê) — histórico de reuniões e relacionamento por cliente.
//
// Diferente do resto do Nexus, esta rota devolve dado bruto de relacionamento
// (títulos e datas de reunião, dias desde o último contato) e não alimenta
// nenhuma tela. Num painel de acesso público por link, isso é exposição sem
// contrapartida: qualquer pessoa com a URL lia o histórico da carteira inteira.
// Fica atrás da barreira administrativa até que alguma superfície a consuma.
app.get('/api/dashboard/clients-logs', requireAdminAccess, async (req, res) => {
  try {
    const [logs, futureMeetings, posts, demands, bottlenecks] = await Promise.all([
      mondayIntegration.getClientLogs(),
      getFutureMeetings(),
      mondayIntegration.getOpenPosts(),
      mondayIntegration.getDelayedDemands(),
      mondayIntegration.getClientBottlenecks()
    ]);

    const findClientPosts = clientName => (posts.ranking || []).find(row => {
      const rowName = row.name.toLowerCase();
      const name = clientName.toLowerCase();
      return rowName === name || rowName.includes(name) || name.includes(rowName);
    });

    for (const client of logs) {
      const clientNameLower = client.name.toLowerCase();
      client.futureMeetings = futureMeetings.filter(m => m.title.toLowerCase().includes(clientNameLower));
      const clientPosts = findClientPosts(client.name);
      const delayedDemands = (demands || []).filter(demand => {
        const demandClient = (demand.cliente || '').toLowerCase();
        return demandClient === clientNameLower || demandClient.includes(clientNameLower) || clientNameLower.includes(demandClient);
      }).length;
      const openPosts = clientPosts?.open || 0;
      const delayedPosts = (clientPosts?.delayedPrazo || 0) + (clientPosts?.delayedVeiculacao || 0);
      const relationshipStatus = client.daysSinceLastMeeting === null
        ? 'no-history'
        : client.daysSinceLastMeeting >= 30
          ? 'critical'
          : client.daysSinceLastMeeting >= 15
            ? 'warning'
            : 'healthy';
      const nextAction = client.futureMeetings.length > 0
        ? 'Preparar próxima reunião'
        : client.daysSinceLastMeeting === null
          ? 'Agendar primeira reunião'
          : delayedPosts > 0 || delayedDemands > 0
            ? 'Destravar operação atrasada'
            : 'Manter cadência de relacionamento';

      client.relationshipStatus = relationshipStatus;
      client.meetingCount = client.meetings.length;
      client.operational = {
        openPosts,
        delayedPosts,
        delayedDemands,
        nextAction
      };
      const missingPlanning = (bottlenecks.missingPlanning || []).some(name => name.toLowerCase() === clientNameLower || name.toLowerCase().includes(clientNameLower) || clientNameLower.includes(name.toLowerCase()));
      const missingDashboard = (bottlenecks.missingDashboard || []).some(name => name.toLowerCase() === clientNameLower || name.toLowerCase().includes(clientNameLower) || clientNameLower.includes(name.toLowerCase()));
      client.healthScore = buildClientHealthScore({
        clientName: client.name,
        daysSinceLastMeeting: client.daysSinceLastMeeting,
        openPosts,
        delayedPosts,
        delayedDemands,
        missingPlanning,
        missingDashboard,
        auditStatus: client.auditStatus || 'not_integrated'
      });
      if (process.env.NEXUS_HEALTH_AUTOSAVE === 'true') {
        try {
          await saveHealthSnapshot({ clientId: client.id || client.name, clientName: client.name, healthScore: client.healthScore });
        } catch (healthError) {
          console.warn('[API] Health Snapshot não persistido:', healthError.message);
        }
      }
    }

    res.json({
      success: true,
      logs,
      meta: { source: 'Monday.com + Google Calendar', generatedAt: new Date().toISOString(), freshness: 'live', healthModel: 'client-health-v2' }
    });
  } catch (error) {
    console.error("[API] Erro ao buscar logs de clientes:", error);
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor AI rodando na porta ${PORT}`);
    console.log(`Esperando chamadas de auditoria do frontend...`);
  });
  setInterval(() => {}, 1000 * 60 * 60);
}

export default app;

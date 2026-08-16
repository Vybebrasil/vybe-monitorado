import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { auditProfile } from './scraper-module.js';
import mondayIntegration from './integrations/monday.js';
import { getFutureMeetings } from './integrations/calendar.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

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

app.post('/api/audit/:id', async (req, res) => {
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
app.get('/api/prompt/:id', async (req, res) => {
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
app.post('/api/save/:id', express.json(), (req, res) => {
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
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NOVO ENDPOINT: Command Center / Métricas Executivas do Monday
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const [bottlenecks, posts, demands] = await Promise.all([
      mondayIntegration.getClientBottlenecks(),
      mondayIntegration.getOpenPosts(),
      mondayIntegration.getDelayedDemands()
    ]);

    res.json({
      success: true,
      metrics: {
        bottlenecks,
        posts,
        demands
      },
      meta: { source: 'Monday.com', generatedAt: new Date().toISOString(), freshness: 'live' }
    });
  } catch (error) {
    console.error("[API] Erro ao buscar métricas do Monday:", error);
    res.status(500).json({ error: error.message });
  }
});

// NOVO ENDPOINT: Client Logs (Dossiê)
app.get('/api/dashboard/clients-logs', async (req, res) => {
  try {
    const logs = await mondayIntegration.getClientLogs();
    const futureMeetings = await getFutureMeetings();

    // Mesclar reuniões futuras com os clientes baseados no nome
    logs.forEach(client => {
      // Procura eventos cujo título contém o nome do cliente (case insensitive)
      const clientNameLower = client.name.toLowerCase();
      
      const clientFutures = futureMeetings.filter(m => m.title.toLowerCase().includes(clientNameLower));
      client.futureMeetings = clientFutures;
    });

    res.json({
      success: true,
      logs,
      meta: { source: 'Monday.com + Google Calendar', generatedAt: new Date().toISOString(), freshness: 'live' }
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
}

export default app;

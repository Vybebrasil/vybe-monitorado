const fs = require('fs');
let c = fs.readFileSync('server/index.js', 'utf8');
const searchString = `Sua tarefa é analisar friamente estes dados reais e atualizar a análise deles.
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
Sempre retorne as chaves EXATAMENTE como pedidas.\`;`;

const replaceString = `Sua tarefa é analisar friamente estes dados reais e GERAR UMA NOVA ANÁLISE PROFUNDA para eles.
PREENCHA o template JSON abaixo substituindo os textos entre colchetes pela sua análise real. 
NÃO USE OS TEXTOS DE EXEMPLO, gere conteúdo inédito e específico para os dados recebidos. 
O array "issues" deve conter quantos problemas reais você encontrar (geralmente 2 ou 3).
Retorne APENAS o objeto JSON válido (sem \`\`\`json ou texto extra):

{
  "igStats": "[Escreva aqui um texto curto e direto relatando APENAS fatos reais da raspagem (seguidores, tempo sem postar, engajamento médio).]",
  "cmoDirective": "[Escreva aqui um parágrafo forte e estratégico baseado nos fatos reais. Qual o risco?]",
  "issues": [
    {
      "title": "[NOME REAL do problema encontrado]",
      "evidence": "[Evidência real dos dados raspeados]",
      "rationale": "[Por que isso é um problema estratégico?]",
      "impact": "[O que ganhamos ao resolver isso?]",
      "steps": ["[Passo prático real 1]", "[Passo prático real 2]"]
    }
  ]
}\`;`;

c = c.replace(searchString, replaceString);
fs.writeFileSync('server/index.js', c);

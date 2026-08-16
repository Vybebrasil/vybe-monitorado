const fs = require('fs');

const content = fs.readFileSync('src/data/clients.js', 'utf8');

// The new correct channels array for copirece
const newCopireceChannels = `    channels: [
      {
        name: "Instagram / Estratégia Visual",
        status: "critical",
        issues: [
          {
            title: "Baixa ativação da base de seguidores",
            evidence: "O perfil possui 17 mil seguidores. Em três publicações recentes com contagens públicas encontradas pelo Google, foram registrados 10, 22 e 10 engajamentos somando curtidas e comentários, média de 14 por publicação, equivalente a aproximadamente 0,08% da base. ([Instagram](https://www.instagram.com/copirece/?utm_source=chatgpt.com))",
            rationale: "A quantidade de seguidores não está se traduzindo em resposta proporcional ao conteúdo publicado. Isso reduz a capacidade orgânica do perfil de manter atenção e distribuir mensagens comerciais ou institucionais.",
            impact: "Elevar a interação por publicação aumenta a quantidade de sinais reais de interesse da audiência e cria uma base mais responsiva para conteúdos de produto, marca e distribuição.",
            steps: [
              "Redesenhar a pauta priorizando conteúdos com rosto, bastidores do campo, receitas, provas de produto, comparações e histórias dos cooperados, reduzindo peças que funcionam apenas como comunicado.",
              "Testar semanalmente diferentes ganchos, capas e formatos e comparar curtidas, comentários, compartilhamentos, salvamentos e retenção para identificar os padrões que realmente movimentam a base."
            ]
          },
          {
            title: "Baixo volume de conversação",
            evidence: "Nos três posts recentes com métricas encontradas, os volumes de comentários foram 0, 2 e 1, resultando em média de 1 comentário por publicação. ([Instagram](https://www.instagram.com/copirece/p/Db29wKZu25S/?utm_source=chatgpt.com))",
            rationale: "O perfil está publicando, mas quase não está gerando conversa pública. Para uma marca ligada a alimentação, agricultura familiar e cultura regional, há espaço para transformar temas cotidianos em participação da comunidade.",
            impact: "Mais conversação permite identificar interesses, objeções, hábitos de consumo e temas com potencial para orientar conteúdo e comunicação comercial.",
            steps: [
              "Inserir perguntas específicas e fáceis de responder nas legendas e vídeos, evitando CTAs genéricos como apenas 'comente' ou 'saiba mais'.",
              "Criar séries participativas sobre cuscuz, receitas regionais, formas de consumo, memória afetiva e rotina dos produtores para estimular respostas recorrentes."
            ]
          }
        ]
      },
      {
        name: "Instagram / Marketing de Produto",
        status: "critical",
        issues: [
          {
            title: "Ocultação do Diferencial Competitivo (Não-Transgênico)",
            evidence: "Pesquisa Web e Feed: Registros do Armazém do Campo e IBD confirmam o selo Não-Transgênico, um raríssimo troféu na cadeia do milho brasileira. No Instagram, esse selo é quase invisível.",
            rationale: "Quando um cliente escolhe Flocão no supermercado, a escolha é pelo preço. A ÚNICA forma de fugir da guerra de preços é criar a categoria orgânica/saudável. A Copirecê já tem o produto, mas a comunicação visual no feed esconde.",
            impact: "Aumento de margem bruta (precificação premium) e diferenciação nacional absoluta no PDV.",
            steps: [
              "Fazer o 'Rebranding do Selo' nas redes: O selo Não-Transgênico deve ocupar o espaço visual principal de todas as campanhas.",
              "Mudar o slogan verbal nos vídeos de 'Flocão de Milho' para 'O Único Milho Puro da Região'."
            ]
          }
        ]
      },
      {
        name: "Instagram / Estratégia ESG",
        status: "warning",
        issues: [
          {
            title: "Descarte do Storytelling Familiar (Desde 1970)",
            evidence: "Auditoria Visual (Instagram): Nenhuma das publicações foca na origem do grão. O feed não conta a história de QUEM planta o milho.",
            rationale: "Uma cooperativa com meio século ajudando milhares de pequenos produtores é o sonho do marketing mundial. Mostrar o rosto enrugado e as mãos grossas do fazendeiro nordestino gera mil vezes mais venda emocional.",
            impact: "Conquista do consumidor pelo apelo emocional sustentável (ESG) e criação de lealdade inabalável.",
            steps: [
              "Inaugurar a série documental em Reels 'As Mãos que Alimentam'. Filmar o campo e o suor da agricultura familiar.",
              "Vincular cada pacote a uma história real nos Stories."
            ]
          }
        ]
      }
    ]`;

// Manually replace everything between `kpis: [...],` and `  },\n  {\n    id: "hebravet",`
const startIdx = content.indexOf('kpis: ["Brand Equity", "Share of Voice", "Margem de Lucro Bruta"],') + 'kpis: ["Brand Equity", "Share of Voice", "Margem de Lucro Bruta"],'.length;
const endIdx = content.indexOf('  },\n  {\n    id: "hebravet",');

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = content.substring(0, startIdx) + '\n' + newCopireceChannels + '\n' + content.substring(endIdx);
  fs.writeFileSync('src/data/clients.js', newContent, 'utf8');
  console.log('Fixed copirece!');
} else {
  console.log('Could not find boundaries.');
}

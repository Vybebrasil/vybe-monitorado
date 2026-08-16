export const clients = [
  {
    id: "conectasim",
    name: "ConectaSim",
    niche: "ISP / Telecom",
    status: "critical",
    businessIntelligence: {
      address: "Irecê - BA (rebranding de Intersousa Provedor)",
      coreAsset: "Infraestrutura 100% Fibra Óptica / Parceria MAX e Paramount+",
      googleRating: "Não gerenciado ativamente (Vulnerável a detratores)",
      officialSite: "conectasim.net.br | @intersousa_provedor (handle antigo ainda ativo)",
      igStats: `O perfil possui 6.744 seguidores, segue 230 contas e está há 5 dias sem publicar. O engajamento médio calculado consta em 103,12% (média de 6.877 curtidas por post), contudo esse número é fortemente distorcido por um único Reel viral com 82.485 curtidas e 923 comentários. Todas as outras 5 publicações recentes (fotos e carrossel) registraram entre 0 e 5 curtidas e 0 comentários. O nome do perfil ainda carrega a marca antiga: 'Intersousa agora é ConectaSim!'.`
    },
    cmoDirective: `O engajamento de 103% é uma ilusão estatística perigosa. Vocês ganharam na loteria do algoritmo com um Reel de humor, mas a realidade diária do perfil é um deserto: posts estáticos com zero comentários e curtidas irrelevantes. O público de Telecom não quer ver artes genéricas de banco de dados nem saudações institucionais frias. Eles responderam exatamente ao que funciona (humor sobre jogos e relacionamento contextualizado com internet). Além disso, carregar a marca antiga no nome oficial transmite amadorismo e transição mal executada. Se não pivotarem 80% do conteúdo para vídeo/Reels interativos e não limparem o posicionamento da marca agora, continuarão falando sozinhos e rasgando orçamento.`,
    kpis: ["Taxa de Conversão da Bio", "Custo de Aquisição de Cliente (CAC)", "LTV (Tempo de Retenção)"],
    channels: [
      {
        name: "Instagram / Estratégia de Conteúdo",
        status: "critical",
        issues: [

          {
            title: `Ilusão Métrica e Abismo de Engajamento entre Formatos`,
            evidence: `Um Reel de humor obteve 82.485 curtidas e 923 comentários, enquanto os 5 posts estáticos/carrossel seguintes somaram, juntos, apenas 13 curtidas e 0 comentários.`,
            rationale: `Imagens estáticas institucionais não possuem alcance orgânico no Instagram atual para o nicho B2C. O público da ConectaSim busca entretenimento e identificação rápida.`,
            impact: `Aumento real e consistente de alcance orgânico e conversão de novos clientes locais.`,
            steps: [
              `Eliminar artes estáticas genéricas e institucionais do fluxo principal.`,
              `Realocar a produção para Reels de 15 a 30 segundos focados no cotidiano de quem usa internet (games, home office, streaming, perrengues de conexão).`,
              `Aproveitar o gancho do Reel viral para criar uma série fixa de conteúdo humorístico sobre rotina de conexão.`
            ]
          },
          {
            title: `Identidade de Marca Poluída e Rebranding Inacabado`,
            evidence: `O campo 'Nome' do perfil está preenchido como 'Intersousa agora é ConectaSim!'.`,
            rationale: `Manter a menção da empresa antiga no topo do perfil gera ruído visual, reduz a autoridade da nova marca e prejudica a otimização de busca (SEO) dentro da rede.`,
            impact: `Fortalecimento do branding ConectaSim e otimização do perfil nas buscas por provedores na região.`,
            steps: [
              `Alterar o campo Nome para 'ConectaSim | Internet Fibra Bahia' para capturar termos de busca locais.`,
              `Criar um destaque fixo intitulado 'Nossa História' ou 'Intersousa' para sanar dúvidas de clientes antigos sem poluir o topo do perfil.`
            ]
          },
          {
            title: `Inconstância de Publicação e Desperdício de Tração Algorítmica`,
            evidence: `Giro de 5 dias sem postagens após atingir um pico de 82 mil curtidas em um vídeo.`,
            rationale: `Deixar o perfil inativo após uma viralização destrói a janela de oportunidade de reter e converter os novos visitantes atraídos pelo vídeo viral.`,
            impact: `Aproveitamento do pico de tráfego para retenção de audiência e geração diária de leads via Direct e WhatsApp.`,
            steps: [
              `Estabelecer frequência rígida de postagem (mínimo de 4 a 5 Reels semanais).`,
              `Implementar rotina diária de Stories focado em prova social, bastidores do atendimento humanizado e chamadas diretas para assinatura do plano.`
            ]
          }
        ]
      },
      {
        name: "Google Meu Negócio & SEO Local",
        status: "critical",
        issues: [
          {
            title: "Vulnerabilidade de Reputação Online (NPS)",
            evidence: "Pesquisa Web e Análise de Comportamento de Consumo de ISP: Provedores tendem a receber avaliações orgânicas apenas quando o serviço cai. A falta de um motor ativo de reviews deixa a nota refém de detratores.",
            rationale: "Quando um novo morador pesquisa 'provedor de internet Irecê' no Google, a decisão de clique é 90% baseada nas estrelinhas. Sem um processo para captar avaliações 5 estrelas ativamente, a nota despenca.",
            impact: "Aumento do tráfego orgânico no Google Maps e blindagem impenetrável contra ataques de concorrentes.",
            steps: [
              "Implementar rotina obrigatória: Técnico pede avaliação 5 estrelas via QR Code instantâneo assim que o roteador liga.",
              "Responder 100% das reclamações do Google com SLA inferior a 2 horas."
            ]
          }
        ]
      },
      {
        name: "Arquitetura de Marca & Web",
        status: "warning",
        issues: [
          {
            title: "Fratura de Rebranding (Intersousa vs ConectaSim)",
            evidence: "Busca em Agregadores e Google: A bio do Instagram dita 'Intersousa agora é ConectaSim'. No Google, domínios antigos como intersousa.com.br continuam ranqueando.",
            rationale: "Rebranding sem redirecionamento 301 total (SEO) e sem limpeza do legado gera confusão de confiança (Trust). O cliente novo não sabe quem é Intersousa.",
            impact: "Consolidação rápida da confiança na nova marca e recuperação massiva de PageRank no Google.",
            steps: [
              "Auditar a infraestrutura de T.I. para garantir que todos os subdomínios antigos (Intersousa) redirecionem invisivelmente para ConectaSim.",
              "Remover a frase 'Intersousa agora é...' da bio do Instagram."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "antonov",
    name: "Antonov Center",
    niche: "Fitness Premium & Wellness",
    status: "critical",
    businessIntelligence: {
      address: "Avenida 1º de Janeiro, 422, Asa Sul, Irecê - BA",
      coreAsset: "Hangar de 3.000m² / Climatizado / Locker c/ Reconhecimento Facial / Wellhub + TotalPass",
      googleRating: "Alta Reputação (Wellhub verificado)",
      officialSite: "antonovcenter.com.br",
      igStats: `Perfil com 14.812 seguidores, 13 perfis seguidos e postagem recente há 1 dia. Taxa de engajamento registrada de 4.15% com média de 594 curtidas. No entanto, os dados mostram disparidade crítica: enquanto um vídeo com atleta atingiu 4.029 curtidas e 164 comentários, postagens estáticas institucionais e motivacionais registram de 49 a 75 curtidas e zero comentários.`
    },
    cmoDirective: `A taxa de engajamento de 4.15% é uma maquiagem estatística impulsionada por um único vídeo com atleta. A realidade do perfil é um feed anestesiado por imagens estáticas genéricas que não geram conversa nem vendas. Uma academia que se posiciona como Fitness Premium & Wellness não pode se dar ao luxo de ter posts com zero comentários e legendas de clichê motivacional. Se não transformarmos a estrutura física e a tecnologia do Antonov Center em provas sociais em vídeo e funis de conversão diretos, continuaremos sendo apenas mais uma academia bonita vendendo preço e perdendo margem.`,
    kpis: ["Ticket Médio", "Taxa de Captação Wellhub", "Retenção Trimestral"],
    channels: [
      {
        name: "Omnichannel / Posicionamento B2B",
        status: "critical",
        issues: [

          {
            title: `Dependência de Outliers e Ineficácia de Conteúdo Estático`,
            evidence: `Posts motivacionais estáticos tiveram apenas 49 curtidas (0 comentários) e 75 curtidas (0 comentários), em contraste com o Reel de alta performance que alcançou 4.029 curtidas e 164 comentários.`,
            rationale: `Fotos de banco de imagem ou estáticas com legendas genéricas não transmitem a experiência Premium nem a tecnologia da marca, resultando em alcance e engajamento nulos.`,
            impact: `Aumento consistente da média de engajamento real e maior retenção de atenção sem dependência de posts virais pontuais.`,
            steps: [
              `Eliminar postagens estáticas puramente motivacionais do cronograma editorial.`,
              `Substituir o formato por Reels dinâmicos focados na experiência do aluno, bastidores, prova social e diferenciais tecnológicos da estrutura.`
            ]
          },
          {
            title: `Funil da Bio com Chamada Fraca para Conversão`,
            evidence: `A bio termina com a chamada 'Faça sua matricula! 👇', apontando para a conversão sem diferenciação da experiência de venda.`,
            rationale: `Para o nicho Premium, a jornada de compra não deve parecer uma matrícula genérica de balcão, mas sim o convite para um diagnóstico ou experiência exclusiva.`,
            impact: `Elevação na taxa de clique na bio e maior volume de leads qualificados gerados organicamente para a equipe de vendas.`,
            steps: [
              `Reformular o CTA da bio para algo de maior percepção de valor (ex: 'Agende sua Experiência VIP 👇').`,
              `Garantir que o link direciona diretamente para o WhatsApp comercial com mensagem pré-formatada ou página de agendamento ágil.`
            ]
          },
          {
            title: `Falta de Padronização no Storytelling de Posicionamento Premium`,
            evidence: `Uso esporádico da metáfora de aviação ('Decolagem autorizada', 'VÖA') misturado com comunicados operacionais de aulas sem o devido enquadramento de valor.`,
            rationale: `Marcas Premium constroem desejo através de uma narrativa coesa. Comunicar apenas horários de aulas de dança sem mostrar a atmosfera e o benefício exclusivo dilui o posicionamento de luxo.`,
            impact: `Fortalecimento do branding, maior percepção de valor percebido e justificativa de ticket médio superior na região de Irecê.`,
            steps: [
              `Criar quadros fixos de conteúdo alinhados ao conceito de 'alta performance e estilo de vida'.`,
              `Reestruturar os Destaques do perfil em categorias estratégicas: Estrutura, Tecnologia, Aulas, Atletas e Acesso VIP.`
            ]
          }
        ]
      },
      {
        name: "Instagram / Identidade Visual",
        status: "warning",
        issues: [
          {
            title: "Poluição Promocional vs Autoridade",
            evidence: "Auditoria Visual: O feed intercala cores fortes e fontes agressivas, com layouts pesados em texto.",
            rationale: "O design atual grita 'Promoção' em vez de gritar 'Excelência'. O hangar é moderno (reconhecimento facial). O visual digital precisa espelhar essa tecnologia (Dark Mode, vídeos cinematográficos FPV).",
            impact: "Alinhamento estético entre a estrutura física multimilionária e a vitrine de R$0 do Instagram.",
            steps: [
              "Adotar um Design System 'Dark/Premium'. Menos texto, mais textura dos equipamentos.",
              "Gravar um vídeo manifesto de 60 segundos ('O Maior Centro de Treinamento da Bahia') e fixar no topo."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "copirece",
    name: "Copirecê Puro Milho",
    niche: "Agroindústria / Alimentos",
    status: "critical",
    businessIntelligence: {
      address: "Irecê - BA (Cooperativa desde 1970)",
      coreAsset: "Selo IBD Não-Transgênico / Canal Armazém do Campo (distribuição nacional)",
      googleRating: "Reconhecimento Nacional",
      officialSite: "linktr.ee/_copirece",
      igStats: `Um texto curto e direto relatando APENAS fatos (seguidores, tempo sem postar, engajamento médio). Sem adjetivos ou jargões.`
    },
    cmoDirective: `Parágrafo forte, visão estratégica baseada nos fatos descritos. O que está errado? Qual o risco? Linguagem afiada.`,
    kpis: ["Brand Equity", "Share of Voice", "Margem de Lucro Bruta"],
    channels: [
      {
        name: "Instagram / Estratégia Visual",
        status: "critical",
        issues: [\nNEW_ISSUES\n        ] // end
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
    ]
  },
  {
    id: "hebravet",
    name: "Hebravet",
    niche: "Saúde Veterinária (Alta Complexidade)",
    status: "critical",
    businessIntelligence: {
      address: "Av. 1º de Janeiro, 422, Loja 01 – Antonov Center, Irecê - BA",
      coreAsset: "Centro Cirúrgico / Internação 24h / UTI Animal",
      googleRating: "Verificado no Google Maps",
      officialSite: "linktr.ee/hebravet",
      igStats: "⚠️ ALERTA CRÍTICO: Apenas 5.840 seguidores e SOMENTE 30 posts em toda a existência do perfil. Para uma clínica com Centro Cirúrgico, isso é praticamente abandono digital. Média histórica de menos de 3 posts por mês."
    },
    cmoDirective: "Ruptura Total do Trust Protocol (Quebra de Confiança). A clínica vende medicina intensiva (Centro Cirúrgico), mas o Instagram utiliza artes de baixa qualidade (silhuetas, vetores genéricos) que comunicam insalubridade e impessoalidade.",
    kpis: ["Agendamentos de Cirurgia", "Taxa de Conversão por Indicação Médica"],
    channels: [
      {
        name: "Instagram / Humanização C-Level",
        status: "critical",
        issues: [
          {
            title: "O Efeito 'Ghosting' na Equipe Médica",
            evidence: "Auditoria Visual: O post fixado ('Conheça Nossa Equipe') utiliza silhuetas de sombra preta no lugar de fotografias reais dos médicos veterinários.",
            rationale: "Quando um tutor leva um pet para cirurgia, ele está entregando um membro da família. A barreira de entrada é o 'Medo da Morte'. Silhuetas negras geram um gatilho subconsciente de clandestinidade, desumanização e falta de transparência.",
            impact: "Aumento de até 60% na retenção visual do perfil e construção sólida de confiança clínica.",
            steps: [
              "Deletar IMEDIATAMENTE a arte das silhuetas. Agendar um ensaio fotográfico corporativo (Roupas Brancas, Sorrisos, Pets Reais).",
              "Apresentar as credenciais técnicas (Especialidades, Títulos) de cada cirurgião em formato Carrossel limpo."
            ]
          }
        ]
      },
      {
        name: "Direção de Arte / Identidade",
        status: "warning",
        issues: [
          {
            title: "Inconsistência Cromática e Falta de Assepsia Visual",
            evidence: "Inspeção Cruzada: A clínica alega ter Centro Cirúrgico, mas as artes misturam verde radioativo, fontes infantis e excesso de texto.",
            rationale: "No marketing de saúde, a paleta de cores do Instagram dita a higiene percebida do local. Cores caóticas ou vibrantes demais comunicam poluição mental. Fontes finas, fundos brancos comunicam esterilização e paz técnica.",
            impact: "Reposicionamento imediato da percepção de preço. O cliente para de barganhar quando o ambiente digital cheira a hospital premium.",
            steps: [
              "Instituir um Design System rigoroso: Bloquear uso de fontes cursivas/infantis. Usar fontes Suíças.",
              "Priorizar fotografias reais em luz fria (centro cirúrgico)."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "hellen",
    name: "Hellen Rocha",
    niche: "Advocacia Previdenciária B2C",
    status: "critical",
    businessIntelligence: {
      address: "Irecê, BA",
      coreAsset: "Especialização em BPC LOAS / Previdência Rural / Trabalhador do Campo",
      googleRating: "Não ranqueada no GMB",
      officialSite: "advhellenrocha.com.br",
      igStats: "DADO REAL (API): 1.005 seguidores | 1.353 seguindo | 349 posts | CONTA PRIVADA. Bio real: '📌Fortal- Ce #nurse/cuidados paliativos/Uti @wildsoncarneiro'. ATENÇÃO: a bio indica que Hellen Rocha é de Fortaleza (CE) e trabalha como enfermeira de UTI/cuidados paliativos — não há menção de advocacia na bio. A conta está PRIVADA, o que impede qualquer crescimento orgânico."
    },
    cmoDirective: "Conta Privada de Enfermeira em Fortaleza Sendo Gerenciada como Advogada em Irecê. A bio real diz 'Fortal-CE' e '#nurse' — não 'advogada' nem 'Irecê'. Ou o perfil está desatualizado, ou é a pessoa errada. Com a conta privada, nenhum potencial cliente novo encontra o perfil. Isso precisa ser verificado com a cliente antes de qualquer estratégia.",
    kpis: ["MQLs Qualificados (Casos Validados)", "Redução do Custo por Mensagem (CPA)"],
    channels: [
      {
        name: "Acessibilidade & User Experience",
        status: "critical",
        issues: [
          {
            title: "Desrespeito Absoluto às Leis de Acessibilidade (WCAG)",
            evidence: "Auditoria Visual (Série 'Advocacia da Vida Real'): A advogada insere textos em fonte fina, na cor branca, passando por cima do próprio rosto e de cenários em movimento.",
            rationale: "O público de previdenciário (Idosos, Agricultores) geralmente possui mais de 60 anos, tela pequena e desgaste visual. Colocar fontes brancas finas sem contraste é literalmente impedir o cliente de ler a oferta. É um erro de usabilidade gravíssimo.",
            impact: "Restauração maciça do tempo de retenção nos vídeos (Read Through Rate).",
            steps: [
              "Toda copy (texto na tela) de Reels deve obrigatoriamente estar sobre um fundo sólido escuro ou ter um Drop Shadow agressivo de 80% de opacidade.",
              "Aumentar o tamanho das fontes em pelo menos 30%."
            ]
          }
        ]
      },
      {
        name: "Estratégia de Funil & Posicionamento",
        status: "warning",
        issues: [
          {
            title: "Divergência entre a Bio (Passiva) e o Conteúdo (Ativo)",
            evidence: "Pesquisa Multicanal: No site e Feed, ataca dores fortes. Na Bio, a abordagem é passiva: 'Advogada há +10 anos, Especialista'.",
            rationale: "A Bio de uma advogada focada em Dor Aguda não pode ser o currículo dela. O cliente desesperado quer o fim da dor aguda: 'Destravando sua Aposentadoria Negada e Benefícios Rurais. Fale direto comigo aqui ⬇️'.",
            impact: "Aumento da Taxa de Clique (CTR) no link da Bio.",
            steps: [
              "Fazer a virada de copywriting na Bio. Remover os adjetivos e colocar Verbos de Ação.",
              "Padronizar as CTAs nos vídeos para apontar sempre para uma dor específica."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "diacenter_clinica",
    name: "DiaCenter (Hemodiálise)",
    niche: "Saúde Especializada (Alta Complexidade)",
    status: "critical",
    businessIntelligence: {
      address: "Loteamento Nova Conquista, S/N, Irecê - BA | Tel: (74) 3642-1609",
      coreAsset: "Clínica de Hemodiálise / Terapia Renal Substitutiva / Diagnóstico Cardiológico",
      googleRating: "Cadastrado no CNES (MS)",
      officialSite: "flowcode.com/page/clinicadiacenterirece",
      igStats: "6.505 seguidores | 1.237 posts | Seguindo 836 — Alto volume de posts (ativo), mas a bio aponta para um Flowcode genérico em vez de uma landing page de qualidade."
    },
    cmoDirective: "Dissonância Bruta de Canal de Aquisição. A clínica trata da condição mais assustadora que uma família pode enfrentar (doença renal crônica), mas o Instagram é usado como um painel de recados de Recursos Humanos e eventos administrativos.",
    kpis: ["Sentimento de Marca (NPS Familiar)", "Parcerias de Encaminhamento Médico (B2B)"],
    channels: [
      {
        name: "Instagram / Branding C-Level",
        status: "critical",
        issues: [
          {
            title: "Efeito 'Painel de RH' (Poluição do Funil B2C)",
            evidence: "Auditoria Visual (Pesquisa Web e Insta): A clínica atende pacientes em hemodiálise (altamente vulneráveis). Mas o conteúdo visível inclui postagens corporativas como 'Temos Vaga para Auxiliar de Limpeza' e 'Enfermeiro'.",
            rationale: "Um paciente prestes a iniciar hemodiálise está apavorado. Ao buscar o Instagram e dar de cara com anúncios de vagas de limpeza, a percepção de 'refúgio seguro médico' desaba. Vagas operacionais devem ir para LinkedIn, não para o vitrine do paciente.",
            impact: "Filtragem instantânea de público, devolvendo a aura de santuário de esperança para a marca.",
            steps: [
              "Migrar imediatamente 100% dos anúncios de recrutamento e vagas operacionais para o LinkedIn corporativo.",
              "Substituir pela série documental 'Vidas que Fluem', focando em relatos emocionais de pacientes que recuperaram a qualidade de vida."
            ]
          }
        ]
      },
      {
        name: "Posicionamento B2B vs B2C",
        status: "warning",
        issues: [
          {
            title: "Indefinição do Herói da Jornada",
            evidence: "Análise da Copy: A bio diz 'Terapia Renal Substitutiva... 10 anos focando no bem estar'.",
            rationale: "O paciente não consome terapia renal por prazer. O herói da comunicação não deve ser o tempo de mercado (10 anos), mas a 'Devolução da Qualidade de Vida'. Faltam fotos das poltronas confortáveis e da distração durante as 4 horas de máquina.",
            impact: "Destruir a objeção de medo (Gatilho da Segurança) das famílias dos pacientes novos.",
            steps: [
              "Criar a série em vídeo de alta qualidade 'Como é uma sessão na DiaCenter?', guiando o público pelo conforto da clínica."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "mangaba",
    name: "Mangaba AI",
    niche: "SaaS Enterprise / Inteligência Artificial",
    status: "critical",
    businessIntelligence: {
      address: "Operação Digital / Bahia (Brasil)",
      coreAsset: "Framework A2A Open Source / Suporte MCP / Agentes LGPD-compliant para RH e Jurídico",
      googleRating: "Tração em comunidades Dev (GitHub)",
      officialSite: "mangaba.chat | mangabarouter.online | mangaba-agent.online (3 domínios fragmentados)",
      igStats: "⚠️ Perfil @mangabaia não retornou dados (ogDesc vazio) — perfil possivelmente privado, inexistente ou com handle diferente. Presença no Instagram não confirmada."
    },
    cmoDirective: "Posicionamento Enigmático Repelente B2B. A Mangaba é uma potência tecnológica brasileira. Mas a comunicação atual é uma galeria abstrata inútil para o CTO e Diretor que vão assinar o cheque corporativo.",
    kpis: ["MQLs e Demos Agendadas Mensais", "CAC B2B Corporativo"],
    channels: [
      {
        name: "LinkedIn & Social Selling",
        status: "critical",
        issues: [
          {
            title: "A Síndrome de Vender Filosofia em vez de Ferramenta",
            evidence: "Pesquisa Ampla (Web, GitHub): Eles possuem um framework robusto de IA local e agentes especialistas para RH/Jurídico. Porém, no Insta/LinkedIn, eles publicam fundos laranjas maciços, com fotos de mangas e frases filosóficas esotéricas.",
            rationale: "O CEO ou Diretor de TI de uma grande empresa está enfrentando dores sangrentas: Corte de Custos, Automação LGPD. Ele precisa ver a MÁQUINA funcionando, não a poesia da máquina. Ocultar mockups reais de dashboards afasta quem tem poder de compra corporativo.",
            impact: "Agendamento quase imediato de demonstrações Enterprise após tangibilizar o valor do software.",
            steps: [
              "Fim das artes abstratas laranjas. O design B2B Tech exige Dark Mode sólido, tipografia Suíça estrita e visualização de dados (Mockups).",
              "Publicar 'Estudos de Caso Visuais' de 60 segundos gravando a tela do sistema da Mangaba despachando rotinas sozinhas."
            ]
          }
        ]
      },
      {
        name: "Arquitetura Web (Go-To-Market)",
        status: "warning",
        issues: [
          {
            title: "Diluição de Múltiplos Domínios",
            evidence: "Auditoria SEO: A pesquisa revelou 3 portais paralelos soltos: mangaba.chat, mangabarouter.online, mangaba-agent.online.",
            rationale: "Em startups SaaS, fraturar o ecossistema em vários domínios enfraquece a Domain Authority (DA) do Google e confunde o comprador corporativo.",
            impact: "Unificação do SEO e direcionamento fluído do usuário.",
            steps: [
              "Unificar a arquitetura sob um domínio master (ex: mangaba.ai) e usar subdiretórios (/chat, /developers, /enterprise)."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "brussolo",
    name: "Brussolo Ristorante",
    niche: "Alta Gastronomia",
    status: "critical",
    businessIntelligence: {
      address: "Rua Lafaiete Coutinho, 217, Alto do Moura, Irecê - BA",
      coreAsset: "Culinária Assinada / Soft-Opening em Andamento",
      googleRating: "Pré-Lançamento (sem GMB ativo)",
      officialSite: "brussolo.com.br (captação de newsletter VIP)",
      igStats: "⚠️ Perfil @brussolo.ristorante não retornou ogDesc — handle com ponto pode estar incorreto ou perfil com baixo engajamento. Verificação manual necessária."
    },
    cmoDirective: "Falha Crítica no Soft-Opening. Um restaurante de alta gastronomia que será inaugurado promete técnicas de alto padrão, mas a vitrine atual é puramente administrativa e carece brutalmente de 'Appetite Appeal'.",
    kpis: ["Taxa de Reserva (Lista de Espera)", "Custo por Acesso (Landing Page)"],
    channels: [
      {
        name: "Instagram (Estratégia de Pré-Lançamento)",
        status: "critical",
        issues: [
          {
            title: "Desvio de Hype para Processos de RH",
            evidence: "Web + Insta: O Brussolo abre em breve. O site foca em captação VIP (Newsletter). Mas o Feed do Insta está contaminado com vagas burocráticas ('Contrata-se').",
            rationale: "Restaurante premium não vende comida no pré-lançamento. Vende HYPE, exclusividade e escassez. A vitrine não pode ser um balcão de empregos do SINE. O erro de RH destrói o fator 'Luxo'.",
            impact: "Construção de uma lista de espera robusta e esgotamento das reservas antes de abrir.",
            steps: [
              "Arquivar IMEDIATAMENTE todas as vagas operacionais do Instagram Público. Usar tráfego local fechado no WhatsApp.",
              "Substituir tudo por Food Porn Cinematográfico: closes em macro de ingredientes da região, azeite caindo, pratos sendo montados."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "gonzalez",
    name: "Gonzalez Gastronomia",
    niche: "Restaurante Contemporâneo",
    status: "warning",
    businessIntelligence: {
      address: "Rua Rio São Francisco, 385, Irecê - BA, 44900-000",
      coreAsset: "Menu Diversificado (Risotos, Pizza Napolitana) / iFood / Google 4.8",
      googleRating: "4.8/5 (Restaurant Guru + Google — verificado)",
      officialSite: "gonzalezgastronomia.com",
      igStats: "18K seguidores | 445 posts | Seguindo 291 — Melhor ratio da carteira. 18K seguidores para um restaurante de cidade média é excelente. O problema está na estratégia de conteúdo, não no alcance."
    },
    cmoDirective: "Ocultação de Prova Social e Dificuldade na Hierarquia de Vendas. Eles possuem altíssima validação externa (avaliações) e cardápio de luxo, mas apresentam isso no Instagram como um menu misto sem storytelling envolvente.",
    kpis: ["Ticket Médio no Presencial", "Engajamento Sensorial B2C"],
    channels: [
      {
        name: "Instagram / Estratégia de Cardápio Virtual",
        status: "warning",
        issues: [
          {
            title: "Desperdício da Avaliação 4.8 e Falta de Segmentação",
            evidence: "Web: A nota orgânica do Google é fenomenal (4.8). Eles servem Risoto sofisticado ao meio-dia e Pizza Napolitana à noite. O feed publica isso como se fosse tudo o mesmo balcão.",
            rationale: "Quando um negócio tem avaliações perfeitas na Web, elas não podem ficar escondidas no fundo do Google. Elas são o maior ativo de conversão do CMO. Além disso, misturar a persona do 'Jantar Romântico' com a do 'Delivery de Quinta' no mesmo feed confunde o cliente.",
            impact: "Aumento instantâneo de prestígio (Ancoragem de Preço Alto sem dor).",
            steps: [
              "Implementar o pilar editorial 'O que Dizem sobre Nós', pegando as avaliações 5 estrelas mais descritivas da web e transformando em peças gráficas chiques minimalistas.",
              "Separar as personas por iluminação e cor no Feed."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "deputado",
    name: "Dep. João Bacelar",
    niche: "Assessoria Política / Mandato",
    status: "critical",
    businessIntelligence: {
      address: "Câmara dos Deputados (Brasília) / Base Eleitoral: Irecê e Chapada Diamantina - BA",
      coreAsset: "Mandato Federal / Emendas Parlamentares Ativas / 32K seguidores orgânicos",
      googleRating: "Perfil público verificável no site da Câmara",
      officialSite: "camara.leg.br",
      igStats: "DADO REAL (API): 32.184 seguidores | 1.140 posts | Seguindo 3.977 | Postou HOJE. Engajamento: 0.34% (85 likes médios). Perfil VERIFICADO ✓. Bio real: '🔹Deputado Federal - 5º mandato 📍Mandato atuante por todo Estado 🔹Recordista em investimentos na Bahia 💪 Aqui, trabalho se transforma em resultado'. Último post: campanha eleitoral — 'É amanhã! ⏳ Nossa campanha terá o start oficial e você já vai poder saber...'"
    },
    cmoDirective: "Frequência Alta, Impacto Zero. O perfil posta diariamente (1.140 posts) e tem 32K seguidores verificados, mas 0.34% de engajamento é anêmico para um mandatário público. 85 likes em 32K seguidores significa que 99.7% da base não reage ao conteúdo. Político com essa taxa de engajamento não mobiliza eleitores — só acumula números. O conteúdo atual (posts institucionais sobre investimentos e mandato) não gera emoção nem compartilhamento.",
    kpis: ["Engajamento Orgânico C-Level (Povo)", "Compartilhamentos via WhatsApp Rural"],
    channels: [
      {
        name: "Comunicação Visual e Storytelling",
        status: "critical",
        issues: [
          {
            title: "Invisibilidade do Eleitor no Polo Ativo da Narrativa",
            evidence: "Auditoria Visual Fina: O Deputado figura sozinho ou com outras autoridades políticas formais na imensa maioria do grid. As fontes na tela (Lettering) são genéricas e institucionais.",
            rationale: "O eleitor vota por esperança (ganho de vida) ou raiva (dor aliviada). Ver o deputado em Brasília com o ministro não tangibiliza o ganho. O que tangibiliza é a câmera focar no rosto de uma senhora da zona rural recebendo a obra.",
            impact: "Explosão de distribuição orgânica. Eleitores comuns compartilham vídeos de emoção autêntica na comunidade deles.",
            steps: [
              "Proibir terminantemente galerias de imagens de reuniões institucionais como destaque de Feed.",
              "Adoção da Regra 3x1 C-Level: A cada 1 postagem de gabinete, 3 vídeos brutos (Raw Video) abraçando a ponta da linha (o povo)."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "alpha1",
    name: "Alpha 1 Consultoria (Algar)",
    niche: "Vendas B2B Corporativas (Telecom)",
    status: "critical",
    businessIntelligence: {
      address: "Atuação Maceió/AL e região Bahia",
      coreAsset: "Representante Autorizado Algar Telecom / Suporte em eventos culturais regionais",
      googleRating: "Não ranqueada localmente no Google Maps",
      officialSite: "linktr.ee/grupoalpha1 (sem domínio próprio)",
      igStats: "1.421 seguidores | 473 posts | Seguindo 222 — Volume de posts alto (473) para poucos seguidores (1.421). Taxa de crescimento baixíssima: menos de 1K seguidores com quase 500 posts publicados indica conteúdo que não converte e não viraliza."
    },
    cmoDirective: "Desalinhamento Corporativo Extremo. A empresa é representante autorizada de uma gigante B2B (Algar Telecom) vendendo infraestrutura pesada, mas o feed de Instagram mistura anúncios locais desconexos (festas de Alagoas) e sofre da Síndrome de Vendedor de Chip.",
    kpis: ["Geração de Leads Enterprise", "Autoridade de Marca Regional"],
    channels: [
      {
        name: "LinkedIn & Automação B2B",
        status: "critical",
        issues: [
          {
            title: "Uso do Canal Errado para Captura de Leads High-Ticket",
            evidence: "Pesquisa Multicanal: A marca vende links dedicados e telefonia corporativa complexa da Algar. Mas gasta esforço panfletando artes no Instagram para o consumidor final, apoiando shows e postando felicitações.",
            rationale: "O Diretor de TI de uma fazenda de Irecê que precisa comprar R$200 mil em infraestrutura não procura fornecedor no feed do Instagram. Venda B2B Tech acontece no LinkedIn através de Cold Outreach e ABM. O feed atual desqualifica a Alpha 1.",
            impact: "Aumento rápido da conversão focando exclusivamente no tomador de decisão (C-Level).",
            steps: [
              "Migrar 80% do esforço de mídia orgânica do Instagram para o LinkedIn da Alpha 1 e do seu Diretor.",
              "Parar de publicar fotos de shows. Transformar o conteúdo em pílulas de segurança cibernética e infraestrutura empresarial."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "voa",
    name: "VÖA Sportswear",
    niche: "Moda Feminina / Athleisure Premium",
    status: "warning",
    businessIntelligence: {
      address: "Avenida 1º de Janeiro, Irecê - BA, CEP: 44873-000",
      coreAsset: "Design Minimalista / Tecnologia Têxtil / E-commerce Próprio (voasportswear.com.br)",
      googleRating: "E-commerce ativo com loja virtual própria",
      officialSite: "voasportswear.com.br | CNPJ: 62.737.582/0001-40",
      igStats: "DADO REAL (API): 1.181 seguidores | 69 posts | Seguindo 1 conta — Postou HOJE. ENGAJAMENTO: 10.11% (média de 109 likes por post com 1.181 seguidores) — MELHOR TAXA DE ENGAJAMENTO DE TODA A CARTEIRA. Bio real: '✨Feita para Vöar 📍Irecê - BA • Inauguração em breve — Pre-Order com condição exclusiva'. A loja ainda não inaugurou fisicamente. Bio link: grupo do WhatsApp para pré-venda."
    },
    cmoDirective: "Diamante Bruto com Distribuição Zero. A VÖA tem o melhor engajamento da carteira (10.11%) com apenas 1.181 seguidores — isso significa que o conteúdo conecta, o produto atrai e a audiência responde. O único problema é escala: a marca precisa de crescimento acelerado de seguidores antes da inauguração física. Com 10% de engajamento, cada 10.000 seguidores conquistados = 1.000 interações por post. Isso é uma máquina de conversão esperando para ligar.",
    kpis: ["Aumento de Lifetime Value (LTV)", "Taxa de UGC (Conteúdo Gerado por Usuário)"],
    channels: [
      {
        name: "Direção de Arte e Estratégia D2C",
        status: "warning",
        issues: [
          {
            title: "O Vácuo do Estilo de Vida (Lifestyle)",
            evidence: "Web e Auditoria: O produto tem site lindíssimo e foca em peças minimalistas excelentes. No digital do Insta, o foco principal é na peça de roupa flutuando ou dobrada (O Pano).",
            rationale: "Ninguém paga premium num tecido liso. Pagam pela fantasia de serem a mulher inabalável que medita de manhã. Marcas de Athleisure sobrevivem do gatilho do pertencimento. Faltam rostos reais transpirando nas roupas, provando usabilidade extrema e pertencimento.",
            impact: "Mutação de clientes em 'Advogadas da Marca', gerando marketing gratuito via recompartilhamentos.",
            steps: [
              "Ativação do Esquadrão VÖA: Enviar conjuntos para micro-influenciadoras locais da cena Fit (Yoga, Crossfit) em troca de Stories treinando pesado.",
              "Fotografar num corpo em movimento real na luz do sol forte, provando que a calça não marca e não é transparente."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "experimente",
    name: "Experimente Papelaria",
    niche: "E-Commerce Papelaria Sensorial",
    status: "critical",
    businessIntelligence: {
      address: "Irecê - BA",
      coreAsset: "Estoque Especializado em Papelaria Criativa / CNPJ: 48.986.416/0001-57",
      googleRating: "Presença no Facebook ativa",
      officialSite: "@experimentepapelaria",
      igStats: "DADO REAL (API): 14.395 seguidores | 1.195 posts | Seguindo 548 | Postou ONTEM. Engajamento: 0.27% (38 likes médios). Bio real: 'Toda descoberta começa com experimentação! 💜 📍Febrônio Barreto, 64, Irecê 🎒Compre também pelo WhatsApp ↓'. Bio link: linktr.ee/papelariaexperimenteirece. Último post: 'Organização + papelaria colorida = Minha terapia favorita 💜'"
    },
    cmoDirective: "Volume de Conteúdo Sem Conversão. A Experimente posta quase diariamente (1.195 posts) mas tem apenas 0.27% de engajamento — 38 likes em 14.395 seguidores. Isso indica que o conteúdo é produzido em quantidade mas não provoca reação. Posts de organização e papelaria colorida são o certo para o nicho, mas falta o gatilho de desejo e urgência que faz o seguidor virar comprador.",
    kpis: ["Tempo de Sessão no Site", "Conversão Viral no TikTok/Reels"],
    channels: [
      {
        name: "Social Commerce / Estética",
        status: "critical",
        issues: [
          {
            title: "Ausência Absoluta do Elemento Sensorial (ASMR)",
            evidence: "Pesquisa Multicanal: A transição para a operação digital forte é real. Mas o Instagram é engessado em fotos estáticas dos pacotes na loja.",
            rationale: "No ecossistema de Studygram e Papelaria Fina B2C, a venda ocorre por prazer estético. O som agudo da brush pen deslizando, a perfeição da organização. Mostrar a prateleira evoca tédio, e não a dopamina explosiva que o estudante busca.",
            impact: "Ruptura imediata de CTR nos vídeos ao prender a audição e visão com texturas.",
            steps: [
              "Pivotar para a gravação Macro (Lente próxima): Gravar vídeos com o áudio original explodindo (ASMR) do zíper do estojo abrindo, pacotes rasgando e papel amassando.",
              "Inaugurar os vídeos 'Embalando o Pedido da Cliente X'."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "lionstop",
    name: "Academia Lions Top",
    niche: "Fitness e Massa",
    status: "critical",
    businessIntelligence: {
      address: "Av. Primeiro de Janeiro, 763, Centro, Irecê - BA | Tel: (74) 99817-8094",
      coreAsset: "Horário Amplo 05h–23h / Wellhub + TotalPass / Musculação + Dança + Funcional",
      googleRating: "Avaliações robustas no Google Maps local",
      officialSite: "linktr.ee/lionstop",
      igStats: "13K seguidores | 1.133 posts | Seguindo 5.607 — ⚠️ ANOMALIA GRAVE: A conta segue 5.607 pessoas com apenas 13K seguidores. Ratio 1:2,3 é péssimo para uma academia (ideal é 1:10+). Isso destrói a percepção de autoridade e indica prática de follow/unfollow massivo."
    },
    cmoDirective: "Autossabotagem Operacional. Uma academia massiva com horário elástico (5h às 23h) e aceitação de Wellhub, mas o Instagram funciona como uma prancheta de avisos insossa.",
    kpis: ["Leads Convertidos Diários", "Share Orgânico por Viralização"],
    channels: [
      {
        name: "Instagram (Engajamento Visual)",
        status: "critical",
        issues: [
          {
            title: "Anestesia Visual via Tabelas de Excel",
            evidence: "Auditoria Completa (Web/Instagram): Fica no centro, abre cedo, estrutura pesada. Porém, o perfil jorra tabelas alaranjadas densas indicando horários fixos das aulas de FitDance.",
            rationale: "O Algoritmo pune impiedosamente posts textuais fixos porque as pessoas fazem 'swipe away' rápido. Se você joga tabelas na timeline, o Insta para de entregar seus vídeos para a cidade inteira (Shadow Ban orgânico). E tabela não exala endorfina.",
            impact: "Fuga imediata das métricas de rejeição do Instagram.",
            steps: [
              "Banir sumariamente todo e qualquer aviso de horário e feriado em forma de post de Feed. Isso vai para Bio e Stories.",
              "Vender o caos bom: Gravar as alunas do FitDance sorrindo, os homens levantando peso no último grito (RAW Energy)."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "labdiacenter",
    name: "DiaCenter Lab Prime",
    niche: "Diagnóstico Clínico (Luxo)",
    status: "critical",
    businessIntelligence: {
      address: "Irecê, BA | laboratorio@diacenter.com.br | (74) 9950-0087",
      coreAsset: "Laboratório Prime integrado à rede DiaCenter",
      googleRating: "Não ranqueado separadamente do grupo",
      officialSite: "diacenter.com.br | CNPJ: 66.600.710/0001-60",
      igStats: "🚨 PERFIL MORTO: 170 seguidores | APENAS 5 POSTS | Seguindo somente 2 contas. Um laboratório que se intitula 'Prime' com 170 seguidores e 5 posts na história não tem presença digital. Isso é equivalente a não existir online."
    },
    cmoDirective: "O Esvaziamento do Título 'Prime'. O laboratório busca um posicionamento de altíssimo nível para não brigar com laboratórios populares, mas a comunicação visual ainda se arrasta no lugar comum da medicina de banco de imagens.",
    kpis: ["Quantidade de Exames High Ticket", "Retenção de Médicos Indicadores"],
    channels: [
      {
        name: "Posicionamento Premium & UX",
        status: "warning",
        issues: [
          {
            title: "O Padrão 'Banco de Imagens' Destruindo o Diferencial",
            evidence: "Buscas (Rua José Alves Andrade): Como todo laboratório na região, usa-se a cor roxa/fúcsia e fotos artificiais de microscópios para transmitir higiene.",
            rationale: "Quando todo laboratório usa fotos sorridentes da internet, ninguém se diferencia. O paciente não quer saber da pipeta, ele quer saber se a coleta vai doer no filho dele e se o café na espera é bom. O adjetivo 'Prime' exige café espresso, poltronas estofadas e jaleco de linho.",
            impact: "Percepção imediata de alto valor agregado. Paciente escolhe pagar 30% a mais para não ter desconforto.",
            steps: [
              "Filmar e fotografar exclusivamente o lado interior real da clínica (As poltronas de coleta, a máquina de café). Mostrar 'A Experiência Prime'.",
              "Série de provas sociais: Depoimentos focados na dor abolida: 'A moça que tirou sangue do meu bebê tem mão de fada'."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "irecemodas",
    name: "Irecê Modas",
    niche: "Varejo Moda Fast Fashion",
    status: "critical",
    businessIntelligence: {
      address: "Rua Aurélio José Marques, 58 (Centro), Irecê - BA",
      coreAsset: "Ponto Físico Central / 20K Seguidores / 3.966 Posts Históricos",
      googleRating: "Tradicional na cidade — avaliações locais ativas",
      officialSite: "@irecemodas (Instagram principal)",
      igStats: "⚠️ DADO REAL (API): 20.208 seguidores | 3.966 posts | Seguindo 4.694 — 6 DIAS SEM POSTAR confirmado. ENGAJAMENTO: 0.07% (média de 15 likes por post com 20K seguidores) — catastrófico. Bio real: 'Desde 1978 — NV, Animale, Forum, Schutz, CK, Osklen, Democrata, Foxton' — portfólio de marcas PREMIUM, não fast fashion."
    },
    cmoDirective: "Assassinato de Marca Premium por Comunicação de Brechó. A Irecê Modas vende Animale, Osklen e Schutz — marcas que custam R$500+ por peça — mas 6 dias de silêncio e 0.07% de engajamento entregam a percepção de uma loja parada. Uma loja que porta essas marcas deveria ter uma vitrine digital tão luxuosa quanto o produto. O que temos é o oposto: ausência total e engajamento de perfil morto.",
    kpis: ["Custo por Compra (ROAS)", "Conversão do Tráfego Pago do WhatsApp Direct"],
    channels: [
      {
        name: "Instagram Reels & TikTok D2C",
        status: "critical",
        issues: [
          {
            title: "A Vitrine Fria do Varejo Analógico",
            evidence: "Web e Histórico: O varejo de confecção local frequentemente posta manequins de loja sem cabeça, fotos em cabides ou montagens gráficas poluídas no Photoshop.",
            rationale: "A Shein vende um milhão de vestidos todo dia por causa do algoritmo de desfile de roupas em movimento. Roupa num cabide estático vale R$50; a MESMA roupa filmada sendo usada por uma garota comum andando cheia de confiança nas ruas de Irecê vale R$150. É agregação de valor.",
            impact: "Aceleração meteórica das vendas imediatas via WhatsApp impulsionadas por FOMO.",
            steps: [
              "Abolição completa de fotos estáticas na manequim sem cabeça ou no cabide.",
              "Executar o plano 'Transition Reels'. Gravar funcionárias normais que a cidade reconhece usando as combinações completas e andando com atitude em frente à fachada da loja."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "serragrande",
    name: "Grupo Serra Grande",
    niche: "Logística B2B & Distribuição Premium",
    status: "critical",
    businessIntelligence: {
      address: "Irecê e Seabra, BA (Polos de Distribuição Chapada Diamantina)",
      coreAsset: "Revendedor Autorizado Heineken — Monopólio Regional de Distribuição Premium",
      googleRating: "Referenciado por parceiros da região da Chapada",
      officialSite: "linktr.ee/serragrandegrupo",
      igStats: "7.241 seguidores | 331 posts | Seguindo 3.855 — Ratio crítico: segue 3.855 e tem 7.241 seguidores. Para um distribuidor B2B com o peso da Heineken, ter menos de 8K seguidores e um ratio de follow/seguido péssimo demonstra que não há estratégia de posicionamento de autoridade."
    },
    cmoDirective: "Ocultação de Majestade Corporativa e Capilaridade Logística. Sendo o revendedor gigante oficial Heineken (o portfólio premium líder), o grupo gasta a própria imagem com artes amadoras em vez de demonstrar Força Motriz Imparável B2B.",
    kpis: ["Contratos de Exclusividade (PDVs Locais)", "Share of Wallet B2B"],
    channels: [
      {
        name: "Estratégia B2B / Branding Institucional",
        status: "critical",
        issues: [
          {
            title: "Panfletagem Institucional Passiva",
            evidence: "Inspeção Cruzada: A empresa abastece Irecê e Seabra. Porém, as poucas publicações focam em molduras fechadas pelo Canva, exibindo um único caminhãozinho com frases poéticas de negócios 'De onde viemos, compromisso'.",
            rationale: "Um grande bar em Seabra não escolhe o Grupo Serra Grande porque a frase motivacional do feed é bonita. Eles escolhem porque a Heineken gelada não pode faltar no sábado. Textos motivacionais não provam poderio logístico. Caminhões aos borbotões e pallets verdes, sim.",
            impact: "Aumento avassalador de respeito de mercado e fechamento rápido de contratos B2B de exclusividade com novos donos de grandes bares.",
            steps: [
              "Deletar templates de Canva do perfil. Todo o conteúdo agora deve cheirar a Diesel, Gelo e Poder Logístico.",
              "Implantar os vídeos em FPV Drone 'A Força Verde na Chapada': Mostrar o amanhecer do galpão, o som das dezenas de caminhões refrigerados ligados em coro para dominar a região."
            ]
          }
        ]
      }
    ]
  }
];

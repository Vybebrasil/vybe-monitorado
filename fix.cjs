const fs = require('fs');
let c = fs.readFileSync('src/data/clients.js', 'utf8');
c = c.replace(
  '        ]\n              "Banir sumariamente todo e qualquer aviso',
  `            evidence: "Auditoria Completa (Web/Instagram): Fica no centro, abre cedo, estrutura pesada. Porém, o perfil jorra tabelas alaranjadas densas indicando horários fixos das aulas de FitDance.",\n            rationale: "O Algoritmo pune impiedosamente posts textuais fixos porque as pessoas fazem 'swipe away' rápido. Se você joga tabelas na timeline, o Insta para de entregar seus vídeos para a cidade inteira (Shadow Ban orgânico). E tabela não exala endorfina.",\n            impact: "Fuga imediata das métricas de rejeição do Instagram.",\n            steps: [\n              "Banir sumariamente todo e qualquer aviso`
);
c = c.replace('] // end', ']');
fs.writeFileSync('src/data/clients.js', c);
console.log('Fixed');

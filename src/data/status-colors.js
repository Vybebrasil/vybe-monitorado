// Paleta oficial configurada no board Produção de Conteúdo do Monday.com.
// O snapshot também expõe esta mesma paleta em quantitative.statusColors.
export const STATUS_COLORS = {
  'Em andamento': '#fdab3d',
  'Falta D.A': '#4eccc6',
  'Alteração': '#df2f4a',
  'Finalizado': '#9cd326',
  'Aguardo': '#9d50dd',
  'A Fazer': '#c4c4c4',
  'Para agendar': '#037f4c',
  'Para aprovação': '#579bfc',
  'Cap. Agendada': '#ff007f',
  'Pode Fazer': '#ffcb00',
  'Ag. Aprovação Cliente': '#faa1f1',
  'Ag. Info Cliente': '#bca58a',
  'Falta Info': '#ff6d3b',
  'Agendando Cap': '#ff5ac4',
  'Falta OFF': '#784bd1',
  'Segurar Post': '#7f5347',
  'Aguardo Redação': '#e484bd',
  'Agendado': '#a1e3f6'
};

export const statusColorFor = (status, colors = STATUS_COLORS) => colors?.[status] || STATUS_COLORS[status] || '#c4c4c4';

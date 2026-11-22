/**
 * EN: Store assistant of design V3 (V3-Chat and V3-G-Assistente): no paid AI. Each question ("Tema") has words that
 *     trigger it and an answer that reads the site's data (prices, stock, reservations, payments, fittings, hours,
 *     orders) or a fixed text. It hands the conversation to a person when the customer asks or after unanswered
 *     questions. Everything is edited in Gestão → Assistente (setting "assistant").
 * PT: Assistente da loja do V3: sem inteligência artificial paga. Cada tema tem palavras que o activam e uma resposta
 *     que lê os dados do site ou um texto fixo. Passa a conversa a uma pessoa quando a cliente pede ou depois de
 *     perguntas sem resposta. Tudo se edita em Gestão → Assistente (definição "assistant").
 */

export type TopicKind = "price" | "stock" | "reservations" | "payments" | "fittings" | "hours" | "order" | "exchanges" | "deliveries" | "custom";

export const TOPIC_SOURCES: Record<TopicKind, string> = {
  price: "Lê o preço e o desconto da peça no site",
  stock: "Lê os tamanhos e as cores em stock",
  reservations: "Regras de Reservas (sinal e prazos)",
  payments: "Formas de pagamento ligadas na gestão",
  fittings: "Pacotes e regras de Provas · Bridal",
  hours: "Contactos e redes sociais",
  order: "Lê o estado pelo número da encomenda",
  exchanges: "Texto fixo",
  deliveries: "Desligado enquanto as entregas estiverem desligadas",
  custom: "Texto fixo",
};

export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  kind: TopicKind;
  text: string; // EN: fixed answer (exchanges, custom) or extra line. PT: resposta fixa ou linha extra.
  site: boolean;
  whatsapp: boolean;
  on: boolean;
}

export interface AssistantSettings {
  site: boolean;
  whatsapp: boolean;
  alwaysHuman: boolean;
  handoffAfter: number;
  teamWeek: string; // "09:00–18:00"
  teamSat: string;
  offHours: string;
  waSilence: boolean;
  topics: Topic[];
}

const T = (id: string, name: string, keywords: string, kind: TopicKind, text = ""): Topic => ({
  id,
  name,
  keywords: keywords.split("·").map((x) => x.trim()),
  kind,
  text,
  site: true,
  whatsapp: true,
  on: true,
});

/** EN: Topics before the owner's guide, to update only the ones the team never edited. PT: Temas antes do guia da dona. */
export const TOPICS_BEFORE_GUIDE: Topic[] = [
  T("preco", "Preço de uma peça", "quanto custa · preço · valor", "price"),
  T("tamanho", "Tamanho e stock", "tamanho · tem em · M · 38 · serve-me", "stock"),
  T("reservas", "Reservas", "reservar · sinal · guardar", "reservations"),
  T("pagamentos", "Pagamentos", "m-pesa · mpesa · e-mola · emola · mkesh · cartão · pagar · pagamento · visa · transferência", "payments"),
  T("provas", "Provas de noiva", "prova · noiva · marcar · pacote · bridal · casamento", "fittings"),
  T("horario", "Horário e morada", "horário · onde fica · morada · abre · fecha · localização · glória · endereço", "hours"),
  T("encomenda", "Estado da encomenda", "encomenda · ET- · quando chega · pedido · levantar", "order"),
  T(
    "trocas",
    "Trocas e devoluções",
    "trocar · devolver · reembolso · troca · devolução",
    "exchanges",
    "Todas as vendas da Eterna são finais, não sendo aceites trocas nem devoluções. Antes de pagar, confirme a peça e o tamanho; se tiver dúvidas, venha experimentar à loja.",
  ),
  T("entregas", "Entregas", "entrega · enviar · casa · envio · domicílio · província", "deliveries"),
];

/** EN: Topics of the owner's guide (2026-11-22). PT: Temas do guia da dona (22-11-2026). */
export const GUIDE_TOPICS: Topic[] = [
  T("preco", "Preço de uma peça", "quanto custa · preço · preco · custa · valor de", "price"),
  T(
    "tamanho",
    "Tamanhos e guia de medidas",
    "tamanho · tamanhos · tem em · serve-me · medidas · busto · cintura · anca · XS · XXL · número",
    "stock",
  ),
  T(
    "disponibilidade",
    "Disponibilidade e peças únicas",
    "disponível · disponivel · ainda tem · ainda há · têm este · tem este · única · unica · únicas · exclusiv · repor · reposição · stock",
    "custom",
    "A ETERNA trabalha com peças seleccionadas e únicas: por regra, não existe mais do que uma unidade do mesmo modelo e não há reposição garantida. A disponibilidade pode mudar rapidamente, por isso recomendamos que confirme com a nossa equipa ou que nos visite. Se me disser a referência da peça (por exemplo SUIT311), vejo o que está no site.",
  ),
  T("reservas", "Reservas", "reservar · reserva · sinal · guardar · separar", "reservations"),
  T(
    "pagamentos",
    "Pagamentos",
    "m-pesa · mpesa · e-mola · emola · mkesh · cartão · pagar · pagamento · visa · transferência · terminal pos · pagamento por pos · multicaixa",
    "custom",
    "A ETERNA disponibiliza como meios de pagamento M-Pesa, transferência bancária e POS.",
  ),
  T(
    "provas",
    "Provas de noiva (marcação e pacotes)",
    "prova de noiva · marcar prova · agendar · pacote · satin · silk · cashmere · bridal · noiva · casamento · showroom",
    "fittings",
  ),
  T(
    "provas-regras",
    "Prova de noiva: acompanhantes, cancelar, atrasos",
    "acompanh · levar alguém · levar alguem · posso levar · minha mãe · minha mae · minha irmã · minha irma · amiga · cancelar · remarcar · desmarcar · atraso · atrasada · chegar tarde · vestidos extra · outros vestidos",
    "custom",
    "Na ETERNA Bridal pode trazer até 2 acompanhantes. Os cancelamentos ou remarcações devem ser comunicados com pelo menos 24 horas de antecedência; sem aviso prévio, a taxa de reserva passa a taxa de serviço. O tempo de prova começa e termina à hora marcada, mesmo que chegue atrasada. A prova inclui só os vestidos escolhidos no catálogo ao marcar; pode juntar até 3 vestidos extra a 1 000 MT cada, também escolhidos ao marcar.",
  ),
  T(
    "provas-preparacao",
    "Prova de noiva: preparação, fotos e cuidados",
    "maquilhagem · maquiagem · perfume · creme · preparar · fotografar · filmar · fotos · vídeo · comer · beber · dano · estragar",
    "custom",
    "Para preservar os vestidos, pedimos que no dia da prova não use maquilhagem, jóias, cremes, óleos corporais ou perfumes intensos. A consultora da ETERNA Bridal ajuda a vestir e despir cada peça. Fotografar ou filmar só com autorização da ETERNA Bridal ou no pacote Cashmere, e não é permitido comer ou beber na loja (excepto nos serviços do pacote Cashmere). Danos causados por incumprimento destas regras podem implicar custos de limpeza ou reparação.",
  ),
  T(
    "horario",
    "Horário e localização",
    "horário · horario · onde fica · onde ficam · morada · abre · fecha · localização · glória · gloria · endereço · aberto · domingo · feriado",
    "hours",
  ),
  T(
    "estacionamento",
    "Estacionamento",
    "estacionamento · estacionar · parque · parqueamento",
    "custom",
    "Sim. O Glória Mall dispõe de estacionamento para clientes.",
  ),
  T(
    "marcacao",
    "Visitar e experimentar sem marcação",
    "sem marcação · marcação · preciso marcar · experimentar · provar · posso ir · visitar",
    "custom",
    "Para conhecer e experimentar as colecções de festa, executiva e acessórios não é preciso marcar: pode visitar a loja no Glória Mall, Loja 2, durante o horário de funcionamento, e a nossa equipa terá todo o prazer em ajudá-la a escolher. A ETERNA Bridal funciona exclusivamente mediante marcação.",
  ),
  T(
    "encomenda",
    "Estado da encomenda",
    "minha encomenda · estado da encomenda · ET- · quando chega · pedido · levantar",
    "order",
  ),
  T(
    "encomendas-especiais",
    "Encomendas especiais de um modelo",
    "aceitam encomendas · encomendar · encomenda especial · mandar vir · pedir um modelo · encomendas",
    "custom",
    "A ETERNA aceita, excepcionalmente, encomendas de artigos das marcas que representa. Basta indicar o modelo pretendido e a nossa equipa verifica a disponibilidade junto da marca. Não é possível garantir antecipadamente o prazo de entrega nem o preço final, que dependem das condições no momento da encomenda. Recomendamos que conheça primeiro as peças disponíveis na loja; para encomendas, fale directamente com a nossa equipa.",
  ),
  T(
    "trocas",
    "Trocas e devoluções",
    "trocar · troca · trocas · devolver · devol · reembols",
    "exchanges",
    "As vendas da ETERNA são finais: não são aceites trocas nem devoluções, incluindo nas compras feitas no website. Recomendamos que experimente e confirme cuidadosamente a peça antes de pagar; a nossa equipa está disponível para a ajudar nesse momento.",
  ),
  T(
    "entregas",
    "Entregas e envios",
    "entrega · entregas · entregam · enviar · envio · envios · domicílio · domicilio · província · provincia · delivery · transportador · custo da entrega · quanto custa a entrega",
    "custom",
    "A ETERNA privilegia o atendimento na loja, onde pode ver, experimentar e confirmar a peça antes de comprar, já que todas as vendas são finais. Se preferir, podemos organizar a entrega por um serviço de delivery, a pedido, também para outras províncias. Os custos de entrega ou envio são da responsabilidade da cliente e, tal como o prazo, dependem do destino e do transporte: confirmamo-los consigo antes de enviar. A partir do momento em que a peça sai da loja, deixa de estar aos cuidados directos da ETERNA.",
  ),
  T(
    "colecoes",
    "Colecções e ocasiões",
    "que tipo de roupa · o que vendem · o que têm · colecção · coleção · colecções · festa · executiva · cerimónia · cerimonia · madrinha · convidada · mãe dos noivos · noivado · gala",
    "custom",
    "Na ETERNA encontra pronto-a-vestir feminino para diferentes ocasiões: Roupa de Festa, Roupa Executiva, Acessórios e Modeladores, com opções para convidadas, madrinhas, mães dos noivos, noivados, galas e outras ocasiões especiais. Convidamo-la a visitar a loja no Glória Mall para conhecer a selecção disponível.",
  ),
  T(
    "plus-size",
    "Plus size",
    "plus size · plus · tamanhos grandes · tamanho grande",
    "custom",
    "Sim. A ETERNA tem peças plus size, para festa e para o dia a dia executivo. Seleccionamos tamanhos do XS ao XXL; como as peças são únicas, os tamanhos disponíveis variam de peça para peça.",
  ),
  T(
    "marcas",
    "Marcas e origem das peças",
    "marca · marcas · de onde vêm · de onde vem · origem · estados unidos · americana · rosa clará · rosa clara",
    "custom",
    "Os nossos produtos são seleccionados junto de marcas conceituadas dos Estados Unidos, reconhecidas pela qualidade, elegância e design. Na ETERNA Bridal apresentamos vestidos de noiva da prestigiada marca espanhola Rosa Clará.",
  ),
  T(
    "acessorios",
    "Acessórios",
    "acessório · acessorio · acessórios · carteira · sapato · sapatos · bijuteria · fascinator · echarpe · pochette",
    "custom",
    "Sim. A nossa selecção inclui carteiras, pochettes, sapatos de festa e executivos, bijuteria, fascinators, echarpes e outros acessórios.",
  ),
  T(
    "medida-ajustes",
    "Roupa por medida e ajustes",
    "por medida · costura · costureira · ajuste · ajustes · ajustar · apertar · encurtar · modificar · bainha",
    "custom",
    "A ETERNA é uma loja de pronto-a-vestir: não confeccionamos roupa por medida e não fazemos ajustes nem modificações. Todas as peças são vendidas tal como apresentadas, por isso recomendamos que as experimente na loja e confirme o ajuste antes da compra.",
  ),
  T(
    "aluguer",
    "Aluguer de vestidos",
    "alugar · aluguer · alugam · aluguel",
    "custom",
    "Não. As peças da ETERNA são vendidas, não alugadas.",
  ),
  T(
    "descontos",
    "Descontos e saldos",
    "desconto · descontos · saldos · promoção · promocao · promoções · campanha · mais barato",
    "custom",
    "A ETERNA trabalha com preços fixos, definidos pela qualidade, exclusividade e selecção criteriosa das peças. Não fazemos descontos de forma regular, excepto nos saldos anuais e em campanhas especiais. Valorizamos a fidelidade das nossas clientes: o programa de fidelização dá descontos ao longo do ano seguinte.",
  ),
  T(
    "fidelizacao",
    "Programa de fidelização",
    "fidelização · fidelizacao · fidelidade · pontos · nível · nivel · rubi · safira · pérola · perola · diamante · cadastro · registo",
    "custom",
    "O programa de fidelização é gratuito: basta pedir o registo à nossa equipa na loja. Cada 1 000 MT em compras dá 1 ponto e, em Janeiro, as compras do ano anterior definem o seu nível e o desconto do ano: Rubi (0–29 pontos) 0%, Safira (30–69) 5%, Pérola (70–119) 10% e Diamante (120 ou mais) 15%. O nível pode subir, manter-se ou descer conforme as compras de cada ano.",
  ),
  T(
    "comprar",
    "Como comprar",
    "como comprar · como posso comprar · comprar online · comprar pelo site · website · não consigo ir · nao consigo ir",
    "custom",
    "A principal forma de conhecer e comprar as nossas peças é visitar a ETERNA, no Glória Mall, Loja 2, em Maputo: será um prazer recebê-la e ajudá-la a experimentar os modelos. Se preferir ou não conseguir vir à loja, o website mostra as peças e permite comprar online; consulte com atenção as características e o tamanho de cada peça antes de concluir, porque todas as vendas são finais.",
  ),
  T(
    "foto",
    "Enviar fotografia de uma peça",
    "fotografia · foto de uma peça · enviar foto · mandar foto · print · imagem",
    "custom",
    "Pode enviar a fotografia à nossa equipa, que verifica o stock antes de confirmar se a peça está disponível. Prefere falar com uma pessoa da equipa?",
  ),
];

export const ASSISTANT_DEFAULT: AssistantSettings = {
  site: true,
  whatsapp: true,
  alwaysHuman: true,
  handoffAfter: 2,
  teamWeek: "09:00–18:00",
  teamSat: "09:00–14:00",
  offHours: "Obrigada pela mensagem. A equipa responde no dia útil seguinte, a partir das 09:00.",
  waSilence: true,
  // EN: Answers of the owner's "Guia de Conteúdo e Atendimento do Chatbot" (2026-11-22). Payments and deliveries are
  //     fixed texts for now (only M-Pesa, transfer and POS; deliveries on request): switch them to the automatic answer
  //     in Gestão → Assistente when the other methods and deliveries are turned on.
  // PT: Respostas do "Guia de Conteúdo e Atendimento do Chatbot" da dona (22-11-2026). Pagamentos e entregas são textos
  //     fixos por agora (só M-Pesa, transferência e POS; entregas a pedido): passar à resposta automática na gestão
  //     quando os outros métodos e as entregas forem ligados.
  topics: GUIDE_TOPICS,
};

/** EN: Lower case without accents, for matching. PT: Minúsculas sem acentos, para comparar. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

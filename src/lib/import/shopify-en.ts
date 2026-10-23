import type { Localized, ProductColor } from "@/types";

/**
 * EN: English for the description paragraphs repeated across the Shopify catalogue (they cover ~86% of the text).
 *     Paragraphs written for a single product are left out of the English version until the team translates them in
 *     the product editor; a product with none of these paragraphs gets "<name>. Reference: <code>."
 * PT: Inglês dos parágrafos que se repetem no catálogo do Shopify (cerca de 86% do texto). Parágrafos escritos para
 *     um só produto ficam fora da versão inglesa até a equipa os traduzir no editor; um produto sem nenhum destes
 *     parágrafos fica com "<nome>. Reference: <código>."
 */
const EN: Record<string, string> = {
  "Os vestidos longos da ETERNA combinam as últimas tendências com um toque de sofisticação, ideais para quem deseja impressionar.":
    "ETERNA long dresses pair the latest trends with a touch of sophistication, made for women who want to make an impression.",
  "Cada peça é cuidadosamente criada para valorizar a elegância em momentos especiais, proporcionando presença marcante e brilho único em festas, galas e casamentos.":
    "Each piece is carefully made to bring out your elegance on special occasions, with a striking presence and a unique glow at parties, galas and weddings.",
  "Com uma seleção exclusiva e limitada, oferecem cortes refinados, tecidos de qualidade e detalhes minuciosos, permitindo que cada mulher se sinta confiante, única e inesquecível em qualquer ocasião.":
    "An exclusive, limited selection with refined cuts, quality fabrics and meticulous details, so every woman feels confident, unique and unforgettable on any occasion.",
  "Os vestidos cocktail da ETERNA unem sofisticação e modernidade, pensados para ocasiões especiais onde a elegância é essencial.":
    "ETERNA cocktail dresses bring together sophistication and modernity, designed for special occasions where elegance is essential.",
  "Cada modelo apresenta cortes refinados, tecidos de qualidade e detalhes cuidadosamente trabalhados, permitindo que quem o veste se sinta confiante, distinta e inesquecível.":
    "Each design has refined cuts, quality fabrics and carefully crafted details, so the woman wearing it feels confident, distinguished and unforgettable.",
  "Os fatos executivos femininos da ETERNA são ideais para quem procura a combinação perfeita entre sofisticação e conforto no ambiente de trabalho. Com cortes clássicos e detalhes modernos, estes fatos são confeccionados com tecidos de alta qualidade, garantindo um visual elegante e um caimento impecável. São a escolha perfeita para destacar o seu profissionalismo com estilo.":
    "ETERNA women's business suits are ideal for anyone looking for the perfect balance of sophistication and comfort at work. With classic cuts and modern details, they are made from high-quality fabrics for an elegant look and an impeccable fit. The perfect choice to show your professionalism with style.",
  "Os vestidos executivos da ETERNA foram desenhados para proporcionar uma aparência refinada e confiante no trabalho. Combinando elegância e funcionalidade, estes vestidos utilizam materiais de alta qualidade para garantir um caimento confortável e um estilo sofisticado. São ideais para mulheres que desejam marcar presença com classe.":
    "ETERNA business dresses are designed for a refined, confident look at work. Combining elegance and practicality, they use high-quality materials for a comfortable fit and a sophisticated style. Ideal for women who want to stand out with class.",
  "A bijuteria da ETERNA combina delicadeza, estilo e sofisticação.": "ETERNA jewellery combines delicacy, style and sophistication.",
  "Cada peça é cuidadosamente selecionada, com design refinado e atenção aos detalhes, ideal para complementar looks com elegância e acrescentar um toque de brilho sutil em qualquer ocasião.":
    "Each piece is carefully selected for its refined design and attention to detail, ideal for completing a look with elegance and adding a subtle sparkle on any occasion.",
  "Carteira.": "Handbag.",
  "Adicione um toque de elegância ao seu guarda-roupa profissional com as blusas executivas da ETERNA. Cada peça é desenhada para oferecer um visual sofisticado, com acabamentos refinados e tecidos de alta qualidade. Ideais para criar conjuntos versáteis e elegantes, estas blusas garantem conforto e estilo durante todo o dia de trabalho.":
    "Add a touch of elegance to your work wardrobe with ETERNA business blouses. Each piece is designed for a sophisticated look, with refined finishes and high-quality fabrics. Ideal for versatile, elegant outfits, they keep you comfortable and stylish throughout the working day.",
  "Descubra a exclusiva coleção de fascinators da ETERNA, acessórios sofisticados e encantadores que adicionam um toque de elegância a qualquer look.":
    "Discover ETERNA's exclusive collection of fascinators: sophisticated, charming accessories that add a touch of elegance to any look.",
  "Seja para um casamento, um evento social ou uma ocasião especial, nossos fascinators são a escolha perfeita para completar seu visual com estilo.":
    "Whether for a wedding, a social event or a special occasion, our fascinators are the perfect way to finish your look with style.",
  "Pequenas, sofisticadas e cheias de estilo, as pochettes ETERNA são o acessório perfeito para complementar qualquer look de festa ou ocasião especial. Com materiais de alta qualidade, acabamentos delicados e design elegante, oferecem praticidade sem abrir mão da sofisticação. Ideais para guardar os essenciais com charme e discrição, tornam-se o toque final que eleva a sua produção.":
    "Small, sophisticated and full of style, ETERNA clutches are the perfect accessory for any party look or special occasion. With high-quality materials, delicate finishes and an elegant design, they are practical without giving up sophistication. Ideal for carrying the essentials with charm and discretion, they are the finishing touch that lifts your outfit.",
  "Pequenas, sofisticadas e cheias de estilo, as pochettes ETERNA sao o acessorio perfeito para complementar qualquer look de festa ou ocasiao especial. Com materiais de alta qualidade, acabamentos delicados e design elegante, oferecem praticidade sem abrir mao da sofisticacao. Ideais para guardar os essenciais com charme e discricao, tornam-se o toque final que eleva a sua producao.":
    "Small, sophisticated and full of style, ETERNA clutches are the perfect accessory for any party look or special occasion. With high-quality materials, delicate finishes and an elegant design, they are practical without giving up sophistication. Ideal for carrying the essentials with charm and discretion, they are the finishing touch that lifts your outfit.",
  "Os blazers executivos da ETERNA são essenciais para um visual profissional e bem-arrumado. Combinando cortes precisos com materiais de qualidade superior, estes blazers oferecem versatilidade e um toque de classe. São perfeitos para criar uma aparência elegante e confiante em qualquer situação profissional.":
    "ETERNA business blazers are essential for a polished professional look. Combining precise cuts with superior materials, they offer versatility and a touch of class. Perfect for an elegant, confident appearance in any professional setting.",
  "Descubra as calças executivas da ETERNA que aliam conforto e estilo para o seu dia a dia no escritório. Confeccionadas com tecidos de alta qualidade, oferecem um caimento perfeito e um visual sofisticado. Ideais para completar qualquer conjunto profissional, estas calças garantem que se sinta confortável e elegante durante todo o dia.":
    "Discover ETERNA business trousers, combining comfort and style for your days at the office. Made from high-quality fabrics, they offer a perfect fit and a sophisticated look. Ideal for completing any professional outfit, they keep you comfortable and elegant all day long.",
  "Os macacões de festa da ETERNA combinam modernidade, conforto e sofisticação.": "ETERNA party jumpsuits combine modernity, comfort and sophistication.",
  "Cada peça é desenhada para realçar a silhueta, com cortes elegantes e detalhes refinados, oferecendo uma alternativa contemporânea aos vestidos, sem perder a presença e a elegância necessárias para momentos especiais.":
    "Each piece is designed to flatter the silhouette, with elegant cuts and refined details: a contemporary alternative to dresses, with all the presence and elegance that special moments call for.",
  "Os fatos de cerimónia da ETERNA unem elegância, corte perfeito e sofisticação contemporânea.":
    "ETERNA ceremony suits bring together elegance, a perfect cut and contemporary sophistication.",
  "Cada modelo é pensado para valorizar a postura e a confiança de quem o veste, combinando estilo intemporal com detalhes refinados.":
    "Each design is made to enhance the posture and confidence of the woman wearing it, combining timeless style with refined details.",
  "Disponíveis para Convidadas, Madrinhas e Mães da Noiva, estas peças proporcionam presença marcante, conforto e distinção, garantindo que todos os protagonistas do grande dia brilhem com elegância e harmonia.":
    "Available for wedding guests, bridesmaids and mothers of the bride, these pieces offer a striking presence, comfort and distinction, so everyone at the heart of the big day shines with elegance and harmony.",
  "Os sapatos de festa da ETERNA combinam sofisticação, estilo e conforto.": "ETERNA occasion shoes combine sophistication, style and comfort.",
  "Cada modelo é cuidadosamente desenhado com materiais de qualidade e detalhes refinados, oferecendo elegância e presença marcante para completar looks de ocasiões especiais.":
    "Each design is carefully made with quality materials and refined details, adding elegance and presence to special-occasion looks.",
  "Encontre o véu perfeito para completar o seu visual de noiva em nossa coleção exclusiva.":
    "Find the perfect veil to complete your bridal look in our exclusive collection.",
  "Nossos modelos unem tradição e modernidade, trazendo delicadeza e elegância para o seu grande dia.":
    "Our designs bring together tradition and modernity, adding delicacy and elegance to your big day.",
  "Com design refinado e atenção aos detalhes, cada véu foi pensado para realçar a sua beleza e tornar o momento ainda mais inesquecível.":
    "With a refined design and attention to detail, each veil is made to enhance your beauty and make the moment even more unforgettable.",
  "Na ETERNA descubra o acessório ideal para complementar o seu vestido de noiva e viver o sonho do casamento com um toque de sofisticação.":
    "At ETERNA, discover the ideal accessory to complete your wedding dress and live your wedding dream with a touch of sophistication.",
  "Os sapatos de Noiva da ETERNA combinam sofisticação, conforto e estilo.": "ETERNA bridal shoes combine sophistication, comfort and style.",
  "Cada par é cuidadosamente selecionado para harmonizar com o vestido, realçando a elegância da noiva e garantindo confiança e conforto em cada passo do grande dia.":
    "Each pair is carefully selected to match the dress, enhancing the bride's elegance and giving confidence and comfort with every step of the big day.",
  "Os macacões executivos da ETERNA oferecem uma solução moderna e elegante para o vestuário profissional. Feitos com tecidos selecionados para garantir durabilidade e conforto, estes macacões são perfeitos para quem procura um visual sofisticado e funcional. Com cortes bem estruturados, eles combinam praticidade com um toque de estilo.":
    "ETERNA business jumpsuits offer a modern, elegant option for workwear. Made from fabrics selected for durability and comfort, they are perfect for a sophisticated, practical look. With well-structured cuts, they combine practicality with a touch of style.",
  "As carteiras da Michael Kors, Kate Spade e DKNY, disponíveis na ETERNA, combinam design sofisticado, qualidade premium e funcionalidade. Cada peça é cuidadosamente selecionada para oferecer estilo, praticidade e presença marcante, tornando-se o acessório perfeito para complementar qualquer look com elegância e personalidade.":
    "Handbags by Michael Kors, Kate Spade and DKNY, available at ETERNA, combine sophisticated design, premium quality and practicality. Each piece is carefully selected for style, practicality and presence, the perfect accessory to complete any look with elegance and personality.",
  "Os casaquinhos e cardigans de malha da ETERNA combinam conforto, estilo e versatilidade para o dia a dia. Com cortes modernos e tecidos de qualidade, cada peça é ideal para criar looks elegantes, práticos e cheios de personalidade, tornando o cotidiano mais confortável.":
    "ETERNA knitted jackets and cardigans combine comfort, style and versatility for everyday wear. With modern cuts and quality fabrics, each piece is ideal for elegant, practical looks full of personality.",
  "Carteira rectangular folha.": "Rectangular leaf handbag.",
  "As pochettes de noiva em pérola da ETERNA são o toque final de sofisticação e delicadeza.":
    "ETERNA pearl bridal clutches are the finishing touch of sophistication and delicacy.",
  "Cada peça, cuidadosamente trabalhada, combina elegância e funcionalidade, tornando-se o acessório perfeito para guardar pequenos detalhes e completar o look da noiva com brilho sutil e intemporal.":
    "Each carefully crafted piece combines elegance and practicality: the perfect accessory for the bride's small essentials, completing her look with a subtle, timeless sparkle.",
  "Carteira flor.": "Flower handbag.",
  "Complete o seu look nupcial com o detalhe que faz toda a diferença. As tiaras e acessórios de cabelo da Eterna Bridal combinam delicadeza, brilho e sofisticação, concebidos para realçar a sua beleza de forma subtil ou marcante, conforme o seu estilo. Desde pecas minimalistas a designs exuberantes com cristais, perolas ou flores delicadas, cada acessório é pensado para complementar o vestido e o véu, criando um visual harmonioso e inesquecível. Eterna Bridal — o toque final de glamour que transforma cada noiva em protagonista do seu dia.":
    "Complete your bridal look with the detail that makes all the difference. Eterna Bridal tiaras and hair accessories combine delicacy, sparkle and sophistication, made to enhance your beauty subtly or boldly, to suit your style. From minimalist pieces to lavish designs with crystals, pearls or delicate flowers, each accessory is made to complement the dress and veil for a harmonious, unforgettable look. Eterna Bridal: the final touch of glamour that makes every bride the star of her day.",
  "Carteira concha.": "Shell handbag.",
  "Complete o seu look nupcial com o detalhe que faz toda a diferença.": "Complete your bridal look with the detail that makes all the difference.",
  "As tiaras e acessórios de cabelo da Eterna Bridal combinam delicadeza, brilho e sofisticação, concebidos para realçar a sua beleza de forma subtil ou marcante, conforme o seu estilo. Desde pecas minimalistas a designs exuberantes com cristais, perolas ou flores delicadas, cada acessório é pensado para complementar o vestido e o véu, criando um visual harmonioso e inesquecível. Eterna Bridal — o toque final de glamour que transforma cada noiva em protagonista do seu dia.":
    "Eterna Bridal tiaras and hair accessories combine delicacy, sparkle and sophistication, made to enhance your beauty subtly or boldly, to suit your style. From minimalist pieces to lavish designs with crystals, pearls or delicate flowers, each accessory is made to complement the dress and veil for a harmonious, unforgettable look. Eterna Bridal: the final touch of glamour that makes every bride the star of her day.",
  "Os calções modeladores da Leonisa foram desenvolvidos para oferecer modelação suave e conforto absoluto, ajudando a definir a silhueta de forma natural e discreta. Ideais para suavizar o abdómen, as ancas e as coxas, adaptam-se perfeitamente ao corpo, criando uma base harmoniosa sob vestidos, saias ou conjuntos ajustados.":
    "Leonisa shaping shorts are made for gentle shaping and complete comfort, defining the silhouette naturally and discreetly. Ideal for smoothing the tummy, hips and thighs, they fit the body perfectly and create a smooth base under dresses, skirts or fitted outfits.",
  "Com tecidos leves, respiráveis e tecnologia de compressão inteligente, proporcionam suporte e liberdade de movimento ao longo do dia. Além de modelar, ajudam também a evitar o atrito entre as coxas, garantindo maior conforto e confiança em qualquer ocasião.":
    "With light, breathable fabrics and smart compression, they give support and freedom of movement all day. They also help prevent chafing between the thighs, for more comfort and confidence on any occasion.",
  "Descubra a capa de noiva ideal para adicionar um toque de sofisticação ao seu visual.": "Discover the ideal bridal cape to add a touch of sophistication to your look.",
  "Nossa coleção exclusiva traz capas que combinam charme e elegância, perfeitas para noivas que buscam um look único e memorável.":
    "Our exclusive collection brings capes that combine charm and elegance, perfect for brides looking for a unique, memorable look.",
  "Com tecidos delicados e cortes impecáveis, cada peça foi criada para complementar o vestido e realçar a sua presença em momentos especiais.":
    "With delicate fabrics and impeccable cuts, each piece is made to complement the dress and enhance your presence on special occasions.",
  "Na ETERNA encontra capas de noiva que unem estilo e tradição, garantindo que você brilhe em cada detalhe do seu grande dia.":
    "At ETERNA you will find bridal capes that unite style and tradition, so you shine in every detail of your big day.",
  "Carteira bordada.": "Embroidered handbag.",
  "As carteiras ETERNA combinam elegancia atemporal e funcionalidade, perfeitas para mulheres que apreciam estilo e sofisticacao. Confeccionadas com materiais de qualidade superior e acabamentos requintados, sao o complemento ideal para qualquer look, seja executivo ou de festa.":
    "ETERNA handbags combine timeless elegance and practicality, perfect for women who appreciate style and sophistication. Made with superior materials and exquisite finishes, they complete any look, for work or for a party.",
  "Explore a selecção de sapatos executivos da ETERNA, concebidos para unir estilo e conforto no ambiente profissional. Com cortes clássicos e materiais de alta qualidade, estes sapatos proporcionam um visual sofisticado e um ajuste confortável. Disponíveis em tons neutros e acabamentos elegantes, asseguram que se sinta confiante e bem-apresentado ao longo de todo o dia.":
    "Explore ETERNA's selection of business shoes, designed to combine style and comfort at work. With classic cuts and high-quality materials, they give a sophisticated look and a comfortable fit. Available in neutral tones and elegant finishes, they keep you confident and well presented all day.",
  "Realce sua silhueta e adicione um toque de sofisticação ao seu vestido com nossos cintos de noiva exclusivos.":
    "Define your silhouette and add a touch of sophistication to your dress with our exclusive bridal belts.",
  "Criados com delicados detalhes e design elegante, cada cinto é pensado para destacar sua beleza e trazer um acabamento perfeito ao visual.":
    "Made with delicate details and an elegant design, each belt is made to highlight your beauty and give your look a perfect finish.",
  "Combinando glamour e sutileza, nossa coleção oferece peças que complementam diferentes estilos de noiva, do clássico ao moderno.":
    "Combining glamour and subtlety, our collection offers pieces for every bridal style, from classic to modern.",
  "Na ETERNA encontra cintos de noiva que fazem toda a diferença, tornando seu grande dia ainda mais especial.":
    "At ETERNA you will find bridal belts that make all the difference, making your big day even more special.",
  "Discretas, femininas e funcionais. As pochettes para noivas guardam o essencial com charme e completam o visual com elegancia minimalista.":
    "Discreet, feminine and practical. Bridal clutches carry the essentials with charm and complete the look with minimalist elegance.",
  "Carteira folha.": "Leaf handbag.",
  "Carteira rectangular.": "Rectangular handbag.",
  "Carteira perola rectangular.": "Rectangular pearl handbag.",
  "As echarpes da ETERNA combinam elegância e conforto, perfeitas para complementar looks com sofisticação.":
    "ETERNA scarves combine elegance and comfort, perfect for completing a look with sophistication.",
  "Confeccionadas com tecidos de qualidade e acabamentos refinados, cada peça acrescenta um toque de estilo e versatilidade, ideal para o dia a dia ou ocasiões especiais.":
    "Made with quality fabrics and refined finishes, each piece adds a touch of style and versatility, for everyday wear or special occasions.",
};

const META = /(Cor|Referência|Ref\.?)\s*:[^.]*\.?/gi;

/** EN: English description from the Portuguese one. PT: Descrição em inglês a partir da portuguesa. */
export function englishDescription(pt: string, name: Localized, code: string, colors: ProductColor[]): string {
  let hadMeta = false;
  const parts: string[] = [];
  for (const p of pt.split("\n\n")) {
    const core = p.replace(META, () => ((hadMeta = true), "")).trim();
    if (core && EN[core]) parts.push(EN[core]);
  }
  if (!parts.length) parts.push(`${name.en}.`);
  if (hadMeta || parts.length === 1) parts.push(colors.length === 1 ? `Colour: ${colors[0].name.en.toLowerCase()}. Reference: ${code}.` : `Reference: ${code}.`);
  return parts.join("\n\n");
}

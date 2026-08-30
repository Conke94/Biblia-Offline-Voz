export type ContentType = 'biblia' | 'aula';

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  subtitle: string;
  text: string;
}

export const contentData: ContentItem[] = [
  {
    id: 'b-salmo-23',
    type: 'biblia',
    title: 'Salmos 23',
    subtitle: 'O Senhor é o meu pastor',
    text: 'O Senhor é o meu pastor; nada me faltará. Ele me faz repousar em pastos verdejantes. Leva-me para junto das águas de descanso; refrigera-me a alma. Guia-me pelas veredas da justiça por amor do seu nome. Ainda que eu ande pelo vale da sombra da morte, não temerei mal nenhum, porque tu estás comigo; o teu bordão e o teu cajado me consolam. Preparas-me uma mesa na presença dos meus adversários, unges-me a cabeça com óleo; o meu cálice transborda. Bondade e misericórdia certamente me seguirão todos os dias da minha vida; e habitarei na Casa do Senhor para todo o sempre.'
  },
  {
    id: 'b-salmo-91',
    type: 'biblia',
    title: 'Salmos 91',
    subtitle: 'Aquele que habita no esconderijo do Altíssimo',
    text: 'Aquele que habita no esconderijo do Altíssimo e descansa à sombra do Onipotente diz ao Senhor: Meu refúgio e meu baluarte, Deus meu, em quem confio. Pois ele te livrará do laço do passarinheiro e da peste perniciosa. Cobrir-te-á com as suas penas, e, sob as suas asas, estarás seguro; a sua verdade é pavês e escudo. Não te assustarás do terror noturno, nem da seta que voa de dia, nem da peste que se propaga nas trevas, nem da mortandade que assola ao meio-dia. Caiam mil ao teu lado, e dez mil, à tua direita; tu não serás atingido. Somente com os teus olhos contemplarás e verás o castigo dos ímpios. Pois disseste: O Senhor é o meu refúgio. Fizeste do Altíssimo a tua morada. Nenhum mal te sucederá, praga nenhuma chegará à tua tenda. Porque aos seus anjos dará ordens a teu respeito, para que te guardem em todos os teus caminhos. Eles te sustentarão nas suas mãos, para não tropeçares em alguma pedra. Pisarás o leão e a áspide, calcarás aos pés o leãozinho e a serpente. Porque a mim se apegou com amor, eu o livrarei; pô-lo-ei a salvo, porque conhece o meu nome. Ele me invocará, e eu lhe responderei; na sua angústia eu estarei com ele, livrá-lo-ei e o glorificarei. Saciá-lo-ei com longevidade e lhe mostrarei a minha salvação.'
  },
  {
    id: 'b-joao-3',
    type: 'biblia',
    title: 'João 3',
    subtitle: 'Deus amou o mundo de tal maneira',
    text: 'Porque Deus amou ao mundo de tal maneira que deu o seu Filho unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna. Porquanto Deus enviou o seu Filho ao mundo, não para que julgasse o mundo, mas para que o mundo fosse salvo por ele. Quem nele crê não é julgado; o que não crê já está julgado, porquanto não crê no nome do unigênito Filho de Deus.'
  },
  {
    id: 'b-joao-14',
    type: 'biblia',
    title: 'João 14',
    subtitle: 'Eu sou o caminho, a verdade e a vida',
    text: 'Não se turbe o vosso coração; credes em Deus, crede também em mim. Na casa de meu Pai há muitas moradas. Se assim não fora, eu vo-lo teria dito. Pois vou preparar-vos lugar. E, quando eu for e vos preparar lugar, voltarei e vos receberei para mim mesmo, para que, onde eu estou, estejais vós também. E vós sabeis o caminho para onde eu vou. Disse-lhe Tomé: Senhor, não sabemos para onde vais; como saber o caminho? Respondeu-lhe Jesus: Eu sou o caminho, e a verdade, e a vida; ninguém vem ao Pai senão por mim.'
  },
  {
    id: 'a-amor-de-deus',
    type: 'aula',
    title: 'O Amor de Deus',
    subtitle: 'Lição 1',
    text: 'Olá, seja bem-vindo. Hoje vamos falar sobre o amor de Deus. A Bíblia nos diz que Deus é amor. Isso não significa apenas que Ele tem amor, mas que a Sua própria natureza é amar. Mesmo quando erramos, Ele não deixa de nos amar. O Seu amor é tão grande que Ele enviou Jesus, o Seu único filho, para nos salvar. Lembre-se sempre: você é profundamente amado por Deus. Não importa o seu passado, o amor de Deus alcança você hoje, e lhe oferece uma nova vida cheia de paz e esperança.'
  },
  {
    id: 'a-como-falar',
    type: 'aula',
    title: 'Como Falar com Deus',
    subtitle: 'Lição 2',
    text: 'Muitas pessoas pensam que para falar com Deus é preciso usar palavras difíceis ou estar em um lugar especial. Mas não é assim. Falar com Deus é como conversar com um amigo muito próximo. Você pode falar com Ele em qualquer lugar, a qualquer momento. Basta fechar os olhos, concentrar o seu coração e dizer o que está sentindo. Deus ouve os seus pensamentos, os seus medos, as suas alegrias. A oração é a nossa linha direta com o Criador. Experimente hoje, diga: Senhor, ajuda-me e ensina-me. Ele sempre ouve a oração sincera.'
  },
  {
    id: 'a-esperanca',
    type: 'aula',
    title: 'A Paz que Cristo Dá',
    subtitle: 'Lição 3',
    text: 'Vivemos em um mundo cheio de preocupações e ansiedades. As dificuldades parecem nos cercar. Mas Jesus nos prometeu uma paz diferente. Ele disse: Deixo-vos a paz, a minha paz vos dou; não vo-la dou como o mundo a dá. A paz de Cristo não depende das circunstâncias ao nosso redor. Ela é uma certeza silenciosa e forte dentro do nosso coração, de que Deus está no controle e de que tudo ficará bem. Quando se sentir aflito, peça a Jesus para encher o seu coração com essa paz. Respire fundo e confie.'
  }
];

export function getContentById(id: string): ContentItem | undefined {
  return contentData.find(item => item.id === id);
}

export function getContentByType(type: ContentType): ContentItem[] {
  return contentData.filter(item => item.type === type);
}

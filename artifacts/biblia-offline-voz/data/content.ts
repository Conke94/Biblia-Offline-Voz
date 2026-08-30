export type ContentType = 'biblia' | 'aula';

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  subtitle: string;
  text: string;
}

export interface BibleVerse {
  number: number;
  contentId: string;
  text: string;
}

export interface BibleChapter {
  number: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  id: string;
  name: string;
  chapters: BibleChapter[];
}

export const bibleBooks: BibleBook[] = [
  {
    id: 'salmos',
    name: 'Salmos',
    chapters: [
      {
        number: 23,
        verses: [
          { number: 1, contentId: 'b-salmos-23-1', text: 'O Senhor é o meu pastor; nada me faltará.' },
          { number: 2, contentId: 'b-salmos-23-2', text: 'Ele me faz repousar em pastos verdejantes. Leva-me para junto das águas de descanso.' },
          { number: 3, contentId: 'b-salmos-23-3', text: 'Refrigera-me a alma. Guia-me pelas veredas da justiça por amor do seu nome.' },
          { number: 4, contentId: 'b-salmos-23-4', text: 'Ainda que eu ande pelo vale da sombra da morte, não temerei mal nenhum, porque tu estás comigo; o teu bordão e o teu cajado me consolam.' },
        ],
      },
      {
        number: 91,
        verses: [
          { number: 1, contentId: 'b-salmos-91-1', text: 'Aquele que habita no esconderijo do Altíssimo e descansa à sombra do Onipotente.' },
          { number: 2, contentId: 'b-salmos-91-2', text: 'Diz ao Senhor: Meu refúgio e meu baluarte, Deus meu, em quem confio.' },
          { number: 3, contentId: 'b-salmos-91-3', text: 'Pois ele te livrará do laço do passarinheiro e da peste perniciosa.' },
        ],
      },
    ],
  },
  {
    id: 'joao',
    name: 'João',
    chapters: [
      {
        number: 3,
        verses: [
          { number: 16, contentId: 'b-joao-3-16', text: 'Porque Deus amou ao mundo de tal maneira que deu o seu Filho unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna.' },
          { number: 17, contentId: 'b-joao-3-17', text: 'Porquanto Deus enviou o seu Filho ao mundo, não para que julgasse o mundo, mas para que o mundo fosse salvo por ele.' },
          { number: 18, contentId: 'b-joao-3-18', text: 'Quem nele crê não é julgado; o que não crê já está julgado, porquanto não crê no nome do unigênito Filho de Deus.' },
        ],
      },
      {
        number: 14,
        verses: [
          { number: 1, contentId: 'b-joao-14-1', text: 'Não se turbe o vosso coração; credes em Deus, crede também em mim.' },
          { number: 2, contentId: 'b-joao-14-2', text: 'Na casa de meu Pai há muitas moradas. Se assim não fora, eu vo-lo teria dito. Pois vou preparar-vos lugar.' },
          { number: 6, contentId: 'b-joao-14-6', text: 'Respondeu-lhe Jesus: Eu sou o caminho, e a verdade, e a vida; ninguém vem ao Pai senão por mim.' },
        ],
      },
    ],
  },
];

export const lessons: ContentItem[] = [
  {
    id: 'a-amor-de-deus',
    type: 'aula',
    title: 'O Amor de Deus',
    subtitle: 'Lição 1',
    text: 'Olá, seja bem-vindo. Hoje vamos falar sobre o amor de Deus. A Bíblia nos diz que Deus é amor. Isso não significa apenas que Ele tem amor, mas que a Sua própria natureza é amar. Mesmo quando erramos, Ele não deixa de nos amar. O Seu amor é tão grande que Ele enviou Jesus, o Seu único filho, para nos salvar. Lembre-se sempre: você é profundamente amado por Deus.',
  },
  {
    id: 'a-como-falar',
    type: 'aula',
    title: 'Como Falar com Deus',
    subtitle: 'Lição 2',
    text: 'Falar com Deus é como conversar com um amigo muito próximo. Você pode falar com Ele em qualquer lugar, a qualquer momento. Deus ouve os seus pensamentos, os seus medos e as suas alegrias. A oração é a nossa linha direta com o Criador.',
  },
  {
    id: 'a-esperanca',
    type: 'aula',
    title: 'A Paz que Cristo Dá',
    subtitle: 'Lição 3',
    text: 'Jesus nos prometeu uma paz diferente. A paz de Cristo não depende das circunstâncias ao nosso redor. Ela é uma certeza silenciosa e forte dentro do nosso coração, de que Deus está no controle.',
  },
];

const verseContent: ContentItem[] = bibleBooks.flatMap((book) =>
  book.chapters.flatMap((chapter) =>
    chapter.verses.map((verse) => ({
      id: verse.contentId,
      type: 'biblia' as const,
      title: `${book.name} ${chapter.number}:${verse.number}`,
      subtitle: `Versículo ${verse.number}`,
      text: verse.text,
    })),
  ),
);

export const contentData: ContentItem[] = [...verseContent, ...lessons];

export function getContentById(id: string): ContentItem | undefined {
  return contentData.find((item) => item.id === id);
}
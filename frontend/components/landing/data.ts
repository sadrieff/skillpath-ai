// Landing copy and demo data. Catalog facts match backend/app/seed.py.

export interface QuizOption {
  text: string;
  /** Feedback shown when this option is picked. */
  feedback: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correct: number;
  correctFeedback: string;
}

export const QUIZ: QuizQuestion[] = [
  {
    id: "float-type",
    prompt: "Какой тип у значения 3.14 в Python?",
    options: [
      {
        text: "int",
        feedback:
          "int хранит только целые числа. У 3.14 есть дробная часть, поэтому это float.",
      },
      {
        text: "float",
        feedback: "",
      },
      {
        text: "str",
        feedback:
          "Строка записывается в кавычках: \"3.14\". Без кавычек это число с дробной частью, то есть float.",
      },
    ],
    correct: 1,
    correctFeedback: "Верно. Числа с дробной частью в Python имеют тип float.",
  },
  {
    id: "string-plus",
    prompt: "Что выведет print(\"42\" + \"1\")?",
    options: [
      {
        text: "43",
        feedback:
          "Кавычки делают значения строками. Знак + склеивает строки, а не складывает числа, поэтому получится 421.",
      },
      {
        text: "421",
        feedback: "",
      },
      {
        text: "Ошибка",
        feedback:
          "Ошибки не будет: две строки можно складывать, они склеиваются. Результат: 421.",
      },
    ],
    correct: 1,
    correctFeedback: "Верно. Знак + склеивает строки: \"42\" и \"1\" дают \"421\".",
  },
];

export interface CatalogLesson {
  title: string;
  module: string;
  keys: string[];
}

export interface CatalogCourse {
  title: string;
  level: string;
  keys: string[];
  lessons: CatalogLesson[];
}

/** Hard-coded slice of the seeded catalog. Matching is by word stems, no AI. */
export const CATALOG: CatalogCourse[] = [
  {
    title: "Python для начинающих",
    level: "Начальный уровень",
    keys: ["python", "питон", "питоне"],
    lessons: [
      {
        title: "Условия и циклы",
        module: "Управление ходом программы",
        keys: ["цикл", "условия", "условие", "for", "while", "if"],
      },
      {
        title: "Функции",
        module: "Управление ходом программы",
        keys: ["функц", "def", "аргумент"],
      },
      {
        title: "Переменные и типы данных",
        module: "Знакомство с Python",
        keys: ["переменн", "тип", "список", "срез"],
      },
    ],
  },
  {
    title: "Основы SQL",
    level: "Начальный уровень",
    keys: ["sql", "база", "базы", "запрос"],
    lessons: [
      {
        title: "Запрос SELECT",
        module: "Реляционные базы данных",
        keys: ["select", "запрос", "выборк"],
      },
      {
        title: "Фильтрация и сортировка: WHERE и ORDER BY",
        module: "Фильтрация и соединения",
        keys: ["where", "фильтр", "сортиров", "order"],
      },
      {
        title: "Соединения таблиц: JOIN и агрегаты",
        module: "Фильтрация и соединения",
        keys: ["join", "соединен", "агрегат", "group"],
      },
    ],
  },
  {
    title: "Git и GitHub",
    level: "Начальный уровень",
    keys: ["git", "github", "гит"],
    lessons: [
      {
        title: "Коммиты и история изменений",
        module: "Основы Git",
        keys: ["коммит", "commit", "история"],
      },
      {
        title: "Ветки и слияние",
        module: "Совместная работа",
        keys: ["ветк", "branch", "слиян", "merge"],
      },
      {
        title: "Pull request на GitHub",
        module: "Совместная работа",
        keys: ["pull", "request", "пулл"],
      },
    ],
  },
];

export interface CatalogMatch {
  course: CatalogCourse;
  lessons: CatalogLesson[];
}

export function matchCatalog(query: string): CatalogMatch[] {
  const q = query.toLowerCase();
  const hit = (keys: string[]) => keys.some((k) => q.includes(k));
  const result: CatalogMatch[] = [];
  for (const course of CATALOG) {
    const lessons = course.lessons.filter((l) => hit(l.keys));
    const courseHit = hit(course.keys);
    if (courseHit || lessons.length) {
      result.push({ course, lessons: lessons.length ? lessons : course.lessons.slice(0, 1) });
    }
  }
  return result;
}

export const CAPABILITIES: { name: string; value: string }[] = [
  { name: "Каталог", value: "Python, SQL, Git" },
  { name: "Уроки", value: "Текст, видео или файл" },
  { name: "Тесты", value: "Проходной балл 70%" },
  { name: "ИИ-наставник", value: "Объясняет ошибки в тестах" },
  { name: "Прогресс", value: "Процент по каждому курсу" },
  { name: "Админка", value: "Курсы, уроки, тесты, файлы" },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Сколько стоит?",
    a: "Оплаты нет: в продукте нет платёжной части. Записаться на курс можно после входа через Google.",
  },
  {
    q: "Как работает ИИ?",
    a: "Наставник отвечает через внешний сервис RouterAI, модель qwen. Он видит текст урока и ваш неверный ответ. Ответ сгенерирован ИИ, он может ошибаться, поэтому сверяйте его с уроком.",
  },
  {
    q: "Можно войти без Google?",
    a: "Нет. Паролей в системе нет, вход только через аккаунт Google. Демо-вход включается отдельно, для проверки.",
  },
  {
    q: "Будут сертификаты?",
    a: "Нет. SkillPath AI не выдаёт сертификатов. Видно прогресс по курсу и результаты тестов.",
  },
  {
    q: "Работает на телефоне?",
    a: "Да. Кабинет, каталог, уроки и тесты открываются и на телефоне, и на компьютере.",
  },
  {
    q: "Какие данные вы храните?",
    a: "Из Google берём email, имя и аватар. Ещё храним записи на курсы, прогресс, результаты тестов и диалоги с наставником. Пароли не храним. Текст урока и ваши ответы уходят в RouterAI, ключ к нему лежит только на сервере.",
  },
];

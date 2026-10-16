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
    id: "slice",
    prompt: "Что выведет print(len([1, 2, 3][1:]))?",
    options: [
      {
        text: "1",
        feedback:
          "Срез не оставляет один элемент. [1:] берёт всё, начиная с индекса 1, это 2 и 3.",
      },
      {
        text: "2",
        feedback: "",
      },
      {
        text: "3",
        feedback:
          "Срез [1:] пропускает первый элемент, с индексом 0. Остаются 2 и 3, то есть два элемента.",
      },
    ],
    correct: 1,
    correctFeedback: "Верно. Срез [1:] берёт элементы с индекса 1: это 2 и 3.",
  },
  {
    id: "list-multiply",
    prompt: "Что будет в x после кода x = [0] * 3 и x[0] = 5?",
    options: [
      {
        text: "[5, 5, 5]",
        feedback:
          "Присваивание x[0] = 5 меняет только элемент с индексом 0. Остальные два остаются нулями.",
      },
      {
        text: "[5, 0, 0]",
        feedback: "",
      },
      {
        text: "[0, 0, 5]",
        feedback:
          "Индексация начинается с нуля. x[0] это первый элемент, поэтому меняется именно он.",
      },
    ],
    correct: 1,
    correctFeedback: "Верно. [0] * 3 даёт три нуля, и присваивание меняет только первый.",
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

export const PHOTO_CREDITS: { label: string; by: string; licence: string; url: string }[] = [
  {
    label: "Классная доска, 1923",
    by: "FOTO:Fortepan, Wikimedia Commons",
    licence: "public domain",
    url: "https://commons.wikimedia.org/wiki/File:Education,_school,_classroom,_blackboard,_teacher_Fortepan_3612.jpg",
  },
  {
    label: "Класс, Вашингтон, 1899",
    by: "Frances Benjamin Johnston, Library of Congress, Wikimedia Commons",
    licence: "public domain",
    url: "https://commons.wikimedia.org/wiki/File:Classroom_scene_in_Washington,_D.C._elementary_school_-_children_working_with_blocks_and_at_blackboard_in_mathematics_class_LCCN2001703711.jpg",
  },
  {
    label: "Публичная библиотека, Сидней, c. 1885",
    by: "State Library of New South Wales, Wikimedia Commons",
    licence: "public domain",
    url: "https://commons.wikimedia.org/wiki/File:Staff_inside_the_Free_Public_Library_(old_State_Library_of_New_South_Wales),_c._1885_-_Flickr_-_State_Library_of_NSW.jpg",
  },
  {
    label: "Школьная комната, Кармсунд, c. 1910",
    by: "Wolfmann, Wikimedia Commons, CC BY-SA 4.0",
    licence: "CC BY-SA 4.0",
    url: "https://commons.wikimedia.org/wiki/File:Karmsund_folkemuseum_Haugesund_Norway_Interior_Skolestue_klasserom_Class_room_ca_1910_Skolepulter_skrivepulter_benker_school_room_benches_writing_desks_Kateter_Tavle_Blackboard_etc_2020-06-10_DSC00312.jpg",
  },
];

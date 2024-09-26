const Epub = require("epub-gen");
const cheerio = require("cheerio");
const fs = require("fs");

const { booksMap } = require('./constants');

const text = fs.readFileSync("test.txt", "utf8");
const slug = require("slug");

const getHtmlOfAChapter = async (link) => {
  const response = await fetch(link);
  const body = await response.text();
  const $ = cheerio.load(body);
  return $(".row .bible-read").html();
};

const BASE_URL = "https://kinhthanh.httlvn.org";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getAllBooks = async () => {
  const response = await fetch('https://kinhthanh.httlvn.org/?v=RVV11');
  const body = await response.text();
  const $ = cheerio.load(body);

  const bookElements = $(".book-list .col-md-12");

  // Use for...of to await each request and introduce a delay
  for (let i = 0; i < bookElements.length; i++) {
    const el = bookElements[i];

    const name = $(el).find("span").text();

    if (name) {
      console.log(`Fetching ${name}`);


      const chapterLinks = $(el).find(".dropdown-item a");
      for (let index = 0; index < chapterLinks.length; index++) {
        const el2 = chapterLinks[index];
        const link = BASE_URL + $(el2).attr("href");
        console.log(`Fetching ${link}`);

        const text = await getHtmlOfAChapter(link);

        // Add delay after each request
        await delay(100);

        const folderBook = slug(name, { lower: true });

        // Ensure the directory for the book exists
        if (!fs.existsSync(`./books/${folderBook}`)) {
          fs.mkdirSync(`./books/${folderBook}`);
        }

        // Write each chapter to a file

        fs.writeFileSync(`./books/${folderBook}/c-${index}.html`, text, "utf8");
      }
    }
  }

  const chapters = $(".book-list .col-md-12 .dropdown li").text();
  console.log(chapters);
};

const getAllChapters = async () => {
  const response = await fetch('https://kinhthanh.httlvn.org/?v=RVV11');
  const body = await response.text();
  const $ = cheerio.load(body);

  const bookElements = $(".book-list .col-md-12");
  const bookChaptersMap = {};

  // Use for...of to await each request and introduce a delay
  for (let i = 0; i < bookElements.length; i++) {
    const el = bookElements[i];

    const name = $(el).find("span").text().trim();


    if (name) {
      const chapters = [];
      const chapterLinks = $(el).find(".dropdown-item a");
      for (let index = 0; index < chapterLinks.length; index++) {
        const el2 = chapterLinks[index];

        const regex = /\/doc-kinh-thanh\/([a-z0-9]+)\/(\d+)/;
        const [_, bookCode, chapter] = $(el2).attr("href").match(regex) || [];

        if (bookCode && chapter) {
          chapters.push(`<a style="text-decoration: none;" href="#${bookCode}_${chapter}">
              <button style="text-align: center; vertical-align: middle; height: 45px; width: 45px; padding: 10px 5px; margin: 5px; border: none; font-size: 15px; border-radius: 5px; font-weight: bold;">
                ${Number.parseInt(chapter) || "ⓘ"}
              </button></a>`);
        }
      }

      bookChaptersMap[name] = chapters;
    }
  }

  fs.writeFileSync("books-chapters.json", JSON.stringify(bookChaptersMap, null, 2));
};

const convertToBook = async (options) => {
  await getAllChapters();

  const booksChapters = JSON.parse(fs.readFileSync("books-chapters.json", "utf8"));
  const originalBooksMap = JSON.parse(fs.readFileSync("books.json", "utf8"));

  const bookContent = [];

  for (let index = 0; index < 66; index++) {
    const mainName = booksMap[index].title;
    const name = originalBooksMap[index].title;

    if (!mainName || !name) {
      throw new Error(`Missing name for ${mainName}`);
    }

    let content = booksChapters[name].join("\n");

    for (let chapter = 0; chapter < booksChapters[name].length; chapter++) {
      const chapterContent = fs.readFileSync(`./books/${slug(name, { lower: true })}/c-${chapter}.html`, "utf8");

      const $ = cheerio.load(`<body>${chapterContent}</body>`);

      $('a[data-toggle="tooltip"]').remove();
      $('div.title > p').remove();

      if (options.type === "no-verse") {
        $('span.verse > sup').remove();

        if (chapter > 0) {
          $('div.title > h3').remove();
          $('div.title > h2').remove();
        } else {
          $('div.title > p').remove();
        }
      }

      content += "\n" + $("body").html();
    }

    bookContent.push({
      title: mainName,
      data: content
    });
  }

  fs.writeFileSync("books-archive.json", JSON.stringify(bookContent, null, 2));

  const option = {
    title: options.title,
    author: "Almighty God",
    publisher: "United Bible Societies",
    cover: options.cover,
    tocTitle: "Mục Lục",
    beforeToc: true,
    content: bookContent,
    css: "body { font-family: 'Bookerly', sans-serif; }",
    fonts: [
      "./fonts/bookerly/Bookerly.ttf",
      "./fonts/bookerly/BookerlyBold.ttf",
      "./fonts/bookerly/BookerlyBoldItalic.ttf",
      "./fonts/bookerly/BookerlyItalic.ttf"
    ]
  };

  new Epub(option, options.file);
};

const noVerseOptions = {
  type: "no-verse",
  title: "Kinh Thánh Tiếng Việt (No Verse)",
  cover: "./cover-no-verse.png",
  file: "bible-no-verse.epub",
}

const verseOptions = {
  type: "verse",
  title: "Kinh Thánh Tiếng Việt",
  cover: "./cover.png",
  file: "bible.epub",
}

// getAllBooks();
convertToBook(noVerseOptions);
convertToBook(verseOptions);

// getAllChapters();
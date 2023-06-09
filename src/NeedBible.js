import { html2json } from "html2json";

import { Keeper } from "./Keeper";
import { ProgressStatus } from "./ProgressStatus";

import { ScriptureSite } from "./ScriptureSite";
import { GlobalBible } from "./GlobalBible";

class NeedBible {
  constructor(bibleVersion, typeContent, statusSrc) {
    this.initStartRange = false;
    this.needBooks = [];
    this.allBooks = [];
    this.contentArray = [];
    this.scriptureSite = new ScriptureSite(statusSrc);
    this.countVerse = 0;
    this.bibleVersion = bibleVersion;
    this.typeContent = typeContent;
    this.progressStatus = new ProgressStatus(statusSrc);
  }

  async fillAllBooks() {
    const data = await this.scriptureSite.getAllBooks(this.bibleVersion);
    data.forEach(function (element) {
      element.chapters.forEach((el) => {
        this.allBooks.push(el.id);
      }, this);
    }, this);
  }

  async fillNeedBooks() {
    const globalBible = new GlobalBible();

    this.allBooks.forEach(function (el) {
      globalBible.getAllChapters().forEach(function (element) {
        if (element.chapterId === el) {
          this.needBooks.push(element);
        }
      }, this);
    }, this);

    this.progressStatus.setAllValue(this.needBooks.length);
  }
  async fillGlobal() {
    let keeper = new Keeper();
    await this.fillAllBooks();
    this.fillNeedBooks();
    await this.fillContent().then(() =>
      keeper.save(this.contentArray, this.bibleVersion, this.typeContent)
    );
  }

  async fillContent() {
    let startRange = "123";
    let finishRange = "321";

    //учитываем запрос на intro
    for (let index = 0; index < this.needBooks.length; index++) {
      this.progressStatus.showValue(index);

      let item = this.needBooks[index];

      //Формирование content начинаем с GEN.intro
      if (item.chapterId.includes("intro") && index === 0) {
        await this.fillIntroContent(this.bibleVersion, item.chapterId);
      } else {
        //Проверяем или был инициализирован стартовый адрес диапазона
        if (!this.initStartRange) {
          if (item.chapterId.includes("intro")) {
            index--;
            item = this.needBooks[index];
          }
          startRange = item.chapterId;
          this.initStartRange = true;
        }
        this.countVerse += item.countVerse;

        //Контролируем, чтобы количество стихов в запросе не превышало 200
        if (this.countVerse >= 200) {
          index--;
          item = this.needBooks[index];

          while (item.chapterId.includes("intro")) {
            index -= 2;
            item = this.needBooks[index];
          }

          finishRange = item.chapterId;
          this.initStartRange = false;
          this.countVerse = 0;

          await this.fillChapterContent(startRange, finishRange);
        }
        //Последний стих Библии всегда финишный диапазон запроса
        if (index === this.needBooks.length - 1) {
          item = this.needBooks[index];
          finishRange = item.chapterId;
          this.initStartRange = false;
          this.countVerse = 0;
          await this.fillChapterContent(startRange, finishRange);
        }
      }
    }
    this.progressStatus.showValue(this.needBooks.length);
  }

  async fillIntroContent(bibleVersion, chapterId) {
    const value = await this.scriptureSite.getAllVerses(
      bibleVersion,
      chapterId
    );

    let content;
    switch (this.typeContent) {
      case "html":
        content = value.content;
        this.contentArray.push({
          chapterId,
          content,
        });
        break;
      case "json":
        let objTemp = html2json(value.content);
        let arrayTemp = [];
        objTemp.child.forEach(function (element) {
          arrayTemp.push({
            name: "para",
            type: "tag",
            attrs: { style: element.attr.class },
            items: [
              { text: element.child[0].text, type: element.child[0].node },
            ],
          });
        });
        this.contentArray.push({
          chapterId,
          content: arrayTemp,
        });
      default:
        content = value.content.replace(/(<([^>]+)>)/gi, " ");
        this.contentArray.push(content);
        break;
    }
  }

  async fillChapterContent(startRange, finishRange) {
    this.initStartRange = false;
    const range = `${startRange}-${finishRange}`;
    const { id, content: contentVerse } = await this.scriptureSite.getDataVerse(
      this.bibleVersion,
      range,
      this.typeContent
    );
    this.contentArray.push({
      chapterId: id,
      content: contentVerse,
    });
  }
}

export { NeedBible };

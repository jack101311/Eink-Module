/* Copyright <2025> <Chia-Wei Liu>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

class Book {
  //Book components properties
  container = document.documentElement;
  contents = document.body.childNodes;
  bookConfig = {};
  lang = undefined;
  bookEditor = new BookEditor(this);
  bookTitle = undefined;
  author = undefined;
  contentTable = null;
  noteSection = null;
  notes = [];
  fillers = [];
  pageStarters = [];
  pageStarter = null;
  static textSelection = "";
  static focusedBook = null;

  // Book Information properties
  instanceID = 0;
  mode = "scroll";
  containerHeight = 0;
  containerWidth = 0;
  pageHeight = 0;
  pageWidth = 0;
  pageLength = 0;
  totalPages = 1;
  inIOSBrowser = undefined;
  isLarge = false;
  originalFontSize = undefined;

  // Book State
  preventFlip = false;
  ignoreMutation = false;
  preventGestures = false;

  // Book Events
  onentereink = () => {};
  onenterscroll = () => {};
  onbookresize = () => {};
  onbookreset = () => {};
  onpagechange = () => {};
  onbookend = () => {};
  onbookstart = () => {};
  onvisible = () => {};

  static #count = 1;
  static #globalListenersSet = false;
  static #pageFlipped = false;
  static #scrollBufferLength = 2;
  static #preventVolumnKeyEvent = false;

  #currentPage = 1;
  #columnGap = 0;
  #mutationObserver = null;
  #resizeObserver = null;
  #resizeTimer = null;
  #resizeCount = 0;
  #fontSizeCheckInterval = null; // An interval timer ID used to check the font size change made by EinkBro.
  #originalLineHeight = undefined;
  #isWindowResizeEvent = false;
  #orientationState = undefined;
  #resetWhenVisible = false;
  #bookEvents = ["bookreset", "pagechange", "bookend", "bookresize", "entereink", "enterscroll", "bookstart", "visible", "hidden"];
  #eventHandlers = [];
  #oldScrollLength = 0;
  #isEndOfPage = false;
  #rwdEnforced = false;
  #pageEndReached = false; // Used to stop vertical paging algorithm.
  #edittingPageEnd = 0;
  #wrapped = false;
  #printAccessed = false;
  #einkModeStartTime = null;
  #correctScroll = false;
  #anchor = null;
  #touchStartX = 0;
  #touchStartY = 0;
  #cachedData = null;
  #startTouchesNumber = 0;
  #pageRanges = [];
  #pageSectionArrays = [];
  #contentBackup = null;
  #fileString = "";
  #originalParent = null;
  #originalNextSibling = null;

  //****For debug purposes****
  #edittingPageNum = 0;
  floatingElements = [];
  testDifference = [];
  failCount = 0;

  constructor(container = document.body, config = {}) {
    this.instanceID = Book.#count;
    Book.#count++;
    this.container = container.nodeName === "HTML" ? document.body : container;
    this.bookConfig = { ...Book.prototype.bookConfig, ...config };

    this.contents = typeof this.bookConfig.contents === "string" ? $(this.bookConfig.contents)[0] : this.bookConfig.contents;
    if (!this.contents) {
      let contents = $(this.container).find(" > .bookContents")[0];
      this.contents = contents ? contents : this.container;
    }

    this.container.classList.add("book");
    this.container.classList.add("book_" + this.instanceID);
    this.container.book = this;
    this.#columnGap = this.bookConfig.leftMargin * 2; // The column gap must be at least twice the left margin to prevent contents exposed to the next page.
    if (!this.bookConfig.bookTitle) {
      this.bookTitle = this.getBookTitle();
    } else {
      this.bookTitle = $(this.bookConfig.bookTitle)[0];
    }
    this.author = this.bookConfig.author;
    if (this.bookConfig.lang) this.lang = this.bookConfig.lang;
    else this.lang = document.documentElement.lang.includes("zh") ? "zh-TW" : "en";

    if (this.bookConfig.pagingMethod === "column") this.bookConfig.rightMargin = this.bookConfig.leftMargin;
    this.bookConfig.fullScreen = this.container.nodeName === "BODY" ? true : this.bookConfig.fullScreen; // If the container is HTML or BODY, set fullScreen to true by default
    if (this.isFullScreen || !Book.focusedBook) this.getFocus();

    if (this.contents === this.container) {
      // Redefine contents of the book to separate the two things.
      $(this.container).wrapInner(`<div class="bookContents article_${this.instanceID}"></div>`);
      this.contents = this.container.firstElementChild;
      $(this.contents).css({
        width: "100%",
        height: "100%",
      });
    } else {
      this.contents.classList.add("bookContents");
      this.contents.classList.add(`article_${this.instanceID}`);
    }
    this.contents.book = this;

    this.inIOSBrowser = (() => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      console.log("User agent: ", userAgent);

      if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return true;
      }

      // iOS version 13 and above detection (iPad on iOS 13 can report as a Mac)
      if (/Mac/.test(userAgent) && "ontouchend" in document) {
        return true;
      }

      return false;
    })();

    this.pageStarter = this.#createPageStarter(this.contents, 0);
    this.originalFontSize = parseFloat($(this.contents).css("font-size"));
    this.#originalLineHeight = parseFloat($(this.contents).css("line-height"));
    this.#updateContainerDimension();
    this.#orientationState = Book.getOrientationState();
    // this.floatingElements = Book.findFloatingElements(this.contents);
    this.noteSystem.init(this.lang);
    if (this.bookConfig.useContentTable) this.setupContentTable();

    // Check if Book class's global event listener is registered.
    if (!Book.#globalListenersSet) {
      Book.setupGlobalListeners();
      Book.#globalListenersSet = true;
    }
  }

  #updateContainerDimension() {
    if (this.isVisible) {
      if (this.isFullScreen) {
        this.containerWidth = window.innerWidth;
        this.containerHeight = window.innerHeight;
      } else {
        this.containerWidth = this.container.clientWidth;
        this.containerHeight = this.container.clientHeight;
      }
    } else {
      this.containerWidth = 0;
      this.containerHeight = 0;
    }
  }

  get edittingPageEnd() {
    return this.#edittingPageEnd;
  }

  set edittingPageEnd(x) {
    this.#edittingPageEnd = x;
    this.#edittingPageNum = Math.round((this.#edittingPageEnd + this.bookConfig.lowerMargin) / this.pageHeight);
    console.log("Now editting on page: " + this.#edittingPageNum);
  }

  get isVisible() {
    /* Book is considered visible only if it's displayed and visible. **Note: Can't use $(this.container).css("display") !== "none" to judge whether the book is displayed, it may still not be displayed when it's display style property is computed to "block" if one of it's ancestors has this display preperty set to "none". */
    return this.container.clientWidth !== 0 && this.container.clientHeight !== 0 && $(this.container).css("visibility") === "visible";
  }

  get mode() {
    return sessionStorage.mode === "eink" ? "eink" : "scroll";
  }

  get isFocused() {
    return Book.focusedBook === this;
  }

  get isFullScreen() {
    return this.bookConfig.fullScreen;
  }

  get bookItem() {
    return this.item(".bookItem");
  }

  get bookUI() {
    return this.item(".bookUI");
  }

  get scrollLengthChanged() {
    if (this.isVisible) {
      // Use absolute value rather than !== to deal with reflow and floating errors for Chrome browser.
      return this.bookConfig.pagingMethod === "vertical" ? Math.abs(this.container.scrollHeight - this.#oldScrollLength) > 2 : Math.abs(this.container.scrollWidth - this.#oldScrollLength) > 2;
    } else {
      return false;
    }
  }

  get currentPage() {
    return this.#currentPage;
  }

  getFocus() {
    Book.focusedBook = this;
    console.log("Book " + this.instanceID + " is focused.");
  }

  getBlur() {
    const closestBook = $(".book").filter((index, elem) => $(elem).is($(this.container).parents()) && elem.book?.isVisible)[0]?.book;
    Book.focusedBook = closestBook ? closestBook : $(".book").filter((index, elem) => elem.book?.isVisible)[0].book;
    console.log("Book " + this.instanceID + " is blurred.");
    console.log("Current focused book: Book" + Book.focusedBook.instanceID);
  }

  getBookTitle() {
    let count = 1;
    let title = document.getElementsByTagName("H" + count)[0];
    while (!title) {
      count++;
      title = document.getElementsByTagName("H" + count)[0];
    }

    return title;
  }

  static getOrientationState() {
    return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  }

  getPageStarter(catchPointX = this.pageWidth / 2, catchPointY = 10) {
    // Catch points use page coordinates.
    let { offsetNode, offset } = this.#getCaretPositionFromPoint(this.contents.offsetLeft + catchPointX, this.contents.offsetTop + catchPointY);

    if ((!offsetNode || offsetNode.nodeType !== Node.TEXT_NODE) && Math.abs(this.getPageNumByItem(offsetNode) - this.currentPage) > 1) {
      // If offsetNode is an element node, it means there's no caret position, and it should be checked if it's position is within the currentPage (error tolerance +- 1 page).

      let invalidNode = offsetNode;
      let scanX = catchPointX;
      let scanY = catchPointY;
      while (offsetNode === invalidNode && Math.abs(this.getPageNumByItem(offsetNode) - this.currentPage) > 1) {
        console.log("rescaning for page starter at (" + scanX + ", " + scanY + ")");
        invalidNode = offsetNode;
        scanX += 30;
        if (scanX > this.pageWidth) {
          scanX = 0;
          scanY += 30;
          if (scanY > this.pageHeight) {
            console.warn("Unable to find a valid pageStarter within the current page.");
            break;
          }
        }

        ({ offsetNode, offset } = this.#getCaretPositionFromPoint(this.contents.offsetLeft + scanX, this.contents.offsetTop + scanY));
        // Check if we've reached the end of the content
        if (!offsetNode) {
          console.warn("Reached the end of the content without finding a valid pageStarter.");
          break;
        }
      }
    }

    let pageStarter = this.#createPageStarter(offsetNode, offset);
    if (offsetNode) {
      if (this.bookConfig.pagingMethod === "column") {
        return pageStarter;
      }

      // vertical paging method need extra work to find the correct page starter.
      if (this.isValidNode(offsetNode)) {
        let target = offsetNode;
        while (target.className?.includes("filler")) {
          target = target.nextSibling;
        }
        return this.#createPageStarter(target, 0);
      }

      return this.#createPageStarter(this.contents, 0);
    } else {
      console.warn("Falling back to the first element of the current page.");
      return this.#createPageStarter(this.contents, 0);
    }
  }

  getPageEnder(catchPointX = this.pageWidth / 2, catchPointY = this.pageHeight - 10) {
    // Catch points page coordinates.
    let { offsetNode, offset } = this.#getCaretPositionFromPoint(this.contents.offsetLeft + catchPointX, this.contents.offsetTop + catchPointY);

    if ((!offsetNode || offsetNode.nodeType !== Node.TEXT_NODE) && Math.abs(this.getPageNumByItem(offsetNode) - this.currentPage) > 1) {
      let scanX = catchPointX;
      let scanY = catchPointY;
      let invalidNode = offsetNode;

      while (offsetNode === invalidNode && Math.abs(this.getPageNumByItem(offsetNode) - this.currentPage) > 1) {
        console.log("rescaning for page ender at (" + scanX + ", " + scanY + ")");
        invalidNode = offsetNode;
        scanX -= 30;
        if (scanX < 0) {
          scanX = this.pageWidth;
          scanY -= 30;
          if (scanY < 0) {
            console.warn("Unable to find a valid pageEnder within the current page.");
            break;
          }
        }

        ({ offsetNode, offset } = this.#getCaretPositionFromPoint(this.contents.offsetLeft + scanX, this.contents.offsetTop + scanY));
      }
    }

    let pageEnder = this.#createPageStarter(offsetNode, offset);
    if (offsetNode) {
      if (this.bookConfig.pagingMethod === "column") {
        return pageEnder;
      }

      // vertical paging method need extra work to find the correct page ender.
      if (this.isValidNode(offsetNode)) {
        let target = offsetNode;
        while (target.className?.includes("filler")) {
          target = target.previousSibling;
        }
        return this.#createPageStarter(target, target.textContent?.length || 0);
      }

      return this.#createPageStarter(this.contents, this.contents.childNodes.length);
    } else {
      console.warn("Falling back to the last element of the current page.");
      return this.#createPageStarter(this.contents, this.contents.childNodes.length);
    }
  }

  #processPageBreak(startPage = 1, endPage = this.totalPages) {
    console.log("Getting all page starters of Book instance: " + this.instanceID);

    this.#cachedData = this.currentPage; // Save the page number before process page break.
    // Keep the original contents and use a copy to section the pages and display the print version. Thus the original DOM structure can be maintained.
    this.#contentBackup = this.contents;
    let bookCopy = this.contents.cloneNode(true);
    this.contents.replaceWith(bookCopy);
    this.contents = $(this.container).find(".article_" + this.instanceID)[0];

    this.currentPage = startPage;
    const t0 = performance.now();
    while (this.currentPage < endPage) {
      this.#sectionPage();
      this.currentPage++;
    }
    this.#sectionPage();

    // !! Important: the below 2 constants have to be declared here before insertion of pageSections in order to get the correct scroll length.
    const scrollLength = this.bookConfig.pagingMethod === "vertical" ? this.container.scrollHeight : this.container.scrollWidth;
    this.#fileString = this.instanceID + "_" + Math.round(this.container.clientWidth) + "_" + Math.round(this.container.clientHeight) + "_" + parseInt($(this.contents).css("font-size")) + "_" + scrollLength;

    let pageSectionArray = [];
    this.#pageRanges.forEach((pageRange) => {
      pageRange.breakHeadMargin = pageRange.startContainer.nodeType === Node.TEXT_NODE ? true : false;
      pageRange.breakTailMargin = pageRange.endContainer.nodeType === Node.TEXT_NODE ? true : false;

      pageRange.extractContents();
      pageRange.insertNode(pageRange.pageSection);
      pageSectionArray.push(pageRange.pageSection);
    });

    // Store the page sections for future use
    this.#pageSectionArrays.push([this.#fileString, pageSectionArray, bookCopy]);

    $(this.contents)
      .find("*")
      .filter(function () {
        return Book.isElementEmpty(this);
      })
      .remove();

    this.#pageRanges.forEach((pageRange, index) => {
      const pageSection = pageRange.pageSection;

      // Set the start attribute for the first ol in the next page section
      if (index < this.#pageRanges.length - 1) {
        const nextPageSection = this.#pageRanges[index + 1].pageSection;
        const firstLi = nextPageSection.querySelector("li:first-of-type");
        if (firstLi && pageRange.pageSection.dataset.nextOlStart) {
          firstLi.closest("ol")?.setAttribute("start", pageRange.pageSection.dataset.nextOlStart);
        }
      }

      // Check if the pageSection's DOM level should be adjusted to upper level.
      let sectionParent = pageSection.parentElement;
      while (sectionParent?.children.length === 1) {
        const clonedParent = sectionParent.cloneNode(false);
        clonedParent.append(...pageSection.childNodes);
        pageSection.append(clonedParent);
        $(pageSection).unwrap();
        sectionParent = pageSection.parentElement;
      }

      // Process the border, margin and padding of the head and tail subparents
      if (pageRange.breakHeadMargin) {
        let headMarginElem = pageSection.firstElementChild;
        while (headMarginElem) {
          $(headMarginElem).css({
            "border-top": "0px",
            "margin-top": "0px",
            "padding-top": "0px",
          });
          headMarginElem = headMarginElem.firstElementChild;
        }
      }
      if (pageRange.breakTailMargin) {
        let tailMarginElem = pageSection.lastElementChild;
        while (tailMarginElem) {
          $(tailMarginElem).css({
            "border-bottom": "0px",
            "margin-bottom": "0px",
            "padding-bottom": "0px",
          });
          tailMarginElem = tailMarginElem.lastElementChild;
        }
      }

      // Append the canvas related to this pageSection
      const canvasID = "draw" + (index + 1) + "_" + this.#fileString;
      const canvas = document.getElementById(canvasID);
      if (canvas) {
        pageRange.pageSection.canvas = canvas;
        canvas.top = $(canvas).css("top");
        canvas.left = $(canvas).css("left");
        $(canvas).css({
          top: this.bookConfig.upperMargin * -1 + "px",
          left: this.bookConfig.leftMargin * -1 + "px",
          display: "block",
          position: "absolute",
        });
        pageSection.appendChild(canvas);
      }
    });

    const t1 = performance.now();

    this.setupEinkStyle(
      `
        .page-section {
          break-before: page;
          display: block;
          position: relative;
          margin-top: ${this.bookConfig.upperMargin}px;
          margin-bottom: ${this.bookConfig.lowerMargin}px;
          width: ${this.pageWidth}px;
          height: ${this.pageHeight}px;
        }
      `,
      false
    );
    $(".page-section").first().css({
      "margin-top": "0px",
      "break-before": "avoid",
    });

    console.log("Time taken to get page starters: " + (t1 - t0) + " milliseconds.");
    console.log("Page starters assembled.");
  }

  static isElementEmpty(elem) {
    // Check if the element is an image
    if (["img", "canvas", "svg", "input", "iframe", "area", "base", "col", "embed", "hr", "link", "source", "param"].includes(elem.nodeName.toLowerCase())) {
      return false;
    }

    // Check if the element has no text content
    if (elem.textContent.trim() !== "") {
      return false;
    }

    // Check children recursively
    for (let child of elem.children) {
      if (!Book.isElementEmpty(child)) {
        return false;
      }
    }

    return true;
  }

  #addPageBreak() {
    const pageStarter = this.getPageStarter(0);
    if (pageStarter.starter.nodeType === Node.ELEMENT_NODE) {
      if (pageStarter.starter.nodeName === "A") {
        $(pageStarter.starter).css("display", "block");
      }
      pageStarter.starter.classList.add("pageStarter");
    } else {
      let blockParent = pageStarter.starter.parentElement;
      if ($(blockParent).css("display") === "inline") {
        blockParent = blockParent.parentElement;
        while ($(blockParent).css("display") === "inline") {
          blockParent = blockParent.parentElement;
        }
        const range = Book.rangeTool.createRange(pageStarter.starter, blockParent, pageStarter.offset, blockParent.childNodes.length);
        const starter = document.createElement("span");
        starter.classList.add("pageBreaker");
        const section = range.extractContents();
        starter.appendChild(section);
        range.insertNode(starter);
      } else {
        const range = Book.rangeTool.createRange(pageStarter.starter, pageStarter.starter, pageStarter.offset, pageStarter.offset);
        const breaker = document.createElement("span");
        breaker.classList.add("pageBreaker");
        breaker.classList.add("pageStarter");
        range.surroundContents(breaker);
      }
    }
    this.pageStarters.push(pageStarter);
  }

  #sectionPage() {
    const pageStarter = this.getPageStarter(0);
    // this.pageStarters.push(pageStarter);
    const pageEnder = this.getPageEnder(this.pageWidth - 10); // -10 to stay in the boudary.
    const range = Book.rangeTool.createRange(pageStarter.starter, pageEnder.starter, pageStarter.offset, pageEnder.offset);

    // Create a new div element
    const wrapperDiv = document.createElement("pagesection");
    wrapperDiv.classList.add("page-section");
    wrapperDiv.dataset.pageNumber = this.currentPage;

    // Clone the contents of the range
    let clonedContents = range.cloneContents();

    // Check if the pageEnder is within an <ol> element
    let lastOl = clonedContents.querySelector("ol:last-of-type");
    if (clonedContents.firstElementChild === lastOl) lastOl = null;
    if (lastOl) {
      let nextPageStartNum = 1;
      const lastLi = lastOl.querySelector("li:last-of-type");
      if (lastLi.parentElement === lastOl) {
        // Count the number of preceding <li> elements
        nextPageStartNum = Array.from(lastOl.children).indexOf(lastLi) + 2;
      }
      // Store the next start number in the wrapper div's dataset
      wrapperDiv.dataset.nextOlStart = nextPageStartNum;
    }

    // Append the cloned contents to the wrapper div
    wrapperDiv.appendChild(clonedContents);

    // Remove empty text nodes
    $(wrapperDiv)
      .find("*")
      .filter((i, el) => {
        return el.nodeType === Node.TEXT_NODE && el.textContent.trim() === "";
      })
      .remove();

    range.pageSection = wrapperDiv;
    this.#pageRanges.push(range);
  }

  #getCaretPositionFromPoint(bookX, bookY) {
    const clientX = this.container.getBoundingClientRect().left + bookX;
    const clientY = this.container.getBoundingClientRect().top + bookY;
    let topElems = [];

    // disable pointerEvents for all top layer elements that does not belong to this book's contents.
    let topElem = document.elementFromPoint(clientX, clientY);
    while (topElem && (!topElem.book || topElem.book !== this) && topElem.closest(".article_" + this.instanceID) !== this.contents) {
      if (["HTML", "BODY"].includes(topElem.tagName)) break;
      if ($(topElem).css("position") !== "static") {
        topElem.style.pointerEvents = "none";
        topElems.push(topElem);
      } else {
        topElem.offsetParent.style.pointerEvents = "none";
        topElems.push(topElem.offsetParent);
      }
      topElem = document.elementFromPoint(clientX, clientY);
    }

    let caretInfo = this.#getCaretInfoFromPoint(clientX, clientY);

    // restore the pointerEvents for the elements that were temporarily disabled.
    topElems.forEach((elem) => {
      elem.style.pointerEvents = "";
    });

    return caretInfo ? { offsetNode: caretInfo.offsetNode, offset: caretInfo.offset } : { offsetNode: null, offset: null };
  }

  #getCaretInfoFromPoint(x, y) {
    if (document.caretPositionFromPoint) {
      const caretPosition = document.caretPositionFromPoint(x, y);
      if (caretPosition) {
        return {
          offsetNode: caretPosition.offsetNode,
          offset: caretPosition.offset,
        };
      }
    } else if (document.caretRangeFromPoint) {
      // Safari support
      const range = document.caretRangeFromPoint(x, y);
      if (range) {
        return {
          offsetNode: range.startContainer,
          offset: range.startOffset,
        };
      }
    }
    return null;
  }

  getScrollPosition(bookItem = undefined) {
    if (bookItem) {
      const itemRect = bookItem.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      return {
        x: Math.round(itemRect.left - containerRect.left + this.container.scrollLeft),
        y: Math.round(itemRect.top - containerRect.top + this.container.scrollTop),
      };
    }
    return {
      x: this.bookConfig.pagingMethod === "vertical" ? Math.round(this.container.scrollLeft) : Math.round(this.container.scrollLeft + this.bookConfig.leftMargin), // Add this.bookConfig.leftMargin to correct the normal hyperlink anchor scroll position.
      y: Math.round(this.container.scrollTop),
    };
  }

  set currentPage(pageNum) {
    const prevPage = this.#currentPage;
    const scrollPos = this.bookConfig.pagingMethod === "vertical" ? "scrollTop" : "scrollLeft";
    if (pageNum === this.#currentPage && Math.round(this.container[scrollPos]) % this.pageLength < 1) return; // IMPORTANT! Prevent infinite scroll loop
    if (pageNum >= 1 && pageNum < this.totalPages) {
      this.#isEndOfPage = false;
      if (pageNum === this.#currentPage + 1) {
        console.log("Go to next Page. From page: " + this.#currentPage + " to page: " + pageNum);
      } else if (pageNum === this.#currentPage - 1) {
        console.log("Go to previous Page. From page: " + this.#currentPage + " to page: " + pageNum);
      } else {
        console.log("Jump to page:" + pageNum + " , from page: " + this.currentPage);
      }
      this.#currentPage = pageNum;
    } else if (pageNum >= this.totalPages) {
      this.#currentPage = this.totalPages;
      this.#isEndOfPage = true;
      console.log("You are already at the end of this book.");
    } else {
      this.#currentPage = 1;
      this.#isEndOfPage = false;
      console.log("You are already at the beginning of this book.");
    }

    this.container[scrollPos] = this.pageLength * (this.#currentPage - 1);

    if (this.bookConfig.pagingMethod === "column") {
      // Shift book's layout component to the destination page for column mode because the overflow direction is perpendicular to the normal layout flow.
      $(this.container)
        .find("> *")
        .not($(this.contents))
        .not(".draw")
        .each((index, elem) => {
          const position = $(elem).css("position");
          if (["static", "relative"].includes(position)) {
            this.bookEditor.changeStyle(elem, {
              position: "relative",
              left: this.pageLength * (this.#currentPage - 1) + "px",
            });
          } else if (position === "absolute") {
            if (!elem.originalLeft) {
              elem.originalLeft = parseFloat($(elem).css("left"));
            }
            this.bookEditor.changeStyle(elem, {
              left: elem.originalLeft + this.pageLength * (this.#currentPage - 1) + "px",
              width: elem.clientWidth + 30 + "px",
            });
          }
        });

      // Correct the scrollTop position for anchor link jumpping.
      this.container.scrollTop = 0;
    }
    this.pageStarter = this.getPageStarter();
    sessionStorage.setItem("pageNumBook" + this.instanceID, this.#currentPage.toString());
    $("#pageNumDiv_" + this.instanceID).text(this.currentPage + "/" + this.totalPages);
    let direction;
    if (pageNum - prevPage === 1) direction = "next";
    else if (pageNum - prevPage === -1) direction = "prev";
    else direction = "jump";

    this.#executeBookEvent("pagechange", { book: this, startPageNum: prevPage, endPageNum: this.#currentPage, direction });
  }

  enterEinkMode() {
    this.mode = "eink";

    if (!sessionStorage.getItem("pageNumBook" + this.instanceID)) {
      // Find the bookItem located at the current scroll position.
      this.#anchor = this.#findAnchor();
    }
    if (this.isFullScreen && document.documentElement.scrollTop !== 0) Book.#preventVolumnKeyEvent = true; // Prevent the setupPages process to trigger the volume key event (documentElement's scrollHeight will change due to page setup process.)
    this.setupEinkStyle();
    this.#setupPages();
    this.setupListeners();

    this.container.classList.add("disable-default-touch");

    if (this.isVisible) this.#jumpToAnchor(this.#anchor);
    this.#executeBookEvent("entereink");
    console.log(`Book ${this.instanceID} has entered Eink mode.`);
    this.#einkModeStartTime = performance.now();
  }

  #jumpToAnchor(anchor) {
    let targetPage;
    if (anchor === null) {
      targetPage = Number(sessionStorage.getItem("pageNumBook" + this.instanceID));
      console.log("Jumping to saved session storage page: " + targetPage);
      this.currentPage = targetPage;
    } else {
      targetPage = this.getPageNumByItem(anchor);
      console.log("Jumping to anchor element on page: " + targetPage);
      this.currentPage = targetPage;
    }
  }

  quickPreview(startPage, endPage, fontSizeChange) {
    const savedPage = this.currentPage;
    this.currentPage = startPage;
    const pageStarter = this.getPageStarter(0);
    this.currentPage = endPage;
    const pageEnder = this.getPageEnder(this.pageWidth);

    let head, tail;
    if (startPage > 1) {
      const lineHeight = parseFloat($(this.contents).css("line-height")) ? parseFloat($(this.contents).css("line-height")) : 12;
      this.currentPage = startPage - 1;
      head = this.getPageEnder(0, lineHeight * 3);
    } else head = pageStarter;
    if (endPage < this.totalPages) {
      this.currentPage = endPage + 1;
      tail = this.getPageStarter(0);
    } else tail = pageEnder;

    // Restore the original page position.
    this.currentPage = savedPage;

    const range = Book.rangeTool.createRange(pageStarter.starter, pageEnder.starter, pageStarter.offset, pageEnder.offset);
    const previewSection = document.createElement("div");
    previewSection.className = "previewSection";
    previewSection.appendChild(range.cloneContents());

    this.container.append(previewSection);
    let book;
    if (this.isFullScreen) {
      book = new Book(previewSection, { useNotes: false, useContentTable: false });
    } else {
      $(previewSection).css({
        width: this.contents.clientWidth + "px",
        height: this.contents.clientHeight + "px",
      });
      book = new Book(previewSection, {
        useNotes: false,
        leftMargin: 0,
        rightMargin: 0,
        upperMargin: 0,
        lowerMargin: 0,
        fullScreen: false,
        contentTableConfig: { useContentTable: false },
      });
    }
    const newFontSize = parseFloat($(this.contents).css("font-size"));

    $(book.contents).css("font-size", newFontSize + "px"); // Match the font size to the original content.
    Book.einkBroFontSizeAdjustment(book.contents, newFontSize);
    book.changeFontSizeBy(fontSizeChange);
    book.enterEinkMode();
    book.previewRange = range;
    book.previewRange.head = head;
    book.previewRange.tail = tail;

    $("#pageNumDiv_" + book.instanceID).text(book.currentPage + (startPage - 1) + "/" + this.totalPages);
    book.addEventListener("pagechange", () => {
      sessionStorage.setItem("pageNumBook" + book.instanceID, ""); // Do not store the last location of preview book, let it always starts from page 1.
      $("#pageNumDiv_" + book.instanceID).text(book.currentPage + (startPage - 1) + "/" + this.totalPages);
    });

    if (!book.isFullScreen) {
      const { top, left } = this.contents.getBoundingClientRect();
      $(book.container).css({
        position: "fixed",
        left: left + "px",
        top: top + "px",
      });
    }

    book.onbookreset = () => {
      if (!book.isFullScreen) {
        const { top, left } = this.contents.getBoundingClientRect();
        $(book.container).css({
          position: "fixed",
          left: left + "px",
          top: top + "px",
        });
      }
      $("#pageNumDiv_" + book.instanceID).text(book.currentPage + (startPage - 1) + "/" + this.totalPages);
    };
    this.preview = book;
    return book;
  }

  #findAnchor() {
    console.log("Finding an anchor bookItem to jump to.");
    let targetElement = null;
    const viewPortBound = this.container.getBoundingClientRect().top >= 0 ? this.container.getBoundingClientRect().top : 0;

    $(this.contents)
      .find("*")
      .each((index, bookItem) => {
        if (!this.isValidNode(bookItem)) return true;
        const itemTop = bookItem.getBoundingClientRect().top;
        if (itemTop >= viewPortBound && itemTop < Infinity) {
          targetElement = bookItem;
          return false;
        }
      });
    if (targetElement) console.log("Found an anchor element: " + targetElement.nodeName + ": " + targetElement.textContent.slice(0, 10));
    return targetElement;
  }

  setupEinkStyle(cssText = "", memorize = true) {
    if (memorize) this.bookConfig.einkStyle += cssText;
    let style = document.getElementById("einkStyle_book" + this.instanceID);

    if (!style) {
      style = document.createElement("style");
      style.id = "einkStyle_book" + this.instanceID;
      document.head.appendChild(style);
    }
    const defaultStyle = `
     .pageNumDiv {
      z-Index: 30;
      font-size: 10px;
      line-height: 1.5;
      color: dimgray;
      margin: 0px;
      display: block;
     }

      @media print {
        .pageNumDiv {
          display: none;
        }
      }

      .no-select {
        -webkit-user-select: none;  /* Safari */
          -moz-user-select: none;  /* Firefox */
            -ms-user-select: none;  /* Internet Explorer/Edge */
                user-select: none;  /* Non-prefixed version, currently supported by Chrome, Opera and Firefox */
      }

      .disable-default-touch {
        touch-action: none;
      }
    `;
    style.textContent = this.bookConfig.einkStyle + defaultStyle + (memorize ? "" : cssText);
  }

  setupListeners() {
    // Set up all the necessary listeners for this book
    console.log("Setting up listeners for book: " + this.instanceID);
    this.#setupMutationObserver();

    // Set up resize observers
    $(window).on("resize.book" + this.instanceID, () => {
      if (this.mode === "eink") {
        // Keep the container's size for a while to prevent column exposure.
        this.#resizeCount++;
        this.#isWindowResizeEvent = true;
        if (this.isVisible) {
          this.ignoreMutation = true;
          $(this.container).css("width", this.containerWidth + "px");
          $(this.container).css("height", this.containerHeight + "px");
        }
        Book.#preventVolumnKeyEvent = true;
        this.#handleResizeOrVisibility();
      }
    });

    this.#setupResizeObserver();

    this.addEventListener("click", this.#handleClick);
    this.addEventListener("scroll", this.#handleScroll);
    this.addEventListener("touchstart", this.#handleTouchStart);
    this.addEventListener("touchend touchcancel", this.#handleTouchEnd);

    if ("ontouchstart" in window && !this.inIOSBrowser) {
      // This is for detecting the setFontSize feature of EinkBro, and reset the pages when the user make font size changes via EinkBro.
      this.#fontSizeCheckInterval = window.setInterval(() => {
        if (this.scrollLengthChanged) {
          this.resetPages();
        }
      }, 1500);
    }

    console.log("Listeners set up complete.");
  }

  static setupGlobalListeners() {
    $(window).on("keydown.book", Book.#handleKeyDown);

    document.onselectionchange = () => {
      Book.textSelection = window.getSelection().toString();
    };
    // Support the volume key page flipping feature of EinkBro.
    document.documentElement.scrollTop = Book.#scrollBufferLength / 2;
    $(window).on("scroll.book", Book.#handleVolumeKeyPageFlip);
  }

  #handleClick(evt) {
    const targetBook = evt.target.closest(".book").book;
    if (targetBook === this && !this.isFocused) {
      this.getFocus();
      evt.stopPropagation();
    }
    const hyperlinkClicked = evt.target.closest("a[href]");
    const bookUI = evt.target.closest(".bookUI");

    if (targetBook === this) {
      if (hyperlinkClicked && !bookUI) {
        // Default behavior
        if (evt.target.href?.includes("#")) {
          const targetId = evt.target.href.slice(evt.target.href.indexOf("#"));
          if (this.bookConfig.pagingMethod === "column") {
            evt.preventDefault();
            this.currentPage = this.getPageNumByItem($(targetId)[0]);
            this.hint(targetId);
          }
        } else {
          evt.preventDefault(); // Disable the default behavior of the hyperlink to open the hyperlink in a new tab to improve user experience. (Users may accidentally open a new tab when they're actually trying to flip pages.)
          if (targetBook === this) this.#flipPage(evt);
        }
      } else {
        if (!(bookUI && this.container.contains(bookUI))) this.#flipPage(evt);
      }
    }
  }

  hint(target) {
    // target can be css selector, element node, textnode or a range.
    this.ignoreMutation = 2;
    this.preventFlip = true;

    if (typeof target === "string") {
      target = $(target)[0];
    } else if (typeof target === "object") {
      if ("starter" in target) {
        target = target.starter.nodeType === Node.TEXT_NODE ? Book.rangeTool.createRange(target.starter, target.starter, target.offset, target.starter.length) : target.starter;
      } else if (target.nodeType === Node.TEXT_NODE) {
        target = Book.nodeTool.createRange(target, target, 0, target.textContent.length);
      }
    }

    const hintObject = document.createElement("SPAN");
    let initColor;
    hintObject.style.backgroundColor = "yellow";

    if (target.nodeType === Node.ELEMENT_NODE) {
      initColor = $(target).css("background-color");
      $(target).css("background-color", "yellow");
    } else {
      // target is a Range Object
      target.surroundContents(hintObject);
    }

    // Create message box
    const messageBox = document.createElement("DIV");
    messageBox.textContent = this.lang === "zh-TW" ? "繼續閱讀" : "continue reading";
    messageBox.id = "hintMessage";
    messageBox.style.cssText = `
      position: fixed;
      background-color: rgba(0, 0, 255);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 9999;
    `;

    // Create arrow
    const arrow = document.createElement("DIV");
    arrow.style.cssText = `
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      position: absolute;
    `;

    // Position the message box and arrow
    const targetRect = (target.nodeType === Node.ELEMENT_NODE ? target : hintObject).getClientRects()[0];
    if (!targetRect) return; // TargetRect may be undefined if it's not visible.

    const spaceAbove = targetRect.top;
    const spaceBelow = window.innerHeight - targetRect.bottom;

    if (spaceAbove >= 40) {
      messageBox.style.bottom = `${window.innerHeight - targetRect.top + 10}px`;
      messageBox.style.left = `${targetRect.left}px`;
      arrow.style.borderTop = "8px solid rgba(0, 0, 255)";
      arrow.style.bottom = "-8px";
      arrow.style.left = "10px";
    } else if (spaceBelow >= this.bookConfig.lowerMargin + 40) {
      messageBox.style.top = `${targetRect.bottom + 10}px`;
      messageBox.style.left = `${targetRect.left}px`;
      arrow.style.borderBottom = "8px solid rgba(0, 0, 255)";
      arrow.style.top = "-8px";
      arrow.style.left = "10px";
    } else {
      // If there's not enough space above or below, place it to the side
      if (targetRect.left > window.innerWidth / 2) {
        messageBox.style.right = `${window.innerWidth - targetRect.left + 10}px`;
        messageBox.style.top = `${targetRect.top}px`;
        arrow.style.borderRight = "8px solid rgba(0, 0, 255)";
        arrow.style.left = "-8px";
        arrow.style.top = "5px";
      } else {
        messageBox.style.left = `${targetRect.right + 10}px`;
        messageBox.style.top = `${targetRect.top}px`;
        arrow.style.borderLeft = "8px solid rgba(0, 0, 255)";
        arrow.style.right = "-8px";
        arrow.style.top = "5px";
      }
    }

    // Add arrow to message box
    messageBox.appendChild(arrow);

    // Add message box to the document
    document.documentElement.appendChild(messageBox);

    $("greenmark, bluemark, redmark").css("background-color", "transparent");

    const removeHint = () => {
      $("greenmark, bluemark, redmark").css("background-color", "");
      if ("collapsed" in target) {
        const parent = hintObject.parentElement;
        if (parent) {
          hintObject.outerHTML = hintObject.innerHTML;
          parent.normalize();
        }
      } else $(target).css("background-color", initColor);

      // Remove the message box
      if (messageBox) messageBox.remove();
    };
    const hintTimeout = window.setTimeout(() => {
      removeHint();
      this.preventFlip = false;
    }, 3000);
    const t0 = performance.now();

    $(window).on("click.hint", () => {
      const t1 = performance.now();
      if (t1 - t0 > 1000) {
        clearTimeout(hintTimeout);
        removeHint();
        this.preventFlip = false;
        $(window).off("click.hint");
      }
    });
  }

  #handleScroll(evt) {
    // this.container.scrollTop = 0; // Correct the scrollTop position which is automatically set by the browser when anchor link is clicked.
    const currentScrollPos = this.bookConfig.pagingMethod === "vertical" ? this.getScrollPosition().y : this.getScrollPosition().x;
    const pageLength = this.pageLength;
    const tolerance = 3;
    let adjustedScrollPos = currentScrollPos;

    // *** the following code is to solve the floating point error issue in EinkBro and make the volume buttons work to flip pages in vertical paging mode.
    if (currentScrollPos % pageLength < tolerance) {
      adjustedScrollPos = currentScrollPos - (currentScrollPos % pageLength);
    } else if (currentScrollPos % pageLength > pageLength - tolerance) {
      adjustedScrollPos = currentScrollPos - (currentScrollPos % pageLength) + pageLength;
    }

    if (evt.timeStamp < 3000) {
      // If the scroll event happened less than 3 seconds after document loaded, it is the auto scrollTo event triggered by the browser, then adjust the current page number to the one stored in sessionStorage.
      this.currentPage = parseInt(sessionStorage.getItem("pageNumBook" + this.instanceID));
    } else if (this.#correctScroll === true) {
      console.log("Jump back to the location of the anchor.");
      this.#jumpToAnchor(this.#anchor);
      this.#correctScroll = false;
    } else {
      /* #isEndOfPage flag is used to prevent unwanted correction to the previous page of the end page becuase the scrollHeight or scrollLeft is not an integer multiple of pageWidth/ height. (Browsers don't permit to set the scrollLeft/scrollTop to values greater than scrollHeight/scrollwidth - clientHeight/clientWidth) */
      if (this.#isEndOfPage !== true) {
        this.currentPage = this.getPageNumByScrollPos(adjustedScrollPos);
        if (this.currentPage === 1) this.#executeBookEvent("bookstart");
      } else {
        this.#isEndOfPage = false; // The unwanted correction to the previous page of the end page has been resolved, so reset the #isEndOfPage flag.
        this.#executeBookEvent("bookend");
      }
    }
  }

  item(jquerySelector = "") {
    // return a jQuery object containing all the elements matching the given jQuery selector within the book.
    return $(this.contents)
      .find(jquerySelector)
      .filter((index, elem) => {
        return elem.closest(".book").book === this && this.isValidNode(elem);
      });
  }

  #setupPages(reset = false) {
    const t1 = performance.now();
    // Make sure all images and videos and iframes do implement responsive web design (RWD).
    if (!this.#rwdEnforced)
      $(this.contents).find("img").css({
        "max-width": "100%",
        height: "auto",
        "object-fit": "contain",
      });

    if (this.isVisible === false) {
      this.#resetWhenVisible = true;
      console.log(`Book ${this.instanceID} is currently not visible. Pages will be setup when it becomes visible.`);
      return;
    }
    if (!reset) console.log(`----------------------Setting pages for book ${this.instanceID}...----------------------`);

    $(this.contents).find("br").remove();

    if (this.bookConfig.pagingMethod === "vertical") {
      this.pageWidth = this.contents.clientWidth;
      this.pageHeight = this.container.clientHeight;
      this.pageLength = this.container.clientHeight;

      // this._repositionContents();
      $("#manual").css("pointer-events", "none");
      this.container.scrollTop = 0;
      while (Math.abs(this.container.scrollTop - (this.container.scrollHeight - this.pageHeight)) > 3) {
        if (this.#pageEndReached) break;
        this.#repositionBookContents();
        this.container.scrollTop += this.pageHeight;
      }
      this.#pageEndReached = false;
      this.container.scrollTop = 0; // reset scroll position to the top.
      $("#manual").css("pointer-events", "auto");
      this.pageStarters = [this.#createPageStarter(this.contents)];
    } else if (this.bookConfig.pagingMethod === "column") {
      this.#columnPagingContents();
    }

    // this.container.nodeName === "HTML" ? (this.container.style.overflow = "scroll") : (this.container.style.overflow = "hidden");
    // this.contents.querySelectorAll("a").forEach((link) => {
    //   link.ignoreReposition = undefined;
    //   if (!link.href.includes("#")) {
    //     link.onclick = (evt) => {
    //       evt.preventDefault();
    //       this.flipPage(evt);
    //     };
    //   }
    // });
    this.#currentPage = 1; // reset the #currentPage position in order to jump back to the pageStarters.
    this.handleBookEnd();
    this.#addPageNum();
    this.#oldScrollLength = this.bookConfig.pagingMethod === "vertical" ? this.container.scrollHeight : this.container.scrollWidth;

    const t2 = performance.now();
    console.log(`Book ${this.instanceID} pages setup time: ${(t2 - t1).toFixed(2)} ms`);
    if (t2 - t1 > 150) this.isLarge = true;

    if (!reset) console.log(`--------------------Book ${this.instanceID} Pages setup complete!----------------------`);
  }

  changeFontSizeBy(amount) {
    const root = this.contents;
    const currentFontSize = parseFloat(getComputedStyle(root).fontSize);
    const newFontSize = currentFontSize + amount;
    console.log(`Adjusting font size by ${amount} to ${newFontSize}px...`);

    // Only perform detailed adjustments for child elements if it hasn't been done before
    if (!root.hasAttribute("data-font-adjusted")) {
      $(root)
        .find("*")
        .each(function () {
          const $this = $(this);
          const elementFontSize = Math.round((parseFloat($this.css("font-size")) / parseFloat($this.parent().css("font-size"))) * 100) / 100;

          $this.css({
            "font-size": `${elementFontSize}em`,
          });
        });

      // Mark that the detailed adjustments have been made
      root.setAttribute("data-font-adjusted", "true");
    }

    // Set root element's CSS Properties
    $(root).css("font-size", `${newFontSize}px`);
    Book.einkBroFontSizeAdjustment(root, newFontSize);

    if (newFontSize === this.originalFontSize) {
      $(root).css("line-height", this.#originalLineHeight + "px");
      Book.einkBroLineHeightAdjustment(root, this.#originalLineHeight);
    } else $(root).css("line-height", "1.5");
  }

  static einkBroFontSizeAdjustment(elem, fontSize) {
    // Correction for EinkBro's font size adjustment
    if ($(elem).css("font-size") !== fontSize + "px") {
      const einkBroResizingFactor = parseFloat($(elem).css("font-size")) / fontSize;
      $(elem).css("font-size", `${fontSize / einkBroResizingFactor}px`);
    }
  }

  static einkBroLineHeightAdjustment(elem, lineHeight) {
    // Correction for EinkBro's font size adjustment
    if ($(elem).css("line-height") !== lineHeight + "px") {
      const einkBroResizingFactor = parseFloat($(elem).css("line-height")) / lineHeight;
      $(elem).css("line-height", `${lineHeight / einkBroResizingFactor}px`);
    }
  }

  #columnPagingContents() {
    // Record bookItem's original height in scroll mode for column-paging algorithm.
    console.log("Column-paging book contents...");
    this.bookItem.each(function () {
      const media = this.querySelector("img") || this.querySelector("iframe");
      this.media = media;
      this.originalHeight = this.clientHeight;
      if (media) media.originalHeight = media.clientHeight;
    });

    const onlyVisibleElemIsContent =
      $(this.container)
        .find(" > *:visible")
        .filter(function () {
          return $(this).css("position") === "static" || $(this).css("position") === "relative"; // Relatively positioned elements still occupy space in normal flow. Elements that are out of flow will not be counted.
        }).length === 1;

    // Handle margin collapse
    const { topMargin, bottomMargin } = this.#handleMarginCollapse(this.contents);

    if (this.bookConfig.fullScreen) {
      const { vw, vh } = this.#getViewportDimensionInPixel();
      /* Don't use this.containerWidth and this.containerHeight here because the mutation observer may trgger page reset BEFORE the resizeObserver detects changes. */
      this.bookEditor.changeStyle(document.documentElement, {
        margin: "0px",
        border: "0px",
        padding: "0px",
        backgroundColor: "white",
        height: window.innerHeight + Book.#scrollBufferLength + "px",
        overflow: "scroll",
        scrollbarWidth: "none",
      });

      this.bookEditor.changeStyle(
        this.container,
        {
          position: "fixed",
          top: "0px",
          left: "0px",
          margin: "0px",
          wordBreak: "break-word",
          wordWrap: "break-word",
          paddingTop: `${this.bookConfig.upperMargin}px`,
          paddingBottom: `${this.bookConfig.lowerMargin}px`,
          paddingLeft: `${this.bookConfig.leftMargin}px`,
          paddingRight: `${this.bookConfig.rightMargin}px`,
          zIndex: this.bookConfig.zIndex + (1000 + this.instanceID),
          backgroundColor: "white",
          boxSizing: "border-box",
          overflow: "hidden",
        },
        false
      );

      // ****!!! IMPORTANT!!! the height and width of the container should be changed AFTER the position:Fixed is set so the correct window size can be fetched. (Seems like a bug in browser)****
      this.bookEditor.changeStyle(
        this.container,
        {
          height: (window.innerHeight / vh) * 100 + "vh",
          width: (window.innerWidth / vw) * 100 + "vw",
        },
        false
      );

      this.bookEditor.changeStyle(
        this.contents,
        {
          display: "block",
          height: this.contents.clientHeight + "px",
          width: this.contents.clientWidth + "px",
          "column-width": this.contents.clientWidth + "px",
          "column-fit": "auto",
          "column-gap": this.#columnGap + "px",
          marginLeft: "0px",
          marginRight: "0px",
          marginTop: onlyVisibleElemIsContent ? "0px" : topMargin + "px",
          marginBottom: onlyVisibleElemIsContent ? "0px" : bottomMargin + "px",
          padding: "0px",
          border: "0px",
          "background-color": "rgba(256 ,256 , 256, 0)",
        },
        false
      );
    } else {
      // use vh instead of pixels to make resizeObserver work.
      const { vw, vh } = this.#getViewportDimensionInPixel();
      /* Don't use this.containerWidth and this.containerHeight here because the mutation observer may trgger page reset BEFORE the resizeObserver detects changes. */

      this.bookEditor.changeStyle(document.documentElement, {
        margin: "0px",
        border: "0px",
        padding: "0px",
        backgroundColor: "white",
        height: window.innerHeight + Book.#scrollBufferLength + "px",
        overflow: "scroll",
        scrollbarWidth: "none",
      });

      this.bookEditor.changeStyle(
        this.container,
        {
          position: $(this.container).css("position") === "static" ? "relative" : $(this.container).css("position"), // This is for precise positioning of CANVAS.
          wordBreak: "break-word",
          wordWrap: "break-word",
          paddingTop: `${this.bookConfig.upperMargin}px`,
          paddingBottom: `${this.bookConfig.lowerMargin}px`,
          paddingLeft: `${this.bookConfig.leftMargin}px`,
          paddingRight: `${this.bookConfig.rightMargin}px`,
          zIndex: this.bookConfig.zIndex + (1000 + this.instanceID),
          "background-color": "white",
          "box-sizing": "border-box",
          overflow: "hidden",
        },
        false
      );

      // ****!!! IMPORTANT!!! the height and width of the container should be changed AFTER the position:Fixed is set so the correct window size can be fetched. (Seems like a bug in browser)****
      const adjustedHeight = this.container.clientHeight > window.innerHeight ? (window.innerHeight / vh) * 100 + "vh" : (this.container.clientHeight / vh) * 100 + "vh";
      const adjustedWidth = this.container.clientWidth > window.innerWidth ? (window.innerWidth / vw) * 100 + "vw" : (this.container.clientWidth / vw) * 100 + "vw";

      this.bookEditor.changeStyle(
        this.container,
        {
          height: adjustedHeight,
          width: adjustedWidth,
        },
        false
      );

      this.bookEditor.changeStyle(
        this.contents,
        {
          display: "block",
          height: this.contents.clientHeight + 1 + "px", // + 1 because the clientHeight is rounded down by default, but line-height doen'ts.
          width: this.contents.clientWidth + "px",
          "column-width": this.contents.clientWidth + "px",
          "column-fit": "auto",
          "column-gap": `${this.#columnGap}px`,
          marginTop: onlyVisibleElemIsContent ? "0px" : topMargin + "px",
          marginBottom: onlyVisibleElemIsContent ? "0px" : bottomMargin + "px",
          marginLeft: "0px",
          marginRight: "0px",
          padding: "0px",
          border: "0px",
          "background-color": "rgba(256 ,256 , 256, 0)",
        },
        false
      );
    }

    let firstChild = this.contents.firstElementChild;
    while (firstChild) {
      this.bookEditor.changeStyle(firstChild, {
        "margin-top": "0px",
      });
      firstChild = firstChild.firstElementChild;
    }

    this.#handleCrossPageBookItem();

    // Reset bookItem's original height
    this.bookItem.each((index, element) => {
      element.originalHeight = undefined;
      if (element.media) element.media.originalHeight = undefined;
    });

    this.pageWidth = this.contents.clientWidth;
    this.pageHeight = this.contents.clientHeight;
    this.pageLength = this.contents.clientWidth + this.#columnGap;
    console.log("Column-paging book contents completed!");
  }

  #handleMarginCollapse(elem) {
    const computedStyle = window.getComputedStyle(elem);

    // Function to get the maximum margin of a child and its descendants
    const getMaxMargin = (element, type, property) => {
      let max = parseFloat(window.getComputedStyle(element)[property]);
      let child = element[type];
      while (child) {
        max = Math.max(max, getMaxMargin(child, type, property));
        child = child[type];
      }
      return max;
    };

    // Handle margin-top
    const topMargin = Math.max(parseFloat(computedStyle.marginTop), getMaxMargin(elem, "firstElementChild", "marginTop"));

    // Handle margin-bottom
    const bottomMargin = Math.max(parseFloat(computedStyle.marginBottom), getMaxMargin(elem, "lastElementChild", "marginBottom"));
    return { topMargin, bottomMargin };
  }

  #getViewportDimensionInPixel() {
    const testDiv = document.createElement("div");
    testDiv.style.height = "100vh";
    testDiv.style.width = "100vw";
    testDiv.id = "testDimensionDiv";
    this.container.appendChild(testDiv);
    const dimension = { vw: testDiv.clientWidth, vh: testDiv.clientHeight };
    testDiv.remove();
    return dimension;
  }

  #handleCrossPageBookItem() {
    const bookItems = Array.from(this.bookItem);
    this.bookItem.css("break-inside", "avoid");

    bookItems.forEach((item) => {
      if (item.getClientRects().length > 1) {
        let lastDOMRect = item.getClientRects()[0];
        const spaceLeftOnThePage = Math.round(this.contents.getBoundingClientRect().bottom - lastDOMRect.top);
        const aBlankPage = this.contents.clientHeight;
        const media = item.media;
        const extraSpaceNeeded = item.originalHeight - Math.min(media?.clientHeight, media?.originalHeight) ?? 0;
        const minSpaceRequired = this.bookConfig.minImgHeight + extraSpaceNeeded;
        const errorTolerence = 3; // Allow for 3px of error.

        if (spaceLeftOnThePage >= minSpaceRequired || Math.abs(spaceLeftOnThePage - aBlankPage) <= errorTolerence) {
          this.bookEditor.changeStyle(
            media,
            {
              height: spaceLeftOnThePage - extraSpaceNeeded - errorTolerence + "px",
              width: "auto",
            },
            false
          );

          console.log("Image caption table resized.");
        } else {
          // Automatically shift to the next page by CSS's built-in column paging algorithm.
          if (item.originalHeight > aBlankPage) {
            this.bookEditor.changeStyle(
              media,
              {
                height: aBlankPage - extraSpaceNeeded - errorTolerence + "px",
                width: "auto",
              },
              false
            );
          } else {
            // Maintain the original height of the media.
            this.bookEditor.changeStyle(
              media,
              {
                height: media.originalHeight + "px",
                width: "auto",
              },
              false
            );
          }
        }

        // If resized, make padding and margin top inside items 0.
        let parentElm = media.parentElement;
        while (parentElm && parentElm !== item) {
          this.bookEditor.changeStyle(
            parentElm,
            {
              marginTop: "0px",
              paddingTop: "0px",
            },
            false
          );
          parentElm = parentElm.parentElement;
        }
      }
    });
  }

  #addPageNum() {
    let pageNumDiv = document.getElementById("pageNumDiv_" + this.instanceID);
    if (!pageNumDiv) {
      pageNumDiv = document.createElement("div");
      pageNumDiv.classList.add("pageNumDiv");
      pageNumDiv.id = "pageNumDiv_" + this.instanceID;
      if (this.isFullScreen) pageNumDiv.classList.add("fullScreen");
      this.container.append(pageNumDiv);

      if (this.isFullScreen) {
        this.bookEditor.changeStyle(
          pageNumDiv,
          {
            position: "fixed",
            right: "10px",
            bottom: "10px",
          },
          true
        );
      } else {
        this.bookEditor.changeStyle(
          pageNumDiv,
          {
            position: "relative",
            float: "right",
            clear: "both",
            bottom: "10px",
          },
          true
        );
      }
    }
    pageNumDiv.textContent = this.currentPage + "/" + this.totalPages;
    console.log("Page number added.");
  }

  enterPrintMode() {
    console.log("Entering printing mode of Book instance " + this.instanceID) + "...";
    this.mode = "print";
    if (this.isVisible && this.isFullScreen) {
      this.removeEventListener(); // Disable mutation, resize observers.
      const tempStore = this.#eventHandlers; //Temporarily remove the book event handlers in order to show all the canvas without being hidden by pagechange.
      this.#eventHandlers = [];
      this.#processPageBreak();
      this.container.classList.remove("disable-default-touch");

      // Store the original position
      this.#originalParent = this.container.parentNode;
      this.#originalNextSibling = this.container.nextSibling;

      // Move the book container to the end of the document
      document.documentElement.appendChild(this.container);

      // Hide all other children of documentElement
      Array.from(document.documentElement.children).forEach((child) => {
        if (child !== this.container) {
          child.initState = $(child).css("display");
          child.style.display = "none";
        }
      });

      $("HTML").css({
        height: "",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
        overflow: "auto",
      });
      $(this.container).css({
        height: "",
        position: "",
        border: "1px solid black",
      });
      $(this.contents).css({
        columnWidth: "",
        height: "",
      });
      $("#pageNumDiv_" + this.instanceID).hide();
      this.#eventHandlers = tempStore;
      this.#printAccessed = true;
      console.log("Printing mode entered.");
    } else {
      // alert("Book + " + this.instanceID + "can't be printed.");
    }
  }

  exitPrintMode() {
    if (this.#printAccessed) {
      console.log("Exiting printing mode of Book instance " + this.instanceID) + "...";
      // Restore the book container to its original position
      if (this.#originalNextSibling) {
        this.#originalParent.insertBefore(this.container, this.#originalNextSibling);
      } else {
        this.#originalParent.appendChild(this.container);
      }

      // Show all other children of documentElement
      Array.from(document.documentElement.children).forEach((child) => {
        if (child !== this.container) $(child).css("display", child.initState);
      });
      $(".eink").hide();

      $(".draw")
        .filter((i, canvas) => {
          return canvas.id.includes(this.#fileString);
        })
        .each((i, canvas) => {
          $(canvas).css({
            position: "absolute",
            left: `${parseInt(canvas.id.slice(canvas.id.indexOf("w") + 1, canvas.id.indexOf("_")) - 1) * this.pageLength}px`,
            top: "0px",
          });
        })
        .appendTo(this.container);

      this.contents.replaceWith(this.#contentBackup);
      this.contents = this.#contentBackup;

      $("HTML").css({
        display: "block",
        alignItems: "",
        justifyContent: "",
        overflow: "scroll",
        height: window.innerHeight + 100 + "px",
      });
      $(this.container).css({
        position: "fixed",
        height: this.#fileString.split("_")[2] + "px",
        border: "",
      });
      $(this.contents).css({
        columnWidth: this.pageWidth + "px",
        height: this.pageHeight + "px",
      });
      $("#pageNumDiv_" + this.instanceID).show();
      this.container.classList.add("disable-default-touch");
      this.setupListeners();

      this.#pageRanges = [];
      this.#fileString = "";
      this.#contentBackup = null;
      this.#printAccessed = false;
      this.currentPage = this.#cachedData;
      this.#cachedData = null;
      this.mode = "eink";
      console.log("Printing mode exited.");
    }
  }

  #repositionBookContents() {
    const { y: originY } = this.container.getBoundingClientRect();
    const upperMargin = originY + this.bookConfig.upperMargin;
    const lowerMargin = originY + this.pageLength - this.bookConfig.lowerMargin;
    const pageEnd = originY + this.pageLength;

    const handleCrossPoint = (yPosition) => {
      const { offsetNode, offset } = this.#getCaretInfoFromPoint(this.bookConfig.leftMargin, yPosition);

      if (!offsetNode) return;
      let targetNode = getTargetNode(offsetNode, offset);

      if (targetNode && this.isValidNode(targetNode)) {
        const pageItem = getPageItem(targetNode);

        if (pageItem) {
          handlePageItem(pageItem, yPosition);
        } else {
          handleGeneralCase(targetNode, yPosition, offset);
        }
      }
    };

    const getTargetNode = (offsetNode, offset) => {
      if (offsetNode.nodeType === Node.TEXT_NODE) return offsetNode;
      if (offsetNode.nodeType === Node.ELEMENT_NODE && !offsetNode.closest(".filler")) {
        return offsetNode.childNodes[offset] ?? offsetNode.childNodes[offset - 1];
      }
      return undefined;
    };

    const getPageItem = (node) => {
      return node.closest ? node.closest(".pageItem") : node.parentElement.closest(".pageItem");
    };

    const handlePageItem = (pageItem, yPosition) => {
      if (yPosition >= lowerMargin) {
        pageItem.onCrossPage ? pageItem.onCrossPage() : this.#handleCrossPageItem(pageItem);
      } else {
        const spaceLeft = Math.round(yPosition - pageItem.getBoundingClientRect().top);
        this.#addFiller(pageItem, spaceLeft + (yPosition === pageEnd - 1 ? this.bookConfig.upperMargin : 0), yPosition);
      }
    };

    const handleGeneralCase = (targetNode, yPosition, offset) => {
      if (targetNode.nodeType === Node.TEXT_NODE) {
        handleTextNode(targetNode, yPosition, offset);
      } else if (targetNode.nodeType === Node.ELEMENT_NODE) {
        handleElementNode(targetNode, yPosition);
      }
    };

    const handleTextNode = (targetNode, yPosition, offset) => {
      // Normalize the parentElement to merge adjacent text nodes for correct paging.
      targetNode.parentElement.normalize();

      // If the targetNode textNode has been merged, find the new targetNode.
      let parent = targetNode.parentElement;
      if (parent === null) {
        let caretInfo = this.#getCaretInfoFromPoint(this.bookConfig.leftMargin, yPosition);
        targetNode = caretInfo.offsetNode;
        offset = caretInfo.offset;
      }
      let range = Book.rangeTool.createRange(targetNode, targetNode, offset, targetNode.length);
      let spaceLeft = Math.round(yPosition - range.getBoundingClientRect().top);
      let filler;

      if (yPosition >= lowerMargin) {
        range.collapse(true);
        filler = this.#addFiller(range, this.bookConfig.upperMargin + this.bookConfig.lowerMargin + spaceLeft, yPosition);
      } else {
        filler = this.#addFiller(targetNode.parentElement, spaceLeft + (yPosition === pageEnd - 1 ? this.bookConfig.upperMargin : 0), yPosition);
      }
      filler && adjustFillerPosition(filler);
    };

    const handleElementNode = (targetNode, yPosition) => {
      if (targetNode.nodeName === "IMG" && yPosition >= lowerMargin) {
        this.#handleCrossPageItem(targetNode);
      } else {
        const spaceLeft = Math.round(yPosition - targetNode.getBoundingClientRect().top);
        this.#addFiller(targetNode, spaceLeft + (yPosition >= lowerMargin ? this.bookConfig.upperMargin + this.bookConfig.lowerMargin : yPosition === pageEnd - 1 ? this.bookConfig.upperMargin : 0), yPosition);
      }
    };

    const adjustFillerPosition = (filler) => {
      // Safari deals the alignment of block elements inside of list-items differently, so we need to tweak the display property to ensure the below code works correctly.
      if (this.inIOSBrowser) {
        filler.style.display = "inline-block";
      }

      let target = filler;
      while (target.parentElement.nodeName === "A" || target.parentElement.getBoundingClientRect().top === filler.getBoundingClientRect().top) {
        target = target.parentElement;
      }
      if (target !== filler) target.insertAdjacentElement("beforebegin", filler);
      if (this.inIOSBrowser) filler.style.display = "block";
    };

    handleCrossPoint(upperMargin);
    handleCrossPoint(lowerMargin);
    handleCrossPoint(pageEnd - 1);
  }

  #handleCrossPageItem(pageItem) {
    const media = ["IMG", "VIDEO", "IFRAME"].includes(pageItem.nodeName) ? pageItem : pageItem.querySelector("img") || pageItem.querySelector("video") || pageItem.querySelector("iframe");
    const spaceLeft = Math.round(this.pageLength - this.bookConfig.lowerMargin - pageItem.getBoundingClientRect().top);
    const aBlankPage = this.pageLength - (this.bookConfig.upperMargin + this.bookConfig.lowerMargin);
    const extraSpaceNeeded = pageItem.clientHeight - media.clientHeight;
    const minSpaceRequired = this.bookConfig.minImgHeight + extraSpaceNeeded;
    const errorTolerence = 3; // Allow for 3px of error.

    if (spaceLeft >= minSpaceRequired || Math.abs(spaceLeft - aBlankPage) <= 3) {
      this.bookEditor.changeStyle(
        media,
        {
          height: spaceLeft - extraSpaceNeeded - errorTolerence + "px",
          width: "auto",
        },
        false
      );
      this.bookEditor.changeStyle(
        pageItem,
        {
          "margin-Bottom": this.bookConfig.upperMargin + this.bookConfig.lowerMargin + "px",
        },
        false
      );
      console.log("Page item resized.");
    } else {
      // Shift the pageItem to the next page.
      this.#addFiller(pageItem, spaceLeft + this.bookConfig.upperMargin + this.bookConfig.lowerMargin, this.pageHeight - this.bookConfig.lowerMargin);
    }
  }

  /**
   * Adds a filler element to the DOM to adjust spacing in the book layout.
   *
   * @param {Node|Range} elem - The element or range to insert the filler before, after, or around.
   * @param {number} height - The height of the filler element in pixels.
   * @returns {HTMLElement|null} The created filler element, or null if the height is 0 or negative.
   */
  #addFiller(elem, height, detectPoint) {
    if (height <= 0) return null;
    const filler = document.createElement("div");
    this.fillers.push(filler);
    filler.classList.add("filler_" + detectPoint);
    filler.id = "filler_" + this.fillers.length;
    filler.style.marginTop = "0px";
    filler.style.marginBottom = "0px";
    filler.style.height = height + "px";
    // filler.style.backgroundColor = "lightgray";

    // Insert the filler to the DOM.
    if ("startContainer" in elem) {
      elem.surroundContents(filler);
    } else {
      elem.insertAdjacentElement("beforebegin", filler);
      do {
        this.bookEditor.changeStyle(elem, {
          "margin-top": "0px",
        });
        elem = elem.firstElementChild;
      } while (elem);
    }
    if (filler.previousSibling?.classList?.contains("filler_" + detectPoint)) {
      this.#pageEndReached = true;
      filler.previousSibling.remove();
      filler.remove();
    }
    return filler;
  }

  handleBookEnd() {
    if (this.bookConfig.pagingMethod === "vertical") {
      if (this.container.scrollHeight < this.edittingPageEnd + this.bookConfig.lowerMargin) {
        const spaceLeftAtTheEnd = this.edittingPageEnd + this.bookConfig.lowerMargin - this.container.scrollHeight;
        this.bookEditor.addFiller(this.contents, spaceLeftAtTheEnd, "ending_filler", "beforeend");
        this.totalPages = Math.ceil(this.edittingPageEnd / this.pageLength); // Use Math.ceil here because it's not bookItem's start position. It' END.
        console.log("End filler added. Filler Height: " + spaceLeftAtTheEnd);
      } else {
        this.totalPages = Math.ceil(this.container.scrollHeight / this.pageLength);
      }
    } else if (this.bookConfig.pagingMethod === "column") {
      // Insert another blank page to add one more column gap so the scrollLeft position at the begining of the "actual" last page can be jumped to.
      const filler = document.createElement("div");
      this.bookEditor.changeStyle(
        filler,
        {
          height: this.pageHeight + "px",
          width: this.pageWidth + "px",
          margin: "0px",
          padding: "0px",
          border: "0px",
        },
        true
      );
      this.contents.append(filler);
      this.totalPages = Math.ceil(this.container.scrollWidth / this.pageLength) - 1; // Do not include the last page of end filler.

      console.log("End filler added to make the last page reachable.");
    }
    console.log("Contents reposition is complete.");
  }

  resetPages() {
    console.log(`----------------------Resetting pages for book ${this.instanceID}...----------------------`);
    //Record the current location by getting the current page's starter element.
    if (!this.isVisible) {
      this.#resetWhenVisible = true;
      return;
    }

    // Temporarily disconnect the observer to avoid triggering during reset
    this.#mutationObserver?.disconnect();

    // Recover all edits before repositioning
    this.bookEditor.recoverAllEdits();
    this.fillers.forEach((filler) => {
      filler.remove();
    });
    this.#setupPages(true);

    //Jump back to the last location by scrolling to the recorded pageStarter.
    if (this.pageStarter && this.contents.contains(this.pageStarter.starter)) {
      if (this.pageStarter.starter.nodeName === "#text") {
        this.currentPage = this.getPageNumByItem(Book.rangeTool.createRange(this.pageStarter.starter, this.pageStarter.starter, this.pageStarter.offset, this.pageStarter.starter.length));
      } else {
        this.currentPage = this.getPageNumByItem(this.pageStarter.starter);
      }
    } else {
      this.currentPage = 1;
    }
    console.log("Alreadly jumped back to the last reading position.");

    // Reconnect the observer after reset
    this.#setupMutationObserver();

    this.#resetWhenVisible = false; // Page has been reset, remove this flag
    this.#executeBookEvent("bookreset");
    console.log(`--------------------Book ${this.instanceID} Pages reset complete.-------------------`);
  }

  enterScrollMode() {
    console.log(`Entering scroll mode for book ${this.instanceID}...`);
    this.mode = "scroll";
    this.removeEventListener();
    this.bookEditor.recoverAllEdits();
    this.fillers.forEach((filler) => {
      filler.remove();
    });
    $(`#einkStyle_book${this.instanceID}`).remove();
    this.#anchor = null;
    sessionStorage.setItem("pageNumBook" + this.instanceID, "");

    // Scroll the contents to the position of the beginning of the current page
    if (this.isVisible && this.pageStarter) {
      if (this.pageStarter.starter.nodeType === Node.ELEMENT_NODE) {
        this.pageStarter.starter.scrollIntoView();
      } else {
        let container = this.container.nodeName === "HTML" || this.bookConfig.fullScreen ? document.documentElement : this.container;
        container.scrollTop = Book.rangeTool.createRange(this.pageStarter.starter, this.pageStarter.starter, this.pageStarter.offset, this.pageStarter.starter.length).getBoundingClientRect().top + this.container.scrollTop;
      }
    } else {
      this.container.scrollTop = 0;
    }

    this.container.classList.remove("disable-default-touch");
    this.#executeBookEvent("enterscroll");
  }

  getPageNumByItem(node) {
    // Node can be a text node, an element node, a pageStarter, a pageEnder or a range object.
    let offset = 0;
    if ("starter" in node) {
      // node is a pageStarter or a pageEnder
      offset = node.offset;
      node = node.starter;
    }
    let scrollPos, boundObj;
    if (this.bookConfig.pagingMethod === "vertical") {
      boundObj = node.nodeName === "#text" ? Book.rangeTool.createRange(node, node, offset, node.length).getBoundingClientRect() : node.getBoundingClientRect();
      scrollPos = Math.round(boundObj.y - this.container.getBoundingClientRect().y + this.container.scrollTop);
    } else if (this.bookConfig.pagingMethod === "column") {
      boundObj =
        node.nodeName === "#text"
          ? Book.rangeTool.createRange(node, node, offset, node.length).getBoundingClientRect()
          : Array.from(node.getClientRects()).find((rect) => {
              return rect.height > 10; // 10 is for error tolerance to find the main rect (body) of the book Item.
            }) ?? node.getBoundingClientRect();
      scrollPos = Math.round(boundObj.x - this.container.getBoundingClientRect().x + this.container.scrollLeft);
    }
    return this.getPageNumByScrollPos(scrollPos);
  }

  #handleTouchStart(evt) {
    if (evt.target.closest(".book").book === this) {
      if (!this.isFocused) {
        this.getFocus();
        evt.stopPropagation();
      }

      this.#touchStartX = evt.touches[0].clientX;
      this.#touchStartY = evt.touches[0].clientY;
      this.#startTouchesNumber = evt.touches.length;
    }
  }

  #handleTouchEnd(evt) {
    if (this.#startTouchesNumber) {
      const reset = () => {
        this.#touchStartX = null;
        this.#touchStartY = null;
        this.#startTouchesNumber = 0;
      };

      if (!this.#touchStartX || !this.#touchStartY) {
        return;
      }

      if (window.getSelection()?.toString().trim() !== "" || this.preventGestures === true) {
        reset();
        return;
      } else if (this.preventGestures) {
        this.preventGestures -= 1;
        reset();
        return;
      }

      if (this.#startTouchesNumber == 1) {
        const touchEndX = evt.changedTouches[0].clientX;
        const touchEndY = evt.changedTouches[0].clientY;

        const deltaX = touchEndX - this.#touchStartX;
        const deltaY = touchEndY - this.#touchStartY;

        // Threshold for swipe detection
        const swipeThreshold = 50;

        // Check if the swipe is from bottom to top
        if (Math.abs(deltaX) < swipeThreshold && deltaY < -swipeThreshold) {
          this.currentPage = 1; // Jump to the first page
        }
        // Check if the swipe is from top to bottom
        else if (Math.abs(deltaX) < swipeThreshold && deltaY > swipeThreshold) {
          this.currentPage = this.totalPages; // Jump to the last page
        }
      }
      reset();
    }
  }

  static #handleKeyDown(event) {
    const book = Book.focusedBook;
    if (book?.mode === "eink") {
      switch (event.key) {
        case "ArrowRight":
          // Book.#preventVolumnKeyEvent = true; // Prevent duplicate triggering of flip page when using bluetooth under EinkBro.
          book.currentPage += 1;
          break;
        case "ArrowLeft":
          // Book.#preventVolumnKeyEvent = true; // Prevent duplicate triggering of flip page when using bluetooth under EinkBro.
          book.currentPage -= 1;
          break;
        case "ArrowUp":
          book.currentPage = 1;
          break;
        case "ArrowDown":
          book.currentPage = book.totalPages;
          break;
        case "AudioVolumeDown":
          book.currentPage += 1;
          break;
        case "AudioVolumeUp":
          book.currentPage -= 1;
          break;
      }
    }
  }

  #handleResizeOrVisibility() {
    if (this.mode === "scroll") return;

    if (!this.#isWindowResizeEvent) {
      // Check if the resize event is actually a visibility change (show or hide) event. (So this event is triggered by the resizeObserver.)
      if (this.isVisible === false && this.containerWidth !== 0 && this.containerHeight !== 0) {
        // The book has become hidden from visible.
        if (this.isFocused) this.getBlur();
        this.containerWidth = 0;
        this.containerHeight = 0;
        console.log(`Book ${this.instanceID} is hidden from now. Mutation to this book will trigger page reset when the book becomes visible again.`);
        this.#executeBookEvent("hidden");
        return;
      } else if (this.isVisible === true && this.containerWidth === 0 && this.containerHeight === 0) {
        // the book has become visible from hidden. Record it's dimension
        console.log("Book " + this.instanceID + " is visible now.");
        this.getFocus();
        this.#updateContainerDimension();
        if (this.#resetWhenVisible) {
          console.log("The book has become visible. Reset pages because there're mutations when this book is hidden.");
          this.#resetWhenVisible = false;
          this.resetPages();
        }
        this.#executeBookEvent("visible");
        return;
      } else if (this.containerWidth === this.container.clientWidth && this.containerHeight === this.container.clientHeight) {
        console.log("Window size didn't change. No need to reset pages.");
        return;
      }
    }

    let timeElapsed;
    this.#isWindowResizeEvent = false;
    if (this.#einkModeStartTime !== null) {
      timeElapsed = performance.now() - this.#einkModeStartTime;
      this.#einkModeStartTime = null;
      console.log("Time elapsed between entering Eink mode and resize event: " + timeElapsed + " ms");
    }
    clearTimeout(this.#resizeTimer);

    this.#executeBookEvent("bookresize");
    const isOrientationChange = this.#orientationState !== Book.getOrientationState();
    if (isOrientationChange && this.#resizeCount < 5) {
      // This is orientation change, the resize event won't keep firing, do not need debouncing.
      console.log("Orientation change detected. Resetting pages immediately.");
      console.log("resize count: " + this.#resizeCount);
      this.#handleResize(timeElapsed);
      this.#orientationState = Book.getOrientationState();
      this.#resizeCount = 0;
    } else {
      // Debounce the resize event to avoid excessive recalculations
      this.#resizeTimer = setTimeout(() => {
        this.#resizeCount = 0;
        this.#handleResize(timeElapsed);
      }, 250); // Wait for 250ms after the last resize event
    }
  }

  #handleResize(timeElapsed) {
    console.log("Window resized. Repositioning contents...");
    this.#updateContainerDimension();
    this.ignoreMutation = false; // Reset the ignoreMutation flag because we turn this on in the window resize event handler.
    this.resetPages();
    // if (timeElapsed < 50) {
    //   // If the resize event happened immediately after entering Eink mode, it's fired by the apperance of address bar, we should jump to the anchor after resizing.
    //   this.#correctScroll = true;
    // }
  }

  findContTablePage() {
    if (this.contentTable) return this.getPageNumByItem($(this.contentTable).find(":header")[0]);
    console.log("There's no content table in the book.");
    return null;
  }

  #flipPage(evt) {
    if (Book.textSelection?.trim() !== "") {
      return;
    }
    if (this.preventFlip === true) {
      return;
    } else if (this.preventFlip) {
      this.preventFlip -= 1;
      return;
    }

    const halfPageWidth = this.container.clientWidth / 2;
    const leftBorderPos = Math.round(this.container.getBoundingClientRect().x);
    if (evt.clientX < leftBorderPos + halfPageWidth) {
      this.currentPage -= 1;
    } else {
      this.currentPage += 1;
    }
  }
  addEventListener(event, handler) {
    const events = event.split(" ");
    events.forEach((event) => {
      if (this.#bookEvents.includes(event)) {
        // Register Book events
        this.#eventHandlers.push([event, handler]);
      } else {
        // Register regular DOM events
        const wrappedHandler = (evt) => {
          if (this.mode === "eink") {
            handler.call(this, evt);
          }
        };

        if (event === "resize") {
          $(window).on(event + ".book" + this.instanceID, wrappedHandler);
        } else {
          $(this.container).on(event + ".book" + this.instanceID, wrappedHandler);
        }
      }
    });
  }

  static #handleVolumeKeyPageFlip(evt) {
    if (evt.target === document) return; // Important! This is to prevent users touch on iframe and casuing quick continuous page turning.
    if (Book.focusedBook.mode === "eink") {
      if (!Book.#preventVolumnKeyEvent) {
        const scrollTopPos = Math.round(document.documentElement.scrollTop);

        if (!Book.#pageFlipped) {
          if (scrollTopPos > Book.#scrollBufferLength / 2) {
            Book.focusedBook.currentPage++;
            Book.#pageFlipped = true;
          } else if (scrollTopPos < Book.#scrollBufferLength / 2) {
            Book.focusedBook.currentPage--;
            Book.#pageFlipped = true;
          }
          document.documentElement.scrollTop = Book.#scrollBufferLength / 2;
        } else {
          Book.#pageFlipped = false;
        }
      } else {
        Book.#preventVolumnKeyEvent = false;
        document.documentElement.scrollTop = Book.#scrollBufferLength / 2;
      }
    }
  }

  #executeBookEvent(event, evtObj = {}) {
    this["on" + event] && this["on" + event].call(this, evtObj);
    this.#eventHandlers.forEach(([eventName, handler]) => {
      if (eventName === event) {
        handler.call(this, evtObj);
      }
    });
  }

  #setupResizeObserver() {
    this.#resizeObserver = new ResizeObserver(this.#handleResizeOrVisibility.bind(this));
    this.#resizeObserver.observe(this.container);
    console.log("Resize observer has been set for book " + this.instanceID);
  }

  removeEventListener(event = undefined, handler = undefined) {
    if (!event) {
      // Remove all book DOM event listeners (not Book events listeners.)
      $(window).off(".book" + this.instanceID);
      $(this.container).off(".book" + this.instanceID);
      $(this.contents).off(".book" + this.instanceID);
      this.#mutationObserver?.disconnect();
      this.#resizeObserver?.disconnect();
      clearInterval(this.#fontSizeCheckInterval);

      // Check if there are no book instances left. If so, clean up the global event listeners.
      if (
        $(".book").filter(function () {
          return this.book !== undefined;
        }).length === 0
      ) {
        // There are no book instances left. Clean up the static variables.
        $(window).off(".book");
        document.onselectionchange = undefined;
        Book.#globalListenersSet = false;
      }

      this.#touchStartX = null;
      this.#touchStartY = null;
      this.#startTouchesNumber = null;
    } else {
      const events = event.split(" ");
      events.forEach((event) => {
        if (this.#bookEvents.includes(event)) {
          // Remove Book events listeners
          if (handler) {
            this.#eventHandlers = this.#eventHandlers.filter(([eventName, savedHandler]) => {
              return eventName !== event || savedHandler !== handler;
            });
          } else {
            this.#eventHandlers = this.#eventHandlers.filter(([eventName, savedHandler]) => {
              return eventName !== event;
            });
          }
        } else {
          // Reset touch event related variables before removing event listeners
          if (event.includes("touch")) {
            this.#touchStartX = null;
            this.#touchStartY = null;
            this.#startTouchesNumber = null;
          }

          // Native DOM event listeners
          if (event === "resize") {
            this.#resizeObserver?.disconnect();
          } else {
            if (handler) $(this.container).off(event + ".book" + this.instanceID, handler);
            else $(this.container).off(event + ".book" + this.instanceID);
          }
        }
      });
    }
  }

  #createPageStarter(starter, offset = 0) {
    return { starter, offset: offset };
  }

  getPageNumByScrollPos(scrollPos) {
    return Math.floor(scrollPos / this.pageLength) + 1;
  }

  isValidNode(node) {
    if (![Node.ELEMENT_NODE, Node.TEXT_NODE].includes(node.nodeType) || isAbsolutePositioned.call(this, node) || hasZeroDimension(node)) {
      return false;
    } else {
      return true;
    }

    function hasZeroDimension(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim() === "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const { width, height } = node.getBoundingClientRect();
        return width === 0 || height === 0;
      } else {
        return true;
      }
    }

    function isAbsolutePositioned(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      const isStaticPos = $(node).css("position") === "static";
      const offsetParent = findOffsetParent(node);
      const offsetParentInculdedByContents = offsetParent && offsetParent !== this.contents && this.contents.contains(offsetParent);
      return !isStaticPos || offsetParentInculdedByContents;

      function findOffsetParent(element) {
        let offsetParent = element.offsetParent;
        if (!offsetParent || offsetParent.nodeName === "BODY") return offsetParent;
        if (["TABLE", "TD"].includes(node.offsetParent.nodeName) || (["relative", "absolute"].includes($(offsetParent).css("position")) && ["top", "left", "right", "bottom"].every((position) => parseInt($(offsetParent).css(position)) === 0))) {
          offsetParent = findOffsetParent(offsetParent);
          return offsetParent;
        }
      }
    }
  }

  static findFloatingElements(contents) {
    const floatingElements = [];

    const dfs = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const computedStyle = window.getComputedStyle(node);
        if (computedStyle.float !== "none") {
          floatingElements.push(node);
          node.id = `floating-${floatingElements.length}`;
          return; // Don't search deeper if this element is floated
        }

        // Search children
        for (let child of node.children) {
          dfs(child);
        }
      }
    };

    // Start the search from the book's contents
    dfs(contents);

    return floatingElements;
  }

  #setupMutationObserver() {
    this.#mutationObserver = new MutationObserver(this.#checkForLayoutChanges.bind(this));
    this.#mutationObserver.observe(this.contents, {
      attributeFilter: ["style", "class", "width", "height", "id"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    console.log("Mutation observer is ON.");
  }

  #checkForLayoutChanges(mutations) {
    if (this.mode === "scroll") return;

    if (this.ignoreMutation === true) {
      return;
    } else if (this.ignoreMutation) {
      this.ignoreMutation -= 1;
      return;
    }

    console.log("Layout changes detected. For book ID:", this.instanceID, " Book's contents: ", this.contents.className);
    const isNodeTreeChanges = mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);

    if (isNodeTreeChanges) {
      console.log("Layout changes are made by node tree changes.");

      // If all mutations are inside the container of other books, ignore this event. (Because other books already manage thier layout changes.)
      if (mutations.every((mutation) => mutation.target.closest(".book") !== this.container)) {
        console.log("Layout changes are not related to this book.");
      }

      // All mutations specific to this book doesn't contain valid nodes that can be repositioned in the contents.
      else if (!mutationsIncludeValidNode.call(this, mutations)) {
        console.log("Layout changes are related to zero dimension nodes or nodes that are abosolutely positioned in the book's content.");
      } else {
        this.resetPages();
      }
    }

    // Check if the scroll length of the book is changed by any mutation.
    else if (this.scrollLengthChanged) {
      console.log("Container scrollHeight changed by changing some node's style attribute. Resetting pages...");
      this.resetPages();
    }

    function mutationsIncludeValidNode(mutations) {
      return mutations.some((mutation) => {
        const { target, addedNodes, removedNodes } = mutation;
        if (this.isValidNode(target)) {
          return (addedNodes.length && Array.from(addedNodes).some((node) => this.isValidNode(node))) || (removedNodes.length && Array.from(removedNodes).some((node) => this.isValidNode(node)));
        } else {
          return false;
        }
      });
    }
  }

  setupContentTable(contTableConfig = {}) {
    const defaultConfig = {
      area: this.contents,
      expandSubLists: false,
      lang: this.lang,
      minLevel: "h1",
      maxLevel: "h6",
      style: "",
    };
    const { area, expandSubLists, lang, minLevel, maxLevel, style } = { ...defaultConfig, ...contTableConfig };
    const unfoldIcon = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh61PrcDdc05urR5s9YBt-zsRGyk51SKcunC0Ha8sYECZK9aEX_EYKv5fe5au4ERFc83wYtbe5-G4tkM9bTtih-AzGh7-0GHBrm_xixoaBR0eSO2zuLWkQooXIaHims2Mk1g6_KKyoIrw/s320/25223.png";
    const foldIcon = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhLS0VMZ5HkQS6wSuNLbo1a8uYSiiysarkQCKxLrH31AdFKDcC1_0klWP9FGtsa9_1tKu-NEX7SniBnDSIhzLBuvMpZ1vy8HIja-OKm6wXQme057NMMF1lJ8UJLklsP9VnRd2BspzQXAA/s200/25623.png";

    const headers = $(area)
      .find(":header")
      .not(this.bookTitle)
      .filter((index, elem) => {
        return !["true", true].includes(elem.getAttribute("ignoreTable")) && this.isValidNode(elem) && Number(elem.nodeName.slice(1)) >= Number(minLevel.slice(1)) && Number(elem.nodeName.slice(1)) <= Number(maxLevel.slice(1));
      });

    if (headers.length <= 3) return; // If there are less than 3 headers, skip the table creation process

    // Try to find the div with class="cont_table", if not, create one and prepend it before the first header.
    let contentTable = $(this.contents)
      .find(".cont_table")
      .filter((index, elem) => {
        return elem.closest(".article_" + this.instanceID) === this.contents;
      })[0];
    if (!contentTable) {
      contentTable = document.createElement("DIV");
      contentTable.classList.add("cont_table");
      contentTable.classList.add("cont_table_book_" + this.instanceID);
      headers[0].insertAdjacentElement("beforebegin", contentTable);
    } else {
      contentTable.classList.add("cont_table_book_" + this.instanceID);

      // Reset all header id if the content table has been setup before.
      $(area)
        .find(":header")
        .not(this.bookTitle)
        .filter((index, elem) => {
          return !["true", true].includes(elem.getAttribute("ignoreTable")) && this.isValidNode(elem) && Number(elem.nodeName.slice(1)) >= Number(minLevel.slice(1)) && Number(elem.nodeName.slice(1)) <= Number(maxLevel.slice(1));
        })
        .attr("id", null);
    }

    this.contentTable = contentTable;
    contentTable.setupContentTable = this.setupContentTable.bind(this);

    // Make a content table style sheet if it doesn't exist already.
    let contTableStyleSheet = document.getElementById(`cont_table_style_book${this.instanceID}`);
    if (!contTableStyleSheet) {
      contTableStyleSheet = document.createElement("style");
      contTableStyleSheet.textContent =
        `
    .book_${this.instanceID} .cont_table {
        border-style: double;
        margin: 30px 0px;
        padding: 10px 5px 10px 40px;
        width: 80%;
    }

    .book_${this.instanceID} .cont_table li img {
        margin-left: 10px;
    }

    .book_${this.instanceID} .cont_table li img:hover,
    .book_${this.instanceID} .cont_table li img:focus {
        cursor: pointer;
    }
` + style;
      this.contents.insertAdjacentElement("beforebegin", contTableStyleSheet);
      contTableStyleSheet.id = `cont_table_style_book${this.instanceID}`;
    }

    let htmlContent = "<ul>";
    for (let i = 0; i < headers.length; i++) {
      const currentHeaderLevel = Number(headers[i].nodeName.slice(1));

      htmlContent += `<li><a href="#book${this.instanceID}_topic${i}">${headers[i].textContent}</a>`;
      headers[i].setAttribute("id", `book${this.instanceID}_topic` + i);

      // If it's not the last header, compare the header level with the next one's level to see if a sublist should be created or the current sublist should be closed.
      if (i !== headers.length - 1) {
        const nextHeaderLevel = Number(headers[i + 1].nodeName.slice(1));

        // If the currentHeader level is less than the next one, it means we need to create a sublist and append a unfold/fold icon next to the current header.
        if (currentHeaderLevel < nextHeaderLevel) {
          for (let j = 0; j < nextHeaderLevel - currentHeaderLevel; j++) {
            if (j === 0) {
              // Check the value of expandSubLists parameter or check if the header has an expand attribute set to true to decide the visibility of the sublist.
              if (expandSubLists === true || headers[i].getAttribute("expand") === "true") {
                htmlContent += `<img class="foldIcon" src="${unfoldIcon}" width="12px"/></li><ul>`;
              } else {
                htmlContent += `<img class="foldIcon" src="${foldIcon}" width="12px"/></li><ul style="display:none;">`;
              }
            } else {
              htmlContent += "<ul>";
            }
          }
        } else if (currentHeaderLevel > nextHeaderLevel) {
          // If the current header level is higher than the next header's level, unindent.
          htmlContent += "</li>";
          for (let i = 0; i < currentHeaderLevel - nextHeaderLevel; i++) {
            htmlContent += "</ul>";
          }
        } else {
          // If the levels are equal, just close the current entry.
          htmlContent += "</li>";
        }
      } else {
        // If the current header is the last one，closing all the opened sublists.
        for (let i = 0; i < currentHeaderLevel; i++) {
          htmlContent += "</ul>";
        }
      }
    }

    //the title of table of contents should be added after its entries are established otherwise the entry will also contain this <h3> title.
    const tableTitle = lang === "zh-TW" ? "目錄" : "Table of Content";
    contentTable.innerHTML = `<h3 ignoreTable="true">${tableTitle}</h3>` + htmlContent;

    // Check the visibility of the sublists, if it's set to visible, then all it's parent sublist should be visible.
    $(contentTable)
      .find("ul ul")
      .each(function () {
        if (this.style.display === "" || this.style.display === "block") {
          this.parentElement.style.display = "block";
        }
      });

    $(contentTable)
      .find("img.foldIcon")
      .on("click", function toggleListVisibility(event) {
        event.stopPropagation();
        const btnToggled = event.currentTarget;
        const subHeaderList = btnToggled.parentElement.nextElementSibling;
        const status = subHeaderList.style.display;

        if (status == "none") {
          subHeaderList.style.display = "block";
          btnToggled.setAttribute("src", unfoldIcon);
        } else {
          subHeaderList.style.display = "none";
          btnToggled.setAttribute("src", foldIcon);
        }
      });
    console.log("Content table inserted");
  }

  remove(removeDOM = false) {
    this.getBlur();

    if (!removeDOM) {
      // Recover back to the original state in scroll mode
      this.enterScrollMode();
      this.container.classList.remove("book");
      if (this.#wrapped) {
        $(this.container).find(" > *").not(this.contents).remove();
        $(this.container).append($(this.contents.childNodes));
        $(this.contents).remove();
      } else {
        this.contents.classList.remove("article_" + this.instanceID);
        delete this.contents.book;
      }
      delete this.container.book;
    } else {
      this.removeEventListener();
      $(`#einkStyle_book${this.instanceID}`).remove();
      this.container.remove();
    }
    delete sessionStorage["pageNumBook" + this.instanceID];
    for (const prop in this) {
      delete this[prop];
    }
  }

  noteSystem = {
    book: this,
    bookID: undefined,
    noteNumberTexts: [],
    noteWindow: undefined,
    keptNote: undefined,
    lang: undefined,
    init(lang) {
      if (lang) this.lang = lang;
      else this.lang = document.documentElement.lang.includes("zh") ? "zh-TW" : "en";

      this.noteNumberTexts = Array.from(
        $(this.book.contents)
          .find("i:contains('Note'), i:contains('註')")
          .filter((index, elem) => {
            elem = elem.closest("i");
            return elem.previousElementSibling?.nodeName === "U" && elem.closest(".bookContents") === this.book.contents;
          })
      ); // Distinguish the note pattern from other <i> elements.

      if (this.book.bookConfig.useNotes && this.noteNumberTexts.length > 0) {
        this.bookID = this.book.instanceID;
        this.setupNotes(this.lang);
        this.noteWindow = this.renderView();
        const noteStyleSheet = document.createElement("style");
        noteStyleSheet.textContent = `
        div#note_window {
          position: fixed;
          margin: 0px;
          top: 0px;
          left: 0px;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          width: 100%;
          height: 100%;
          overflow: auto;
          background-color: rgba(0, 0, 0, 0.4);
          display: none;
      }
      
      div#note {
          background-color: #fefefe;
          padding: 30px;
          border: 1px solid #888;
          max-width: 800px;
          width: 80%;
          margin: 10% auto;
          overflow: auto;
          border-radius: 20px;
          box-sizing: border-box;
      }
      
      div#note_content {
          color: black;
          font: 18px Roboto, sans-serif;
          line-height: 1.6em;
          letter-spacing: 0.8px;
          display: block;
      }
      
      #note_number {
          margin: 0px;
      }
      
      .noted_text {
          background-color: yellow;
      }
      
      #closeIcon {
          color: #000;
          float: right;
          font-size: 28px;
          font-weight: bold;
          z-index: 1;
      }
      #closeIcon:hover,
      #closeIcon:focus {
          color: blue;
          text-decoration: none;
          cursor: pointer;
      }

      div#goToNotesBtn {
        float: right;
        font-size: 12px;
        color: blue;
        clear: both;
        margin: 0px;
      }

      #goToNotesBtn:hover,
      #goToNotesBtn:focus {
          color: black;
          text-decoration: none;
          cursor: pointer;
      }

      i {
        font-size: x-small;
        font-style: normal;
        font-weight: bold;
        color: blue;
        text-decoration: underline;
        text-decoration-color: blue;
        text-decoration-style: dotted;
      }

      i:hover,
      i:focus {
        color: black;
        text-decoration: none;
        cursor: pointer;
      }

      .checkNotedTextBtn {
        cursor: pointer;
        padding-left: 10px;
      }

      u {
        text-decoration: none;
      }
        `;
        noteStyleSheet.id = `note_style_sheet_book${this.book.instanceID}`;
        document.head.appendChild(noteStyleSheet);

        this.noteWindow.addEventListener("click", (evt) => {
          // There are two ways to hide the note window: one is to click the close icon, and the other is to click on the background.
          const closeIconClicked = evt.target === this.noteWindow.closeIcon;
          const noteWindowClicked = evt.target === this.noteWindow;
          const goToNotesBtnClicked = evt.target === this.noteWindow.goToNotesBtn;

          if (closeIconClicked || noteWindowClicked) {
            this.hideNoteWindow();
          } else if (goToNotesBtnClicked) {
            if (this.book.mode === "scroll") {
              window.location.href = "#" + this.book.noteSection.id;
            } else {
              this.book.currentPage = this.book.getPageNumByItem(this.book.noteSection);
              this.book.hint(this.book.noteSection);
            }
            this.hideNoteWindow();
          }
        });

        this.book.container.addEventListener("click", (evt) => {
          const noteNumberBtnClicked = evt.target.closest("i[class*='noteButton']");
          const checkNotedTextBtnClicked = evt.target.closest("[class*='checkNotedTextBtn']");

          if (noteNumberBtnClicked) {
            this.displayNote(evt);
          } else if (checkNotedTextBtnClicked) {
            this.checkNotedText(evt);
          }
        });

        console.log("Note system has been initialized!");
      } else {
        console.log(`No notes found in the book ${this.book.instanceID}. Do not initialize the note system.`);
      }
    },

    renderView() {
      const noteWindow = document.createElement("div");
      const note = document.createElement("div");

      noteWindow.id = "note_window";
      noteWindow.classList.add("bookUI");
      noteWindow.style.display = "none";
      note.id = "note";
      note.innerHTML = `<span id="closeIcon" class="bookUI">×</span><h3 id="note_number"></h3><div id="note_content"></div><div id="goToNotesBtn" class="bookUI">${this.lang === "zh-TW" ? "註解區" : "note section"}📄</div>`;
      noteWindow.appendChild(note);
      this.book.container.append(noteWindow);

      // Make noteWindow's child views to its property to make easy access and clear codes.
      noteWindow.note = note;
      noteWindow.closeIcon = noteWindow.querySelector("#closeIcon");
      noteWindow.noteNumber = noteWindow.querySelector("#note_number");
      noteWindow.noteContent = noteWindow.querySelector("#note_content");
      noteWindow.goToNotesBtn = noteWindow.querySelector("#goToNotesBtn");

      const einkStyle = `

      div#note {
        max-height: 80%;
        overflow: hidden;
      } 

      div#note_content {
        width: 100%;
        max-height: 75%;
        margin-top: 10px;
        margin-bottom: 0px;
      }

      div#goToNotesBtn {
        position: relative;
        margin-top: 10px;
        top: -10px;
      }
      `;

      noteWindow.book = new Book(noteWindow.note, {
        contents: noteWindow.noteContent,
        useContentTable: false,
        einkStyle: einkStyle,
        fullScreen: false,
      });
      noteWindow.book.displayNote = this.displayNote.bind(this);
      noteWindow.book.hideNoteWindow = this.hideNoteWindow.bind(this);
      console.log("Note window view components have been added to the book's container!");

      return noteWindow;
    },

    setupNotes(lang = "zh-TW") {
      const noteText = lang == "zh-TW" ? "註解" : "Notes";
      const noteNumberTexts = this.noteNumberTexts;
      $(noteNumberTexts).each((index, elem) => {
        elem.id = `noteButton_${index + 1}_${this.bookID}`;
        elem.classList.add("noteButton");
        elem.classList.add("bookUI");

        if (elem.previousElementSibling?.nodeName === "U") {
          elem.previousElementSibling.id = `notedText_${index + 1}_${this.bookID}`;
        } else {
          console.error(`Cannot find any sentence noted by the note number ${index + 1}. Please correct this error by adding "underline" to the sentence.`);
        }
      });

      let noteSectionHeader = $(this.book.contents)
        .find(":header")
        .filter(function () {
          return $(this).text().includes("Note ") || $(this).text().includes("註解");
        })[0];

      /* If a 'Notes' heading already exists in the article, it means that notes are already placed at the end of the article. (This code snippet is only used by myself for formatting my published old articles. You can delete this code section.) */
      if (noteSectionHeader) {
        noteSectionHeader.parentElement.setAttribute("id", "note_section_" + this.bookID);
        this.book.noteSection = noteSectionHeader.parentElement;

        const notes = $(`#note_section_${this.bookID} > p`).filter((index, elem) => {
          return this.book.isValidNode(elem);
        });

        if (notes.length === noteNumberTexts.length) {
          this.book.notes = Array.from(notes);
          reformatNotes.call(this, notes);
        } else {
          console.error("The number of notes do not match the note-numbering text. Please check the content of the article.");
        }
      } else {
        /* If a 'Notes' heading does not exist in the article, it means that the notes are placed directly after their corresponding numbers, with the content of the note enclosed in parentheses. Therefore, it is necessary to create a note section to place these notes after extracting them from the context of the article. */

        console.log("Can't find note section. Creating one...");
        createNoteSection.call(this);
        extractNotes.call(this, noteNumberTexts);
        reformatNotes.call(this, $(this.book.notes));
      }

      console.log("Notes and note buttons have been set up.");

      function createNoteSection() {
        // Identify the lowest level header tag used in the article. Then, use this same header tag to create the 'Notes' heading.
        let lowestHeader = "H6";

        $(this.book.contents)
          .find(":header")
          .each(function () {
            if (Number(this.nodeName.slice(1)) < Number(lowestHeader.slice(1))) {
              lowestHeader = this.nodeName;
              if (lowestHeader == "H1") {
                return false;
              }
            }
          });

        const noteSection = document.createElement("div");
        noteSection.setAttribute("id", "note_section" + "_" + this.bookID);
        this.book.noteSection = noteSection;
        noteSectionHeader = document.createElement(lowestHeader);
        noteSectionHeader.textContent = noteText;
        noteSection.appendChild(noteSectionHeader);

        // If there is a 'Further Reading' section, place the note section before the 'Further Reading' section. Otherwise, place it at the very end of the article.
        const furtherReadingText = lang == "zh-TW" ? "延伸閱讀" : "Further Reading";
        let furtherReadingSection = $(this.book.contents).find(`:header:contains(${furtherReadingText})`)[0];

        if (furtherReadingSection) {
          furtherReadingSection.insertAdjacentElement("beforebegin", noteSection);
        } else {
          $(this.book.contents).append(noteSection);
        }

        console.log("Note section has been created.");
      }

      function extractNotes(noteNumberTexts) {
        $(noteNumberTexts).each((index, elem) => {
          const searchTarget = elem.parentElement;
          const note = document.createElement("P");
          let startNode, startOffset, endNode, endOffset;
          let openParenFound = false;
          let ohterParentCount = 0;

          const treeWalker = document.createTreeWalker(searchTarget, NodeFilter.SHOW_TEXT, (node) => {
            if (node.compareDocumentPosition(elem) === Node.DOCUMENT_POSITION_PRECEDING) {
              return NodeFilter.FILTER_ACCEPT;
            } else {
              return NodeFilter.FILTER_REJECT;
            }
          });

          while (treeWalker.nextNode()) {
            if (treeWalker.currentNode.textContent.includes("(") || treeWalker.currentNode.textContent.includes("（")) {
              if (!openParenFound) {
                startNode = treeWalker.currentNode;
                startOffset = treeWalker.currentNode.textContent.indexOf("(") === -1 ? treeWalker.currentNode.textContent.indexOf("（") : treeWalker.currentNode.textContent.indexOf("(");
                openParenFound = true;
              } else ohterParentCount++;
            }

            if ((openParenFound && treeWalker.currentNode.textContent.includes(")")) || treeWalker.currentNode.textContent.includes("）")) {
              if (ohterParentCount) {
                ohterParentCount--;
              } else {
                endNode = treeWalker.currentNode;
                endOffset = treeWalker.currentNode.textContent.indexOf(")") === -1 ? treeWalker.currentNode.textContent.indexOf("）") + 1 : treeWalker.currentNode.textContent.indexOf(")") + 1;
                break;
              }
            }
          }

          if (startNode && endNode) {
            let range = Book.rangeTool.createRange(startNode, endNode, startOffset, endOffset);

            try {
              range.surroundContents(note);
            } catch (e) {
              // Fallback: extract contents and insert them into the replace element
              const fragment = range.extractContents();
              note.appendChild(fragment);
              range.insertNode(note);
            }
            note.textContent = note.textContent.trim().slice(1, -1); //remove parentheses
          } else {
            console.error(`Cannot find the corresponding note after the note number ${index}. Please correct this error by adding a note right after the note number and make sure the note are enclosed by parentheses such as "(note...)".`);
          }

          note.insertAdjacentHTML("afterbegin", `<b>${elem.textContent.trim().slice(1, -1)}、</b>`);
          this.book.notes.push(note);
          this.book.noteSection.append(note);
        });

        console.log("Notes have been extracted and placed in the note section.");
      }

      function reformatNotes(notes) {
        notes.each((index, note) => {
          note.id = `note_${index + 1}_${this.bookID}`;
          note.classList.add("noteExplain");

          // Add a button to check the noted text in the context.
          const checkNotedTextBtn = document.createElement("SPAN");

          checkNotedTextBtn.id = `checkNotedTextBtn_${index + 1}_${this.bookID}`;
          checkNotedTextBtn.classList.add("checkNotedTextBtn");
          checkNotedTextBtn.classList.add("bookUI");
          checkNotedTextBtn.innerHTML = "⤴️";
          note.append(checkNotedTextBtn);
        });

        console.log("Notes have been reformatted.");
      }
    },

    checkNotedText(evt) {
      const target = evt.target.closest("[class*='checkNotedTextBtn']"); // Do not directly use evt.target to avoid the checkNotedTextBtn being highlighted.
      const idNumber = target.id.slice(target.id.indexOf("_") + 1, target.id.lastIndexOf("_"));
      const noteNumberText = document.getElementById("noteButton_" + idNumber + "_" + this.bookID);
      const notedText = document.getElementById("notedText_" + idNumber + "_" + this.bookID);
      if (this.book.mode === "scroll") {
        window.location.href = "#" + notedText.id;
        window.scrollBy(0, -window.innerHeight / 2);
        notedText.classList.add("noted_text"); // highlight the noted text when checked.
      } else {
        this.book.currentPage = this.book.getPageNumByItem(noteNumberText);
        this.book.hint(notedText);
      }

      console.log(`check the sentence noted for note ${idNumber}`);
    },

    displayNote(evt) {
      this.book.ignoreMutation = 1;

      const target = evt.target.closest("i[class*='noteButton']");
      const noteWindow = this.noteWindow;
      const idNumber = target.id.slice(target.id.indexOf("_") + 1, target.id.lastIndexOf("_"));
      const note = this.book.notes[idNumber - 1];
      const noteCopy = note.cloneNode(true);
      const notedText = this.book.container.querySelector(`#notedText_${idNumber}_${this.bookID}`);

      note.parentNode.replaceChild(noteCopy, note);
      this.keptNote = note;
      noteWindow.noteNumber.innerHTML = note.querySelector("b").textContent.slice(0, -1); // Going up to the -1 position is to remove the punctuation mark "、".
      note.removedTitle = note.removeChild(note.querySelector("b"));
      note.removedBtn = note.removeChild(note.querySelector(".checkNotedTextBtn"));

      // Remove all support and fillers in the note for display
      note.querySelectorAll("support").forEach((support) => support.remove());
      note.querySelectorAll("[class*='filler']").forEach((filler) => filler.remove());
      note.querySelectorAll("[class*='small_filler']").forEach((smallFiller) => smallFiller.remove());
      note.normalize();

      noteWindow.noteContent.append(note);
      noteWindow.style.display = this.book.mode === "eink" ? "flex" : "block";
      notedText.classList.remove("noted_text"); // Remove the highlighted status of the noted text when the note window is displayed.

      console.log(`Display the note of book ${this.book.instanceID} for note ${idNumber}`);
    },

    hideNoteWindow() {
      this.book.ignoreMutation = 1;
      this.noteWindow.book.ignoreMutation = 1;

      console.log(`Hide the note window of book ${this.book.instanceID}`);
      if (this.noteWindow.book.mode === "eink") this.noteWindow.book.currentPage = 1; // Reset the page to the first page when the note window is hidden.
      // Hide the note window and update the corrosponding note at note section to the noteWindow.noteContent if it's content has been modified by the user using the highlighter.

      const note = this.keptNote;
      const noteIndex = Number(note.id.slice(note.id.indexOf("_") + 1, note.id.lastIndexOf("_")));

      // Restore the original note content
      this.noteWindow.book.bookEditor.recoverAllEdits();

      // Show the hidden elements in the original note.
      note.insertAdjacentElement("afterbegin", note.removedTitle);
      note.insertAdjacentElement("beforeend", note.removedBtn);
      note.normalize();

      // Update the note section with the modified note content
      this.book.noteSection.replaceChild(note, this.book.noteSection.querySelectorAll("p")[noteIndex - 1]);
      $(this.noteWindow).hide();
    },
  };

  static nodeTool = {
    getTextNodeLineHeight(textNode) {
      let myRange = document.createRange();
      let height = 0;

      myRange.setStart(textNode, 0);

      for (let i = 1; !height; i += 2) {
        myRange.setEnd(textNode, i);
        height = Math.round(myRange.getBoundingClientRect().height);
      }
      return height;
    },

    getNodeBound(node, container) {
      const boundObj = node.nodeName === "#text" ? Book.rangeTool.createRange(node, node, 0, node.length).getBoundingClientRect() : node.getBoundingClientRect();
      node.nodeStart = container.nodeName == "HTML" ? Math.round(boundObj.y) + Math.round(container.scrollTop) : Math.round(boundObj.y) - Math.round(container.getBoundingClientRect().y) + Math.round(container.scrollTop);

      if (node.nodeName === "#text") {
        const lineHeight = Math.round(parseFloat($(node.parentElement).css("line-height")));
        const rangeHeight = Book.nodeTool.getTextNodeLineHeight(node);
        node.nodeEnd = Math.round(node.nodeStart) + Math.round(boundObj.height) + Math.round((lineHeight - rangeHeight) / 2);
      } else {
        node.nodeEnd = Math.round(node.nodeStart) + Math.round(boundObj.height);
      }
    },

    getNodeWidth(node) {
      const boundObj = node.nodeName === "#text" ? Book.rangeTool.createRange(node, node, 0, node.length).getBoundingClientRect() : node.getBoundingClientRect();
      return boundObj.width;
    },

    getTextRange(elementNode, text) {
      const range = document.createRange();
      const walker = document.createTreeWalker(elementNode, NodeFilter.SHOW_TEXT);

      let node;
      while ((node = walker.nextNode())) {
        const index = node.textContent.indexOf(text);
        if (index !== -1) {
          range.setStart(node, index);
          range.setEnd(node, index + text.length);
          return range;
        }
      }

      // If the text is not found, return null or throw an error
      return null;
    },
  };

  static rangeTool = {
    getRangeBound(range, container) {
      const { y, height } = range.getBoundingClientRect();
      const rangeStart = container.nodeName == "HTML" ? Math.round(container.scrollTop) + Math.round(y) : Math.round(container.scrollTop) + (Math.round(y) - Math.round(container.getBoundingClientRect().y));
      const rangeEnd = rangeStart + Math.round(height);
      return { rangeStart, rangeEnd };
    },

    createRange(startContainer, endContainer = startContainer, startPos = 0, endPos = 1) {
      const range = document.createRange();
      range.setStart(startContainer, startPos < 0 ? 0 : startPos);
      try {
        range.setEnd(endContainer, endPos);
      } catch (error) {
        range.setEnd(endContainer, endContainer.nodeName === "#text" ? endContainer.length : endContainer.childNodes.length);
      }
      return range;
    },
  };
}

Book.prototype.bookConfig = {
  contents: undefined,
  einkStyle: "",
  bookTitle: undefined,
  author: "",
  upperMargin: 30,
  lowerMargin: 30,
  leftMargin: 30,
  rightMargin: 30,
  fullScreen: true,
  zIndex: 1000,
  minImgHeight: 200,
  pagingMethod: "column",
  useContentTable: true,
  useNotes: true,
  lang: undefined,
};

class BookEditor {
  book = undefined;
  _changedElems = [];

  constructor(book) {
    this.book = book;
  }

  toCamelCase(styleRules) {
    return styleRules.split("-").reduce((result, word) => result + word.slice(0, 1).toUpperCase() + word.slice(1));
  }

  static handleMediaCrossPage(media) {
    return (evt) => {
      const book = evt.book;
      const aBlankPage = book.pageHeight - book.margin * 2;
      const container = evt.target;
      const containerHeight = container.clientHeight;
      const extraSpaceNeeded = containerHeight - media.clientHeight; //this is the space needed between media and container.
      const minSpaceRequired = evt.minimalPictureSize + extraSpaceNeeded;

      // If space left is enough, we can directly put the image and caption on the same page after resizeing the image. if spaceRequired alreadyt exceeds the space of a blank page, we can do nothing but violate the minimalPictureSize constraint and put the image caption table directly on this page by resizing it.
      if (evt.spaceLeftOnThePage >= minSpaceRequired || Math.abs(evt.spaceLeftOnThePage - aBlankPage) <= 3) {
        book.bookEditor.changeStyle(
          media,
          {
            height: evt.spaceLeftOnThePage - extraSpaceNeeded + "px",
            width: ((evt.spaceLeftOnThePage - extraSpaceNeeded) / media.clientHeight) * media.clientWidth + "px",
          },
          false
        );

        //We need to make sure the next element is not invading the margin after we put the resized image caption table by using the margin-bottom property.(The next element won't be checked for it's position on this page again because the nextPage() is fired here.)
        book._uniformizeMediaOnPage(container, evt.edittingPageEnd);
        console.log("Image caption table resized and uniformized with other media on the page.");
        return evt.index - 1;
      }
      //space is not enough, we need to check the table's height first to see if it exceeds the space of a blank page. If it does, we need to resize it to fit the whole page before we add a filler to shift it no the next page.
      else {
        const filler = book.bookEditor.addFiller(container, evt.spaceLeftOnThePage + book.margin * 2);
        if (filler === null) {
          console.error(`Failed to add media filler to shift media to the next page. At page ${this.book.getPageNum(evt.edittingPageEnd)}`);
          this.book.failCount++;
          content.parentElement.classList.add("Failed_" + this.book.failCount);
        }
        console.log("Image caption table shifted to a blank page by adding a filler. Cross-page has been handled.");
        return evt.index;
      }
    };
  }

  changeStyle(elem, styleRules, isNewElem = false) {
    if (typeof styleRules != "object") {
      throw new TypeError("Argument styleRules should be a style Object!");
    }
    elem = "clientWidth" in elem ? [elem] : elem;
    elem.forEach((elem) => {
      if (typeof elem == "string") {
        for (const style in styleRules) $(elem).css(style, styleRules[style]);
        this._changedElems.push({ cssSelector: elem, initStyles: styleRules });
      } else if (typeof elem == "object") {
        let existingElem = this._changedElems.find((changedElem) => changedElem === elem);
        let initStr = "initStyles_" + this.book.instanceID;

        if (existingElem) {
          // Element already exists in _changedElems, update its styles
          for (const style in styleRules) {
            if (!existingElem[initStr].hasOwnProperty(style)) {
              existingElem[initStr][style] = elem.style[this.toCamelCase(style)];
            }
            elem.style[this.toCamelCase(style)] = styleRules[style];
          }
        } else {
          // New element, add it to _changedElems
          elem.isNewElem = isNewElem;
          if (!elem[initStr]) elem[initStr] = {};
          for (const style in styleRules) {
            elem[initStr][style] = elem.style[this.toCamelCase(style)];
            elem.style[this.toCamelCase(style)] = styleRules[style];
          }
          this._changedElems.push(elem);
        }
      } else {
        throw new TypeError("Target elem should be a DOM Element or a CSS selector(String)!");
      }
    });
    return elem.length === 1 ? elem[0] : elem;
  }

  getStylesheetPropertyValue(element, property) {
    const selectors = this.getAllSelectors(element);

    for (const selector of selectors) {
      // Loop through all stylesheets
      for (let i = 0; i < document.styleSheets.length; i++) {
        let stylesheet = document.styleSheets[i];
        let rules;

        try {
          rules = stylesheet.cssRules || stylesheet.rules;
        } catch (e) {
          console.log("Can't read stylesheet rules. It might be a cross-origin stylesheet.");
          continue;
        }

        // Loop through all rules in the stylesheet
        for (let j = 0; j < rules.length; j++) {
          let rule = rules[j];

          // Check if this rule matches our selector
          if (rule.selectorText && rule.selectorText.split(",").some((s) => s.trim() === selector)) {
            // If it matches, return the value of the property we're looking for
            return rule.style.getPropertyValue(property);
          }
        }
      }
    }

    // If we didn't find the property, return null
    return null;
  }

  getAllSelectors(element) {
    const selectors = [];

    function getAncestors(el) {
      const ancestors = [];
      while (el && el !== document) {
        ancestors.unshift(el);
        el = el.parentNode;
      }
      return ancestors;
    }

    function combineSelectors(selectorParts) {
      return selectorParts.join(" ");
    }

    function generateSelectorParts(el) {
      const parts = [];

      // Tag
      parts.push(el.tagName.toLowerCase());

      // ID
      if (el.id) {
        parts.push(`#${el.id}`);
      }

      // Classes
      if (el.className) {
        const classes = el.className.split(/\s+/);
        classes.forEach((cls) => parts.push(`.${cls}`));
      }

      // Nth-child
      const index = Array.from(el.parentNode.children).indexOf(el) + 1;
      parts.push(`:nth-child(${index})`);

      return parts;
    }

    const ancestors = getAncestors(element);

    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestorParts = ancestors.slice(i).map(generateSelectorParts);

      // Generate all combinations
      const queue = [[]];
      for (const parts of ancestorParts) {
        const level = queue.length;
        for (let j = 0; j < level; j++) {
          const current = queue.shift();
          for (const part of parts) {
            queue.push([...current, part]);
          }
        }
      }

      // Add all combinations to selectors
      selectors.push(...queue.map(combineSelectors));
    }

    return [...new Set(selectors)]; // Remove duplicates
  }

  recoverAllEdits() {
    console.log("Recover all edits of Book: " + this.book.instanceID);
    this._changedElems.forEach((elem) => {
      // check if the element still exists in the DOM
      if (elem) {
        if (elem.cssSelector) {
          // For elements changed using jQuery
          for (const style in elem.initStyles) {
            $(elem.cssSelector).css(style, "");
          }
        } else {
          // For elements changed directly
          if (elem.isNewElem) {
            // Remove elements that were added
            if (elem.nodeName === "SUPPORT") {
              this.removeSupport(elem);
            } else {
              elem.remove();
            }
          } else {
            // Restore original styles
            let initStr = "initStyles_" + this.book.instanceID;
            for (const style in elem[initStr]) {
              elem.style[this.toCamelCase(style)] = elem[initStr][style];
            }
            delete elem[initStr];
            delete elem.isNewElem;
          }
        }
      }
    });

    // Clear the list of changed elements
    this._changedElems = [];
    this.book.contents.normalize();
    console.log("All edits recovered.");
  }

  increaseSpaceByMargin(element, amount) {
    const elementMargin = Math.round(getComputedStyle(element).getPropertyValue("margin-top").slice(0, -2));

    //If there's a previous element before element, compare the neiboring margin values, use the bigger one to add to the increase amount.
    if (element.previousElementSibling) {
      const preElementMargin = Math.round(getComputedStyle(element.previousElementSibling).getPropertyValue("margin-bottom").slice(0, -2));

      if (preElementMargin > elementMargin) {
        this.changeStyle(element, {
          "margin-top": preElementMargin + amount + "px",
        });
        return;
      }
    }

    //If there's no previous element before element, use  element's margin-top value to add the increase amount.
    this.changeStyle(element, {
      "margin-top": elementMargin + amount + "px",
    });

    if ($(element).css("display") === "inline") {
      this.changeStyle(element, {
        display: "inline-block",
      });
    }

    console.log("Space increased by margin adjustment.");
  }

  addFiller(content, fillerHeight, className = "filler", position = "beforebegin") {
    // options: "beforebegin", "afterbegin", "beforeend", "afterend"
    let filler;
    if (content.previousElementSibling?.classList.contains(className)) {
      filler = content.previousElementSibling;
      !filler.failedCount ? (filler.failedCount = 1) : filler.failedCount++;
      if (filler.failedCount <= 5) {
        fillerHeight = parseInt(filler.style.height);
        fillerHeight += 5; // Increase the filler height by 5px each time
        this.changeStyle(filler, {
          height: fillerHeight + "px",
        });
        filler.classList.add("modified");
        return filler;
      } else {
        this.changeStyle(content.previousElementSibling, {
          border: "solid 1px red",
        });
        return null;
      }
    } else {
      filler = document.createElement("div");
    }

    filler.classList.add(className);
    this.changeStyle(
      filler,
      {
        height: fillerHeight + "px",
        "margin-top": "0px",
        "margin-bottom": "0px",
      },
      true
    );

    // Compare margin-top of content and margin-bottom of content's previous element
    let marginTop = 0;
    const contentMarginTop = parseInt(window.getComputedStyle(content).marginTop);

    const prevElement = content.previousElementSibling;
    if (prevElement) {
      const prevMarginBottom = parseInt(window.getComputedStyle(prevElement).marginBottom);
      marginTop = Math.max(contentMarginTop, prevMarginBottom);
    } else {
      marginTop = contentMarginTop;
    }

    // Apply the larger margin to the filler's margin-top
    filler.style.marginTop = marginTop + "px";

    content.insertAdjacentElement(position, filler);

    let nextNeighboringEle = filler.nextElementSibling;
    while (nextNeighboringEle) {
      this.changeStyle(nextNeighboringEle, {
        "margin-top": "0px",
      });
      nextNeighboringEle = nextNeighboringEle.children[0];
    }
    console.log(`${className} added with margin-top: ${marginTop}px`);
    return filler;
  }

  insertSupport(textNode, supportPos, supportHeight, id) {
    const support = this.changeStyle(
      document.createElement("SUPPORT"),
      {
        height: supportHeight + "px",
        display: "inline-block",
        "vertical-align": "top",
      },
      true
    );
    support.classList.add(`support_${id}`);
    const textRange = Book.rangeTool.createRange(textNode, textNode, 0, supportPos);

    textRange.collapse(false);
    textRange.surroundContents(support);
    textNode.parentElement.normalize(); // Normalize the parent element to merge any adjacent text nodes
    let oldSupport;
    if (support.previousSibling?.nodeName === "SUPPORT") {
      oldSupport = support.previousSibling;
      support.remove();
      support.failedCount ? (support.failedCount += 1) : (support.failedCount = 1);
      if (support.failedCount <= 5) {
        supportHeight = parseInt(support.style.height);
        supportHeight += 2; // Increase the support height by 2px each time
        this.changeStyle(support, {
          height: supportHeight + "px",
        });
        support.classList.add("modified");
        return oldSupport;
      } else {
        this.changeStyle(support.previousSibling, {
          border: "solid 1px red",
        });
        return null;
      }
    }
    console.log("support Inserted!");
    return support;
  }

  removeSupport(support) {
    const parentElem = support.parentElement;
    const prevTextNode = support.previousSibling;
    const nextTextNode = support.nextSibling;

    // Remove the support element
    support.remove();

    // Merge the surrounding text nodes if they exist
    if (prevTextNode && prevTextNode.nodeType === Node.TEXT_NODE && nextTextNode && nextTextNode.nodeType === Node.TEXT_NODE) {
      prevTextNode.textContent += nextTextNode.textContent;
      nextTextNode.remove();
    }

    // Normalize the parent element to merge any adjacent text nodes
    parentElem?.normalize(); //Parent element may be absent if the node tree has been modified before recoverAllEdits.
  }
}

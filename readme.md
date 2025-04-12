# Eink Module: Making Your Websites Easier to Read.

## What is Eink Module

Eink module is a front-end javaScript module for web designers to quickly apply a responsive web design (RWD) for E Ink devices, making the user experience better on E Ink devices.

Eink module make your website looks more like an eBook and make immersive reading on the web possible.

Though it's originally designed for E Ink device users, this module can enhance the **reading** experience on your websites better for ANY devices.

### Main Features of Eink Mode

1. **Paginated** rather than scrolling overflow of web contents.
2. Easy text-resizing and readibility is maintained after resizing.
3. Highlighting and annotation tools.
4. Immediate writing with stylus and pressure sensitivity support.
5. WYSIWYG printing and PDF saving.
6. Rich gesture support.
7. Rich keyboard shortcuts.
8. Support [EinkBro](https://github.com/plateaukao/einkbro) E Ink browser.

To better catch the spirit of this module, you can see a thorough explanation of this module and also a live demonstration at my blog:

## How to Use This Module

1. Download the scripts and upload them to your web server or websites.
2. Reference them with `<script>` tag in the `<head>` section.

```html
<head>
  <script src="Book.js"></script>
  <script src="Eink.js"></script>
</head>
```

3. Initialize Eink by make a new instance of Eink class and call `init` method, this will give you an `eink` button for users to click and enter Eink mode. (This also enables the swipe left-to-right gesture to enter Eink mode.)

```javaScript
const eink = new Eink();
eink.init();
```

4. You can customize the position of the eink button by 3 ways:
   1. Make an element with class "einkBtn", the eink button will be "append" to it.
   2. Use `setupEinkBtn` method to adjust the position of the button.
   3. Directly use CSS or javaScript to control its position.  
      </br>
5. Now you can add CSS styles to adjust the display and look of your websites under Eink Mode by simply using the `@media` CSS media queries with the media type `eink`. These styles will be rendered only when the users enter Eink mode. Therefore you can keep 2 different styles for your website, one under scrolling mode, one under paginated Eink mode and you can manage these styles very easily.

```CSS
/* Styles under eink mode */
@media eink {
    .main_section {
        --display: mainbook;
        font-size: 16px;
        color: black;
    }

    #article {
        --display: book-content;
        margin-top: 0px;
    }
    .svg-14 {
      --display: book-UI;
    }

    .figure {
      --display: book-Item;
    }
}

/* Styles under scrolling mode */
.main_section {
    display: block;
    font-size: 14px;
    color: #512e5f;
}
```

## Eink Specific CSS Properties

### --display

The `--display` property is quite similar to the `display` CSS property. The main feature of Eink mode is to **display your website in a paginated fashion** rather than scrolling, so there's a display style called **book**. You can specify the main content of your website to be displayed like a book by giving it the `--display` CSS property with values `mainbook`. And also you can make other sub-sections or elements to be displayed in a paginated manner, just giving them the `--display` property with the value of `book`.

There are 5 keyword values for this property, the main difference for these values are listed below:

- **mainbook**
  mainbook is used to display the main content of your webpage (the main view). Users can enter scroll mode by swiping from right to left "only" when the focused book is mainbook. (Or when they press the Esc key.)
- **book**
  book is used to display the sub-sections or other elements that you want to be displayed in a paginated fashion. When users swipe from right to left or press the Esc key from the view of any book, they will return to the view of mainbook.
  </br>

> [!IMPORTANT]
> Please assign **the closest container of the main content** on the webpage as **mainbook** or **book** as possible. That is, try not include any layout structures or elements that are not relevant or not displayed such as \<script> \<style> in the book. This will improve the overall performance of this module and make it work as expected.

> [!TIP]
> If there are several sections on the webpage, such as \<aside> \<header> \<footer>, display them separately as different books (windows) and navigate these books by UI or gestures will enhance the immersive reading experience.

- **book-content**
  book-content is the contents of the book. It is the target to be re-arranged in a paginated fashion. If not specified, the default content will be all elements contained in the book and most of the time you don't need to specify an element to be the book-content.</br>
  If you don't want some elements to be re-arranged by the paging algorithm and thus be turned out of view when the users turn the page, you can specify the content element by this value and those elements **not** contained by this book-content element will be fixed on the book's page. (Similar to the effect of CSS display: fixed.)
  </br>
  > [!NOTE]
  > Book-content must be the **direct descendant** element of the book element.
- **book-item**
  If you want an element and its descedants to be regarded as a whole to be re-arranged by the paging algorithm, that is to say, you don't want them to be broken by the page, you can assign the element to be a book-item. It's similar to the CSS "break-inside: avoid", but the main difference is that when you have a picture or a video in the book-item, these media will be **resized** to make the whole book-item element fit into a page. This is especially useful when you have a picture with a caption and you want them to fit into a page as possible.
- **book-UI**
  If you want clickable UI elements within a book to be clicked without page-turning (which will be disturbing for the users), simply assign them as book-UI can prevent the default page-turning action of the book.

### Book Config CSS Properties

The below CSS properties will work only if you write them in the same CSS rule with `--display: mainbook;` or `--display: book;`. These properties are used to configure the book.

### --contents

Same as the `--display: book-content;`, but you can specify the contents of the book more directly.</br>

- `value`
  CSS selectors or DOM elements.
- `default`
  All elements contained in **book**.

### --upperMargin, --lowerMargin, --leftMargin

Specify the page margin of the book. There's no `--rightMargin` because by default it will be the same as `--leftMargin`.

- `value`
  \<length> CSS data type.
- `default`
  30px.

### --fullScreen

Specify whether to display the book in full screen.

- `value`
  Boolean
- `default`
  true

### --useContentTable

Specify whether to auto-generate a content table for this book or not. For more detailed explanation, see the [online documentation](#online-documentation).

- `value`
  Boolean
- `default`
  true

> [!NOTE]
> Content table will be auto-generated only when there are more than 3 headers in the book even when this property is true.

### --useNote

Specify whether to auto-formatting the footnotes. For more detailed explanation, see the [online documentation](#online-documentation).

- `value`
  Boolean
- `default`
  true

> [!NOTE]
> Footnotes will be auto-formatted to the footnote section only when there are footnotes written in the specified format in the book even when this property is true.

### --bookTitle

The title **header** of the webpage or website. This is used for the title of the highlight notebook. And when you use content table, this header won't be included in the content table.

- `value`
  A header element.
- `default`
  The first \<h1> element in the webpage or website, if no \<h1>, \<h2> instead, etc.

### --author

This is used for the author name in the highlight notebook.

- `value`
  String
- `default`
  ""

## Online Documentation

To fine tune the Eink module for your website, there are APIs for Eink class and Book class. The usage of the APIs will be provided and documented in the online documentation. (Now the documentation is under construction, please wait and coming soon.)

## Support This Project

If you like this project. You can support this project by giving feedbacks, being a contributor to this project or by donation.

If you succesfully apply this module to your website and your website is public, please share it with me. I will be glad to see the project works well.

For any suggestions, feed backs, please email me at jacks101311@gmail.com
</br>
</br>
[![Please support this project by dontation](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/jack101311)

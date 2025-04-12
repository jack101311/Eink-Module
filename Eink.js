/* Copyright <2025> <Chia-Wei Liu>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

class Eink {
  mainBook = undefined;
  manual = undefined;
  controlPanel = undefined;
  mode = "scroll";
  lang = "zh-TW";
  isEinkDevice = false;
  inIOSBrowser = undefined;
  preventGestures = false;

  #touchStartX = 0;
  #touchStartY = 0;
  #fontSizeChangeComplete = true;
  #activeTouches = [];
  #bookSelectors = [];
  #mainBookSelector = undefined;
  #contentSelectors = [];
  #uiSelectors = [];
  #itemSelectors = [];
  #einkRules = [];
  #totalFontSizeChange = 0;
  #fontSizeAdjustment = 0;
  #maxIncrease = 10;
  #initialDistance = 0;
  #targetBook = null;
  #mousemoved = false;
  #popupTimeout = null;
  #longPressTimer = null;
  #firstShortcutKey = null;
  #longPressDuration = 300; // Duration in milliseconds for a long press
  #startTouchesNumber = 0;
  #loading = false;
  #defaultStyle = `
  html {
    touch-action: pan-y pinch-zoom !important;
  }

  #einkBtn {
    margin:0px !important;
    padding: 2px !important;
    font: 12px Roboto, sans-serif !important;
    font-weight: bold !important;
    float: right;
    border: 1px solid red;
    border-radius: 40% !important;
  }

  .inactiveBtn {
    opacity: 0.5;
  }

  .activeBtn {
    box-shadow: 1px 2px 2px gray;
  }

  .activeBtn:hover,
  .activeBtn:focus {
    color: blue;
    text-decoration: none;
    cursor: pointer;
  }

  .noteBook .highlight-title {
    border-radius: 10px;
    margin-left: -10px;
    padding-left: 10px;
  }

  .noteBook {
    font-size: 18px;
    line-height: 1.5;
  }

  .noteBook li {
    margin: 10px 0px;
  }

  .noteBook h1, .noteBook h2, .noteBook h3, .noteBook h4 {
    margin:20px 0px;
  }

  .noteBook img, .noteBook iframe {
    vertical-align: top;
    max-width: 100%;
    max-height: 100%;
    height: auto;
    width: auto;
  }

  .noteBook .web-address {
    font-size: 12px;
  }

  .disable-default-touch {
    touch-action: none !important;
  }

  .modal {
    display: none;
    position: fixed;
    z-index: 99999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.4);
  }
  
  .modal-content {
    position: absolute;
    background-color: #fefefe;
    padding: 20px;
    border: 1px solid #888;
    width: 300px;
    text-align: center;
    border-radius: 5px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    box-sizing: border-box;
  }
  
  .modal-content p {
    margin-bottom: 20px;
  }
  
  .modal-content button {
    margin: 0 10px;
    padding: 10px 20px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }
  
  #confirmYes {
    background-color: #4CAF50;
    color: white;
  }
  
  #confirmNo {
    background-color: #f44336;
    color: white;
  }

  .draw {
    position: absolute;
    left: 0px;
  }

  .floatToolBar {
    position: fixed;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    right: 5%;
    z-index: 9999;
  }

  .toolDiv img {
    border-radius: 100%;
    border: 1px solid red;
    pointer-events: none;
    width: 38px;
  }

  .toolDiv div {
    width: 40px;
    height: 40px;
    border-radius: 100%;
  }

  .toolDiv {
    display: flex;
    background-color: white;
    border-radius: 100%;
  }

  #picViewer {
    position: fixed;
    top: 0px;
    left: 0px;
    z-index: 500;
    background-color: white;
    display: none;
    width: 100%;
    height: 100%;
  }

  #detailView {
    position: relative;
    border-bottom: 5px solid red;
    overflow: hidden;
  }

  #overview {
    position: relative;
  }

  #magnifier {
    position: absolute;
    border: 1px solid white;
  }

  #closeViewer {
    position: absolute;
    right: 5px;
    top: 5px;
    width: 20px;
    line-height: initial;
    text-align: center;
    z-index: 100;
    background-color: white;
    border: 1px solid yellow;
  }

  #closeViewer:focus,
  #closeViewer:hover {
    color: blue;
    cursor: pointer;
  }

  greenmark {
    background-color: rgba(0, 255, 0, 0.33);
  }

  bluemark {
    background-color: rgba(0, 0, 255, 0.33);
  }

  redmark {
    background-color: rgba(255, 0, 0, 0.33);
  }
`;

  onEnterEink = () => {};
  onEnterScroll = () => {};
  onSwitchMode = () => {};
  onenterhighlight = () => {};
  onexithighlight = () => {};
  onenterdraw = () => {};
  onexitdraw = () => {};
  manualItems = [
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjYk8GwZ8PYK8HySK5f9odf9KFtjvO0FF7EtDCjyGZH68UOozlax5tp9enYlmyy5zuKjB4s4aS7gG0EuaqG1D42giRmaY8wjFefjAEqy25AVbQfA2goWECkOkwEsAYxq6h_CbF4FmgPv9eH66rfw-kYS0HQSiLkmPPY_YjPfCZqNvqxLbQEXqIuQ92K/s1600/My%20Icons.001.jpeg",
      text_ch: "上下頁",
      text_en: "Prev/Next page",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhXkkLY_Fa4L9o0mihyphenhyphentMn9Vh2zg4DHxhv4sWE5Xn87-I4oOapZaOSgplqj-3QMN32otIXxTGPa1MSF64t92rn8XrAeZYYEPZTN_Ce1vLxHZsn3wILu1e5mYYVWp6EmMN96Ikn4O5uGFrXDUNlm37giUwcHNt11GedxgaptzRdRZHs8mcZ2UMmPxuVW/s1600/My%20Icons.002.jpeg",
      text_ch: "跳至頁首或頁尾",
      text_en: "First/Last page",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjTczCkhjunJZ-YYzFqM5lfMvple9hOcbV-kq9TYXc42xlXwjlA39UAcDhicKyBJHliWLXu990ZuF1Wu9_f8sd_BTWe5sWscAsrt-_q0nbGlivKbPxHCKbhL2CVmnxoCXlHszAY77MjNGWVt2R6hfRMf_m4SZ4LL3nfInIRcYpeDX39PNawQTy2y2kX/s1600/My%20Icons.003.jpeg",
      text_ch: "跳至目錄",
      text_en: "Content Table",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhLUDauFfSLelk-D3iw1w0WhRK5xITT39qhz4lvMSLVYO51telsPREjLsvn15lObbgh_0WIwaFJ1vAZ-PGpfa2yD1krwcfPNKFKAESPI41ii-MB5Us5HcKwUQzjzAieaSU-8CSxHvSsrp9w2WXica1B7V3Y35TWYGt5A4F4VXaYRwXBzzMqeKLLbox5/s1600/My%20Icons.006.jpeg",
      text_ch: "功能選單",
      text_en: "Tool menu",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhYAIeHUu4pp_wj5pNkqkUzeSWqeSEphV2oVFHSAqvmLcY6bowCX0Elkbf3D9ZiOlFusHk_Dgc1S0YXJLANIQDf_-RyCcGKmzLH_mU_o2aANS7P753SiqEf7drhk30s-WqoUcshwKO8jvbNrBow6SCQ1pVQlhzUmGBy-YcAMFcIZKEVyY4A6WtH4ZoW/s1600/My%20Icons.005.jpeg",
      text_ch: "螢光筆工具",
      text_en: "Highlighting tools",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhu1U1dTJNXOIt18alwwMVzDFN_vQn9y-_rztf0nHk_mzx4QVKaJ6n3BgxF8r4MAgk5TjEFqNPpC_KSnWxz8JmSmqj0jOjRrqTfReZoPWf4vQ2O0Vtt3DFddhfXzYa_L-G_h4gARFzVOzJ9PLBWZsHj0XQRBrNVyBxDZMXP7Hp5P_o5mT7g6_ie8Xcc/s1600/My%20Icons.004.jpeg",
      text_ch: "繪圖工具",
      text_en: "Drawing tools",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhRehc5pJOlN5BFufdPdefTQJY56I1FqgwTRvsPToiuE_trB1tfmf9rlwpeMianuy9L9vzVzKtqm-cWqgayMwTOQ1BOXTsK2XIuZa1VfjBy654KNPeiE4HnQRxLS4bhY-sPgAkkuoUTOog8WMctdNmh0gvRhyTwhwtMgp4cCbE-sMCWrvLBHfX9gxSH/s1600/My%20Icons.007.jpeg",
      text_ch: "回滾動瀏覽",
      text_en: "Enter scroll mode",
    },
    {
      imgSrc:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiHQnh2Mws6rKlrgqjijo9TRU0AJMBrM5W238if9z6hox_j_x1iBSDP_5DwSN61Csh_JY2jRifm8jxePqNgIfLkz441EXJuFJualCb-4uj0Hnz6PXIFWwDOptOaWxYFY-xKyx1TYRji4umD7sF-qzaD_xvp5PMqE37ZjNMBWkbANU6gXcc5p3BhM_gV/s1600/My%20Icons.008.jpeg",
      text_ch: "支援藍芽翻頁器",
      text_en: "Page turner support",
    },
  ];
  toolBarIconSrc = {
    info_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgP18Ftd5a_6yfz1gKM7GhcZ_8_rdvxZndC_ovXMxGX4i7SpNMJK8qQdlEjoXMTReGfgc6K6Y8sQkHfXO4-4Bjvb2PxyavybuynaHx1jdBThyr11dwWL32tFoztv3TblpMvkeASTEsUyLr9zXjW7Ig7yMGv1SwslB2Vy10DPtXsm6BCIUDZsbli3IJ7/s1600/My%20Icons5.001.png",
    exit_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhJqJfPLeoAgrJhcKsizMtPgBFKF8QTH7gGehvI2HUVIfcM60YbrhxpkU19DLFTx9VbMGALhm9B0hRFxj214f8uzR__oDGCOnzjeumHDTjsI03RL7H073mVUCppp7O0_EzJICF8tdgeLrynGoX44uyYk34i0btTP9feWsIPHEXesgUyHvdwspixs49t/s1600/My%20Icons4.001.png",
    selection_erase:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiJk_5KhyL_DilHxz5jPaIQG1A4PyBmoZFso7DDUkGrByAW1S-3nQhXiZz9_XcK5v7jdkoq4lD-F32ZgjI6CK-QEHf70OtxWGgAf7prl5Ic03unI4s1W6CVAzot9ckPI20EWHZ_AHYfscDgrsrfIczaV0NJe4c8E2W-oCoqaxfDALSCfIUuanzkJVk3/s1600/My%20Icons3.004.png",
    printer:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjtiFUtWjuIH3FVR4cngQDnCWwhpMORu3YH65mJF-bzeWgqAyGjALToAPI9YmFWBnrQgl4D0CGteZdBtwSRXcbxD4xzGg7vLqeS91tdodyW_Sn7oTP-TXuwvqlw6lNpKYpwgDjWbkCVrt36DMQ1AGP-WDGydAglMFtYd-5WFoAGaPoCGp-MiZ3yyYNm/s1600/My%20Icons3.003.png",
    scroll_mode:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhay__pRQG8aRwUI54PEwe9gSddm4yF7Uq-67TJml-R6scnopk3HEw6WQbEkC6KjsPybqd9OxM98-2InaW6OJRDJAZNuq1c6oha36RoTnmgdoB6LXclkWMBs22Yu4s2roGIrBMgUF4ITvUb0DbZ080yHz7Iisgstpyxg_5782fu3Idutlw40MbtxRFs/s1600/My%20Icons3.002.png",
    content_table:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjogD1ZGFzyRGEJCVabZB98KSIEQUPiD6eSTcSKH0MMB1edlvYSmv-4g-lpPk85XsMBBF3AMyPKVpgjrNecROrKyHuz5E5RXDgXk5uPVVOeRY0wJki2Fvwo5xV8RAAhRtR6WyTZ8WHY1lKIqZruCRzUB9A7MXV1bsGvwDXimQBJWcD3VGvcHagrOkcT/s1600/My%20Icons3.001.png",
    flip_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj1kotoDrHoSmTW3hvvqdKo3k_f_3fV9P3jwgRb5ec-RbrY-lqd41PSxJzZdwcK2BO7HDAvGiIe7BzQ3NDXMmDhYgYB2NIrAU771yymFvxQWrbFInsOPtu93xJvmeNXq0EakCmKovtz0BcGeI4XbphxhzHpeO6hrOZDSu8tPfHPQJM723PkICc1wgev/s1600/My%20Icons.020.jpeg",
    eraser_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgU7tW-aiB4rFaDiSNz0q8dC-D6jNZFxqGVE-P3pcTWSt4opKQ0dmdMohk5OTZjjRGva-LW06grfMT37RHBQ3TkLEqtcgBwqSM3If9LsBCD_7jlSdM5MqSKKnhwTewMQeiWqaoge5slglV7RRZKhht9u-63FbTnBdfvQ41MeGzXLQAEOQmxQI6sg9c1/s1600/My%20Icons.008.jpeg",
    heavyLine_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhZqSpDjs_uk160FGJryo69_QcEJCHfhxQXmW0h4UPpmzNssttKT448uYKAr7USzrT-nwx-5dOhWuDgn3u_Xcb96AADvuf9W4Yz1jq_NF75Vy3rJSo7WPAC3Edd2xIBKU5Dwzauo16MgrstlangVRA-lXkR-nrh_RK_0UMeZR813aQyg9GEpj7xltVJ/s1600/My%20Icons.015.jpeg",
    mediumLine_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhQrdtp5hUWIUBUyuc2Y0WdzD37hR8NFAC6XG6PTqlcLUEqKgvckUZovBVMkAougZY_hru3Rika2KHXKly_ls7I2EA-GmDzFv8LAqkE9EwKd-y48cqFrMfNlE4nXC3rkTf60ZbYQnyrGnkqTpWIZIvkd7lSKSmDvsaaxGtIOckRTmcVPhqdrPoy9hGG/s1600/My%20Icons.014.jpeg",
    lightLine_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEinezMz8j9WXdWxXYR3ev5oPNXHCW2mcBI6yyYO2eofWus52XU_Mj5RRMZZ_xRco4x-JKGTTZkcbVOy71R5T2tWyL2H1CAByjqgwU149QSJ4fonaf11HKELg4b-zqvSDwOdS9hCiB4dCHK4_U0ws8FD4otugvpdBc_sMQePtrcrCbsooi1a1NPs0wZM/s100/My%20Icons.013.jpeg",
    pencil_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh0l38bY6cQKWWmradQWMdqSt55uWbY6MZ0kM4ZmmFDRnQjLETvJwKR9Da2RxCE44MAI0m3Zl2GAj2njeLxP8gJYfyAUH_bWpgfuqy5DIEgOyz4ovUS3JVVFIaChpXE8yQ21k6M-FwySEZZNYO9WwjUoKgh3c0msCkJUKesbyvGUPsF72C12wj0MTnd/s1600/My%20Icons.005.jpeg",
    eraserActivated_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgsvPPvsXzWTvV7MmdfGbLU1439YX8DjB3Axei-wPY26DuGdtc2Q0XljyA8LjonIZvquqOxJWv8PIbN-qcDaC0zFxGKpE1POCVs-Cir_kXm7vfEnepBtdPh9PWIu2sdKp5CJBn4YVDD0w5VKMxxr_IiX5NPkjiN0jUeoP3MJ96gKfsRnFwe-HzcbFyS/s1600/My%20Icons.007.jpeg",
    pencilActivated_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgY5od-TTYNXaRAu-n9lDf1TPmZ-0PYDeB-VhciHTOM-JzK_oO7qRC9Kwyueaq3dg3oGtX8pUescVAWopLQ3FcvT8Gc0RcKXy7NfvpIo395d1cAJ_ThVxw8lBwlWRAKaO5Yq-Qz7VIt-58GmXdZjx1VjQebtYCsKvICIa0ZO1_FeXjVDighgF8jQgtd/s1600/My%20Icons.006.jpeg",
    greenMarkPen_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiNOAtaDrDO6F1mBJZ5AF0foCHgbDe22SJdox6X_FK9CJ8lHOUPKTRX5h3tjpZCP-SwUaU7q2DLFofWtvgIHvtANp4wBI0kHSgW1g-MUW7V1GxCfPoar7qAz8ampfJDB9bJd5tWdDH_6BE9hyphenhyphenrEmF5KMnq0fnhnvCbp3zGRq7yNhDG20LAxUN9Uxv6A/s1600/My%20Icons.010.jpeg",
    blueMarkPen_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEimGCz8aeQmFpbyxuTYChl4HN_vSLepXG2ngl6AhrjgRlPL8ZtOiP35DKNwCqFiJoaPS92ut5QkWIBNxEVmMFadvfu83EXctRcn61P02to-SISW8O-4xKMBzwc016UcEqMbjrW9qRvob8WhyirBhHbga85RDW59zW7bmRGOpr2VKLzeksVKOwvuDvsW/s1600/My%20Icons.011.jpeg",
    redMarkPen_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjhQXNCMDZlsUrYMwywsIsswJAqwU20EVpBvIa_gc_LypxaNSrVO51Uiqi_GlL26Llv8cQhSCzzTfpu9E8PN4I-MdVq01hg79kYArmUifgEC9N8XueQ0iMc-WSIRJezOMvQ_PgRgIJVfM2fkmDD9AaeJ61m1UsasZMspiwZMPx1qjnypB1sokcFjM2n/s1600/My%20Icons.009.jpeg",
    close_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqGBBfx8c5PnhZkJeAF678yHAWKxbIUtNDULXH0PAtAg7V3fxPFv7afUOaIEf0l0b3JEukZ-RlI8wfaBclSSEYRGonJbrL-kc8ANIDH9W_4bR3oQQS1RG6i8uAlBMNrMeTxldz_7sKydDFjOaH3h_R4Rp1wb9MjVBoKqD2fiivuNC3dUxoW4a2eWZv/s1600/My%20Icons.012.jpeg",
    nextPage_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh7GTkmp8QveImSeIlK8DzRTd0SYWConssaCyeB7pUY1ugxoV0LhPjeGR5sF5juP8faOPkEL2SMs0LnaqSmhSV0QOn0R-tRbdM1HPcrOwi-WQb89BwGgybAw3IXLIuW-ZJLRvXNV4hnjsrubnfazhyukLwcdckOnzez0y5XvCXio0ekpSzlTNjQTK9r/s1600/My%20Icons.001.jpeg",
    prevPage_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgf4dLbiKEWds8l6agI7QWrp8epc16uUb7ext3FyJjhfcAlq6izeH93DCe-AArSfG3LKCGmRJkz8ZHDii_na1PcfcShsnBYfCUWWJe2UxFC59-W8bdk-iD0w8e68mCTAjmkJNLYGJ4JcLdjcAZxcF8mJZ6bS5qH40LaO7OomgDsG4FLp7R021k_kwAa/s1600/My%20Icons.002.jpeg",
    eraser_cursor:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEipeXg__4_sCbV2dXUNojNHt1QX1SC-WiRcF0gEWwsu0ONRqgAT1oC9NqRU00TB0DS3vimHgYjzm4V-9R4X9__xRV0bRk5j1IwfPaFkmHyFH-Z2po49jS_NsaGTieTScUj7lA8dISWLp4j5ennGv_4xU_JdhgjjXdiqyIDNI7SRdv3aF7tuQYk8kpIU/s1600/My%20Icons1.011.png",
    noteBook_icon:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj9f7nzG3Ajy-QmPAOYPxieJTpqG2NZI_ns6ff54xixHhTbWw53vy3cYi5V0qgx9UAtFC76Oeop7UATqio8miLJmbz8hNxNFB_W-ABtywizm2JJcenpfGENsCbnZtTMPqRjwpLYKedYyiCPZPhMJJK78lHWla5IBwglBBdc2gYGblGrpKVAiohyir9U/s1600/My%20Icons2.001.png",
    increaseText_disabled: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg0zCl1N4df27_Zu_FbmTehe474Z3p2tYf3Vl3AIqukijElJNIsCl6EnnSmRUwCTBnlbjNcrlNJBjzA2x22F_x6bb3CTDVc3hLMFncbG4reQ7mp8H8uvzLWBT3D9Wqq17VoSuAqEdm7hw/s200/Icons.002.png",
    increaseText_enabled: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhGogFFCYWS2k_Hr2bYZQp3Vt36O-3kVUlnSK758Qon7mLhBpqADpL6h16B7ZU8r1u906cXMl4PGwyVyvMIVbmWTZSFy_9Oe4PFdgq6IAeQsYWGR9d2bC5gcpAsOcLTmk6TmE8Fq3roWg/s200/Icons.001.png",
    decreaseText_disabled: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgigG2M2hO3UhFmHW0lMuqcJWp1xLA_PUqS5mBu1V0_45jUjEuBEmiXQMLwxqcQKbVVdRKLa88_ixO5ObMwj0_TitNM3-doOmbwH8sQcXud-24zHEKEqdA6l9nSyJ4mG5deegiImMi0Vw/s320/Icons.004.png",
    decreaseText_enabled: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhDkiKmL3wwNJSXW4lPrAa9xJSLkKR68Lf9qxxu5_S_Z0wwIkkNwH0XY2mH_CL6S5fuQDwVudm7BrZ0y8KSKzYNOAPD4FC_OfjA7m2wiDSobwBRLpHuR1KAHlB9ghljP-vGnv-muujwcw/s200/Icons.003.png",
  };

  // Eink config properties
  autoLeave = false;
  autoEnter = false;
  einkStyle = "";

  /**
   * Creates an instance of the Eink class.
   *
   * @constructor
   * @param {Book} [mainBook] - An optional Book object to be used as the main book for this Eink instance.
   * @description This constructor initializes the Eink instance with a Book object.
   *              By default, a Book object is created using the document's HTML element
   *              for both the container and contents. If a Book object is passed as an
   *              argument, it will replace the default Book object.
   *              The Book object represents the main content to be displayed and
   *              controlled in the Eink mode.
   */

  constructor(configObj = {}) {
    const defaultConfig = {
      lang: undefined,
      mainBook: undefined,
      einkStyle: "",
      autoEnter: false,
      autoLeave: false,
    };

    configObj = { ...defaultConfig, ...configObj };

    // Extend the Book class's prototype bookConfig properties for Eink
    Book.prototype.bookConfig.allowDraw = true;
    Book.prototype.bookConfig.allowHighlight = true;

    if (configObj.lang) this.lang = configObj.lang;
    else document.documentElement.lang.includes("zh") ? (this.lang = "zh-TW") : (this.lang = "en");

    // Find All selectors of Book Class from Eink media queries
    this.#processEinkMediaQueries();

    // Add class to book contents, book items and book UIs
    this.#contentSelectors.forEach((selector) => {
      $(selector).addClass("bookContents");
    });

    this.#itemSelectors.forEach((selector) => {
      $(selector).addClass("bookItem");
    });

    this.#uiSelectors.forEach((selector) => {
      $(selector).addClass("bookUI");
    });

    // Create main book
    if (configObj.mainBook) {
      this.mainBook = configObj.mainBook;
    } else if (this.#mainBookSelector) {
      const bookContainer = $(this.#mainBookSelector[0])[0];
      if (bookContainer) this.mainBook = this.createBook(bookContainer, this.#mainBookSelector[1]);
    }

    if (!this.mainBook) this.mainBook = new Book(document.body);

    // Create other books
    this.#bookSelectors.forEach(([selector, rule]) => {
      const bookContainer = $(selector)[0];
      if (bookContainer) this.createBook(bookContainer, rule);
    });

    this.mainBook.eink = this;
    this.floatToolBar.book = this.mainBook;
    this.autoLeave = configObj.autoLeave;
    this.autoEnter = configObj.autoEnter;
    this.einkStyle += configObj.einkStyle;
    this.inIOSBrowser = (() => {
      // This code is used to detect if the user is using an browser in iOS OR *** Safari in Mac OS.***
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      console.log("User agent: ", userAgent);

      if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return true;
      }

      // iOS version 13 and above detection (iPad on iOS 13 can report as a Mac)
      if (/Mac/.test(userAgent) && !userAgent.includes("Chrome")) {
        return true;
      }

      return false;
    })();
  }

  createBook(container, rule) {
    const bookConfig = {};

    // Get the bookConfigProperties from Book.bookConfig
    const bookConfigProperties = Object.keys(Book.prototype.bookConfig);

    // Read custom properties from the CSS rule
    bookConfigProperties.forEach((prop) => {
      const cssValue = rule.style.getPropertyValue(`--${prop}`);
      if (cssValue) {
        // Convert the CSS value to the appropriate type
        if (["fullScreen", "allowDraw", "allowHighlight", "useNotes"].includes(prop)) {
          bookConfig[prop] = cssValue.trim() === "true";
        } else if (["upperMargin", "lowerMargin", "leftMargin", "rightMargin", "zIndex", "minImgHeight"].includes(prop)) {
          bookConfig[prop] = parseInt(cssValue, 10);
        } else {
          bookConfig[prop] = cssValue.trim();
        }
      }
    });
    if (bookConfig.lang === undefined) bookConfig.lang = this.lang;
    console.log("Book Config:", bookConfig);
    return new Book(container, bookConfig);
  }

  init() {
    console.log("Initializing Eink");
    this.setupEinkStyle();
    this.#preloadIconImages();

    document.documentElement.classList.add("limit-default-touch"); // Prevent default pan-x behavior of browser to trigger pointercancel events that hinder the touch gestures to capture the clientX and clientY coordinates in "scroll mode".

    if (this.autoLeave) {
      this.mainBook.onBookEnd = () => {
        this.enterScrollMode();
      };
    }

    this.#setupManual(this.lang).then(() => {
      this.#setupListeners();
      $(window).on("keydown", this.#setupKeyboardShortcuts.bind(this));
      this.setupEinkBtn("fixed");
      if (this.autoEnter) {
        if (sessionStorage.mode === "eink") {
          this.enterEinkMode();
        } else {
          sessionStorage.mode = "scroll";
        }
      } else {
        sessionStorage.mode = "scroll";
        // Clear the saved page data when autoEnter is false
        this.books.forEach((book) => {
          sessionStorage.setItem("pageNumBook" + book.instanceID, "");
        });
      }
    });
  }

  get noteBook() {
    return $(".noteBook")[0];
  }

  get bookContainers() {
    return [...$(".book").filter((i, elem) => elem.book !== undefined)]; // Use this specific rule to filter out coincidence.
  }

  get bookContents() {
    return this.books.map((book) => book.contents);
  }

  get books() {
    // The books array are sorted by instanceID in descending order for that Book Editor's recoverAllEdit can recover the document to it's original state by the same route (order) that it's modified.
    const books = this.bookContainers.map((container) => container.book);
    return books.sort((a, b) => b.instanceID - a.instanceID);
  }

  static getIconImg(iconId, newID = undefined) {
    const img = document.getElementById(iconId).cloneNode(true);
    img.removeAttribute("id");
    if (newID) {
      img.id = newID;
    }
    return img;
  }

  #setupListeners() {
    const eventHandler = (handler) => (event) => {
      if (!this.#loading) {
        handler.call(this, event);
      }
    };

    $(window).on("pointerdown.eink", eventHandler(this.#handlePointerDown));
    $(window).on("pointermove.eink", eventHandler(this.#handlePointerMove));
    $(window).on("pointerup.eink pointercancel.eink", eventHandler(this.#handlePointerUp));
    $(window).on("keyup.eink", eventHandler(this.#handleKeyUp));
    $(window).on("beforeunload.eink", eventHandler(this.#handleBackNavigation));
  }

  #removeListeners() {
    $(window).off(".eink");
  }

  #setupPrintListener() {
    // Setup printing
    $(window).on("beforeprint.print", () => {
      this.enterPrintMode();
    });

    $(window).on("afterprint.print", () => {
      this.exitPrintMode();
    });
  }

  exitPrintMode() {
    if (!this.#loading) {
      Book.focusedBook.exitPrintMode();
      console.log("finish printing");
    }
  }

  enterPrintMode() {
    if (!this.#loading) {
      console.log("prepare for printing");
      const focusedBook = Book.focusedBook;
      console.log("Enter print mode: Focused book: ", focusedBook.instanceID);
      this.setupEinkStyle(
        `
          @page {
            size: ${focusedBook.pageWidth + focusedBook.bookConfig.leftMargin * 2}px ${focusedBook.pageHeight + focusedBook.bookConfig.upperMargin + focusedBook.bookConfig.lowerMargin}px; 
            margin-top: 0px;
            margin-bottom: 0px;
            margin-left: 0px;
            margin-right: 0px;
          }
        `,
        false
      );

      // Exit other eink modes before printing
      if (this.mode === "eink.draw") {
        this.floatToolBar.exitDraw();
      } else if (this.mode === "eink.highlight") {
        this.floatToolBar.exitHighlight();
      }

      $(".floatToolBar, .manual, .controlPanel").hide();
      focusedBook.enterPrintMode();
    }
  }

  enterEinkMode() {
    console.log("Entering Eink Mode");
    this.manual.show();
    this.mode = "eink.read";
    sessionStorage.mode = "eink";
    this.setupEinkStyle();
    $("#einkBtn").hide();

    if (!document.getElementById("controlPanel")) this.setupControl();
    document.documentElement.classList.add("disable-default-touch");
    this.#setupPrintListener();

    new Promise((resolve) => {
      this.books.forEach((book) => {
        book.enterEinkMode();

        book.addEventListener("pagechange", () => {
          $(book.container).find(".draw").hide();
          $("#" + this.painter.getCanvasId(book)).show();
        });
        book.addEventListener("bookresize", () => {
          $(book.container).find(".draw").hide();
        });
        book.addEventListener("bookreset", () => {
          $(book.container).find(".draw").hide();
          $("#" + this.painter.getCanvasId(book)).show();
          if (this.floatToolBar?.submenuOn) this.floatToolBar?.toggleSubmenu();
          this.floatToolBar.repositionFloatToolBar();
        });

        $("#" + this.painter.getCanvasId(book)).show();
        if (document.readyState !== "complete") {
          book.ignoreMutation = true;
          console.log("Book's mutations are ignored while the page is loading");
          document.addEventListener("load", () => {
            book.ignoreMutation = false;
            console.log("Book's mutations are now enabled");
          });
        }
      });

      resolve();
    }).then(() => {
      this.manual.ready();
      this.onEnterEink({ books: this.books });
      this.onSwitchMode({ mode: "eink.read", books: this.books });
    });
  }

  #processEinkMediaQueries() {
    // Iterate through all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const styleSheet = document.styleSheets[i];
      try {
        // Iterate through all rules in the stylesheet
        for (let j = 0; j < styleSheet.cssRules.length; j++) {
          const rule = styleSheet.cssRules[j];

          // Check if the rule is a media query for Eink
          if (rule.media && rule.media.mediaText === "eink") {
            this.#einkRules.push(rule);
            // Iterate through all rules within the Eink media query
            for (let k = 0; k < rule.cssRules.length; k++) {
              const einkRule = rule.cssRules[k];
              this.einkStyle += einkRule.cssText + "\n";

              // Check if the rule has the custom property '--display: book'
              if (einkRule.style) {
                const displayValue = einkRule.style.getPropertyValue("--display");
                if (displayValue) {
                  switch (displayValue) {
                    case "book":
                      // Add the selector text to the array
                      this.#bookSelectors.push([einkRule.selectorText, einkRule]);
                      break;
                    case "mainBook":
                      this.#mainBookSelector = [einkRule.selectorText, einkRule];
                      break;
                    case "book-content":
                      this.#contentSelectors.push(einkRule.selectorText);
                      break;
                    case "book-item":
                      this.#itemSelectors.push(einkRule.selectorText);
                      break;
                    case "book-UI":
                      this.#uiSelectors.push(einkRule.selectorText);
                      break;
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Some stylesheets may not be accessible due to CORS, we'll skip those
        console.warn(`Couldn't access rules in stylesheet ${i}:`, e);
      }
    }
  }

  #handleBackNavigation(evt) {
    evt.preventDefault();
    if (this.mode.startsWith("eink")) {
      if (this.mode === "eink.notebook") {
        this.highlighter.hideNoteBook();
      } else if (Book.focusedBook.container.id === "note") {
        Book.focusedBook.hideNoteWindow();
      }
    }
  }

  #setupKeyboardShortcuts(event) {
    if (event.key === "Escape" && $("#controlPanel").css("display") !== "none") {
      $("#controlPanel").hide();
      return;
    }
    if (this.mode === "eink.read") {
      if (!this.#firstShortcutKey && event.ctrlKey) {
        this.#firstShortcutKey = event.key;
        setTimeout(() => {
          this.#firstShortcutKey = null;
        }, 1000);
      } else if (event.altKey) {
        this.setCursorImage("eraser");
      } else if (event.key === "Escape") {
        if (Book.focusedBook === this.mainBook) this.enterScrollMode();
        else if (Book.focusedBook.container.id === "note") Book.focusedBook.hideNoteWindow();
      }

      // Shortcut keybindings
      if (this.#firstShortcutKey === "Control") {
        switch (event.key) {
          case "1":
            this.#setHighlightColor("rgb(0, 255, 0)");
            console.log("Highlight color set to green");
            break;
          case "2":
            this.#setHighlightColor("rgb(0, 0, 255)");
            console.log("Highlight color set to blue");
            break;
          case "3":
            this.#setHighlightColor("rgb(255, 0, 0)");
            console.log("Highlight color set to red");
            break;
          case "n":
            this.highlighter.showNoteBook();
            break;
        }
      }
    } else if (this.mode === "eink.notebook") {
      if (event.key === "Escape") {
        this.highlighter.hideNoteBook();
      }
    } else if (this.mode === "eink.draw") {
      if (event.key === "Escape") {
        this.floatToolBar.exitDraw();
      }
    } else if (this.mode === "eink.highlight") {
      if (event.key === "Escape") {
        this.floatToolBar.exitHighlight();
      }
    }
  }

  #handleKeyUp(evt) {
    if (evt.key === "Alt") {
      this.setCursorImage("default");
    }
  }

  #setHighlightColor(color) {
    this.highlighter.highlightColor = color;
    console.log(`Highlight color set to ${color}`);
  }

  #testRefreshRate() {
    return new Promise((resolve) => {
      let frameCount = 0;
      let startTime = performance.now();

      const measureFPS = () => {
        const currentTime = performance.now();
        frameCount++;

        if (currentTime - startTime >= 1000) {
          const fps = Math.round((frameCount * 1000) / (currentTime - startTime));
          console.log(`FPS: ${fps}`);
          frameCount = 0;
          startTime = currentTime;
          requestAnimationFrame(measureFPS);

          // resolve(fps);
        } else {
          requestAnimationFrame(measureFPS);
        }
      };

      requestAnimationFrame(measureFPS);
    });
  }

  setCursorImage(cursorType) {
    const cursorImages = {
      highlight: `url("path/to/highlight-cursor.png") 0 20, auto`,
      draw: `url("path/to/draw-cursor.png") 0 20, auto`,
      eraser: `url(${this.toolBarIconSrc.eraser_cursor}) 0 20, auto`,
      default: "default",
    };

    document.body.style.cursor = cursorImages[cursorType] || cursorImages.default;
  }

  #preloadIconImages() {
    const iconImgDiv = document.createElement("div");
    iconImgDiv.id = "iconImgDive";
    iconImgDiv.classList.add("eink");
    Object.entries(this.toolBarIconSrc).forEach(([key, value]) => {
      const img = document.createElement("img");
      img.src = value;
      img.id = key;
      iconImgDiv.appendChild(img);
    });
    this.manualItems.forEach((item, index) => {
      const img = document.createElement("img");
      img.src = item.imgSrc;
      img.id = "manualIcon" + index;
      iconImgDiv.appendChild(img);
    });
    document.documentElement.appendChild(iconImgDiv);
    iconImgDiv.style.display = "none";
  }

  setupEinkStyle(cssText = "", memorize = true) {
    let einkStyleSheet = document.getElementById("einkStyleSheet");
    if (!einkStyleSheet) {
      einkStyleSheet = document.createElement("style");
      einkStyleSheet.id = "einkStyleSheet";
      document.head.appendChild(einkStyleSheet);
    }

    if (this.mode.includes("eink")) {
      if (memorize) {
        this.einkStyle += cssText;
        einkStyleSheet.textContent = this.einkStyle + this.#defaultStyle;
      } else {
        einkStyleSheet.textContent = this.einkStyle + this.#defaultStyle + cssText;
      }
    } else {
      if (memorize) {
        this.#defaultStyle += cssText;
        einkStyleSheet.textContent = this.#defaultStyle + cssText;
      } else {
        einkStyleSheet.textContent = this.#defaultStyle + cssText;
      }
    }
  }

  removeEinkStyle() {
    const einkStyleSheet = document.getElementById("einkStyleSheet");
    if (einkStyleSheet) {
      einkStyleSheet.textContent = this.#defaultStyle;
    }
  }

  #handlePointerDown(evt) {
    if (evt.pointerType === "touch") {
      this.#activeTouches.push(evt);
      if (this.#activeTouches.length === 1) {
        this.#touchStartX = evt.clientX;
        this.#touchStartY = evt.clientY;
      }
      if (this.mode === "eink.read") {
        if (this.#activeTouches.length === 2) {
          this.#initialDistance = this.#getDistance(this.#activeTouches[0], this.#activeTouches[1]);
        }
      }
      this.#startTouchesNumber = this.#activeTouches.length;
    } else if (evt.pointerType === "mouse") {
      if (this.mode === "eink.read" || this.mode === "scroll") {
        if (evt.buttons === 1 && !evt.metaKey && !evt.altKey) {
          this.#longPressTimer = setTimeout(() => {
            this.mode === "eink.read" ? this.showControlPanel() : this.enterEinkMode();
          }, this.#longPressDuration);
        } else if (evt.buttons === 1 && (evt.metaKey || evt.altKey)) {
          this.highlighter.enterHighlightMode(this.bookContents);
          $(this.floatToolBar.view).hide();
          $(Book.focusedBook.contents).trigger(evt);
          Book.focusedBook.contents.setPointerCapture(evt.pointerId);
        }
      }
    } else if (evt.pointerType === "pen") {
      // This code catch the fact that the  user has a stylus right now so it automatically enter draw mode. Thus users can sketch immediately.
      if (this.mode === "eink.read") {
        this.manual.hide();
        $("#controlPanel").hide();
        const floatToolBar = this.floatToolBar.setFloatToolBar("draw");
        $(floatToolBar).hide();
        this.painter.enterDrawMode();
        const canvas = document.elementFromPoint(evt.clientX, evt.clientY);
        $(canvas).trigger("pointerdown", {
          target: canvas,
          pointerType: "pen",
          pointerId: evt.pointerId,
          clientX: evt.clientX,
          clientY: evt.clientY,
          buttons: evt.buttons,
          button: evt.button,
          stopPropagation: () => {},
        });
        canvas.setPointerCapture(evt.pointerId);
      }
    }
  }

  #handlePointerMove(evt) {
    if (this.mode === "eink.read") {
      if (evt.pointerType === "touch" && !this.preventGestures && this.#startTouchesNumber === 2) {
        const touchIndex = this.#activeTouches.findIndex((touch) => touch.pointerId === evt.pointerId);
        if (touchIndex !== -1) {
          this.#activeTouches[touchIndex] = evt;
        }

        const currentDistance = this.#getDistance(this.#activeTouches[0], this.#activeTouches[1]);
        const deltaDistance = currentDistance - this.#initialDistance;
        const pinchThreshold = 30; // Minimum change in distance to trigger text size change

        if (Math.abs(deltaDistance) > pinchThreshold) {
          if (this.#fontSizeChangeComplete) {
            if (deltaDistance > 0) {
              this.#increaseText(evt);
            } else {
              this.#decreaseText(evt);
            }
            this.#initialDistance = currentDistance;
            this.#showSizeChangePopup(deltaDistance > 0);
          } else {
            this.#showLoadingWindow();
          }
        }
      }
    }

    if (evt.pointerType === "mouse" && evt.buttons === 1) {
      clearTimeout(this.#longPressTimer);
      if (sessionStorage.mode === "eink") this.#mousemoved = true; // This is used to prevent flip of the book after mouseup if users wants to select the text by the mouse.
    }
  }

  #handlePointerUp(evt) {
    if (evt.pointerType === "touch") {
      if (this.#startTouchesNumber === 1) {
        if (this.preventGestures === true) {
          return;
        } else if (this.preventGestures) {
          this.preventGestures--;
          return;
        }

        const touchEndX = evt.clientX;
        const touchEndY = evt.clientY;
        const deltaX = touchEndX - this.#touchStartX;
        const deltaY = touchEndY - this.#touchStartY;
        const swipeThreshold = 50;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        //Touch gestures for scroll mode.
        if (sessionStorage.mode === "scroll") {
          // If user swipes from left to right in scroll mode, enter eink mode.
          if (Math.abs(deltaY) < swipeThreshold && deltaX > swipeThreshold) {
            console.log("Swipe from left to right, enter Eink mode");
            this.manual.load();
            this.enterEinkMode();
          }
        } else if (this.mode === "eink.notebook") {
          // Touch gestures when notebook is shown
          if (Math.abs(deltaY) < swipeThreshold && deltaX < -swipeThreshold) {
            this.highlighter.hideNoteBook();
          } else if (Math.abs(deltaY) < swipeThreshold && deltaX > swipeThreshold) {
            this.showControlPanel();
          }
        }
        //Touch gestures for Eink mode.
        else {
          const isUpperRight = this.#touchStartX > (screenWidth * 3) / 4 && this.#touchStartY < screenHeight / 4;
          const isUpperLeft = this.#touchStartX < screenWidth / 4 && this.#touchStartY < screenHeight / 4;
          const isLowerRight = this.#touchStartX > (screenWidth * 3) / 4 && this.#touchStartY > (screenHeight * 3) / 4;
          const isLowerLeft = this.#touchStartX < screenWidth / 4 && this.#touchStartY > (screenHeight * 3) / 4;
          const isCenter = this.#touchStartX > screenWidth / 4 && this.#touchStartX < (screenWidth * 3) / 4 && this.#touchStartY > screenHeight / 4 && this.#touchStartY < (screenHeight * 3) / 4;

          //If user swipes from top right to bottom left in Eink mode, enter draw mode.
          if (isUpperRight && deltaX < -swipeThreshold && deltaY > swipeThreshold) {
            this.floatToolBar.setFloatToolBar("draw");
            this.painter.enterDrawMode();
          } else if (isUpperLeft && deltaX > swipeThreshold && deltaY > swipeThreshold) {
            this.highlighter.enterHighlightMode(this.bookContents);
          } else if (isLowerLeft && deltaX > swipeThreshold && deltaY < -swipeThreshold) {
            const contTablePage = this.mainBook.findContTablePage();
            if (contTablePage) {
              this.mainBook.currentPage = contTablePage;
            }
            // document.documentElement.classList.remove("disable-default-touch");
            // this.#removeListeners();
            // Book.focusedBook.enterPrintMode();
          } else if (isCenter && deltaX < -swipeThreshold && deltaY > swipeThreshold) {
            Book.focusedBook.exitPrintMode();
            console.log("Eink: Exit print mode.");
          } else if (isLowerRight && deltaX < swipeThreshold && deltaY < -swipeThreshold) {
            this.highlighter.showNoteBook();
          } else if (Math.abs(deltaY) < swipeThreshold && deltaX > swipeThreshold) {
            this.showControlPanel();
          } else if (Math.abs(deltaY) < swipeThreshold && deltaX < -swipeThreshold) {
            this.enterScrollMode();
          }
        }
      } else if (this.#startTouchesNumber === 2) {
        if (this.previewBook) this.#changeBookFontSize();
      }
      this.#activeTouches = [];
      this.#touchStartX = null;
      this.#touchStartY = null;
      this.#initialDistance = 0;
      this.#startTouchesNumber = 0;
    } else if (evt.pointerType === "mouse") {
      clearTimeout(this.#longPressTimer);
      if (sessionStorage.mode === "eink" && this.#mousemoved) {
        const { clientX: x, clientY: y } = evt;
        const book = document.elementFromPoint(x, y)?.closest(".book")?.book;
        if (book) book.preventFlip = 1;
        this.#mousemoved = false;
      }
    }
  }

  #getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  showControlPanel() {
    $("#controlPanel").show();
  }

  setupEinkBtn(position = "static", top = "30px", left = "0px", right = "30px", bottom = "0px") {
    let btnLocator = document.getElementsByClassName("einkBtn")[0];
    let einkBtn = document.getElementById("einkBtn");
    if (!einkBtn) {
      einkBtn = document.createElement("div");
      einkBtn.setAttribute("id", "einkBtn");
      einkBtn.classList.add("bookUI");
      einkBtn.classList.add("inactiveBtn");
      einkBtn.innerHTML = "<b style='color:Blue'>e</b><b style='color:red'>ink</b>";
      if (this.inIOSBrowser && document.readyState !== "complete") {
        console.log("iOS Browser,content not fully loaded, disable click of Eink Btn");
        $(window).on("load", () => {
          console.log("Enable click of Eink Btn in iOS");
          einkBtn.classList.add("activeBtn");
          einkBtn.classList.remove("inactiveBtn");
          einkBtn.onclick = (evt) => {
            this.enterEinkMode();
          };
        });
      } else {
        einkBtn.classList.add("activeBtn");
        einkBtn.classList.remove("inactiveBtn");
        einkBtn.onclick = (evt) => {
          this.enterEinkMode();
        };
      }
    }

    if (btnLocator) {
      $(einkBtn).css("position", "static");
      btnLocator.appendChild(einkBtn);
    } else {
      document.documentElement.append(einkBtn);
      $(einkBtn).css({
        position: position,
        top: top,
        left: left,
        right: right,
        bottom: bottom,
        width: "fit-content",
        height: "fit-content",
        "z-index": 99999,
      });
    }
  }

  #setupManual(lang = "zh-TW") {
    const renderManual = () => {
      const manualBox = document.getElementById("manualBox");
      const table = manualBox.querySelector("table");
      const title = manualBox.querySelector("h3");
      table.innerHTML = ""; // Clear existing content

      const isLandscape = window.innerWidth > window.innerHeight;
      this.manual.isLandscape = isLandscape;

      if (isLandscape) {
        renderLandscapeView(table, this.manualItems, lang);
      } else {
        renderPortraitView(table, this.manualItems, lang);
      }

      // Calculate available height for the table
      const availableHeight = manualBox.clientHeight - title.offsetHeight - 60 - 20;

      // Set table height
      table.style.height = `${availableHeight}px`;

      // Adjust row and image heights
      adjustRowHeights(table, availableHeight);
    };

    return new Promise((resolve) => {
      if (!this.manual) {
        const manual = document.createElement("DIV");
        const title = lang === "zh-TW" ? "進入Eink模式" : "Enter Eink mode";
        createManualStylesheet();
        manual.setAttribute("id", "manual");
        manual.classList.add("eink");
        manual.innerHTML = `
          <div id="manualBox">
            <span id="closeManual" style="display: none;">×</span>
            <span id="loadingText">Loading...</span>
            <h3>${title}</h3>
            <table></table>
          </div>`;
        manual.show = () => {
          manual.style.display = "flex";
          renderManual();
        };
        manual.hide = () => {
          manual.style.display = "none";
        };

        manual.load = () => {
          $("manual").off("click.manual");
          $("#closeManual").hide();
          $("#loadingText").show();
        };
        manual.ready = () => {
          $("#closeManual").show();
          $("#loadingText").hide();
          $("#manual").on("click.manual", function (evt) {
            evt.stopPropagation();
            this.hide();
          });
        };
        document.documentElement.append(manual);
        this.manual = manual;
      }

      this.manual.load();

      const imagePromises = this.manualItems.map((item, index) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.src = item.imgSrc;
          img.id = "manualIcon" + index;
        });
      });

      Promise.all(imagePromises).then(() => {
        renderManual();

        // Add event listener for orientation changes
        $(window).on("resize.manual", () => {
          if (this.manual.isLandscape !== window.innerWidth > window.innerHeight) {
            renderManual();
            console.log("Orientation changed. Manual layout has been updated.");
          }
        });

        console.log("Manual has been added.");
        resolve();
      });
    });

    function renderPortraitView(table, manualItems, lang = "zh-TW") {
      const langSetting = lang === "zh-TW" ? "text_ch" : "text_en";

      manualItems.forEach((instruction, index) => {
        const row = document.createElement("tr");
        const imgCell = document.createElement("td");
        const textCell = document.createElement("td");
        const iconImg = document.getElementById("manualIcon" + index).cloneNode(true);

        imgCell.appendChild(iconImg);
        textCell.innerHTML = "<b>" + instruction[langSetting] + "</b>";
        row.appendChild(imgCell);
        row.appendChild(textCell);

        table.appendChild(row);
      });
    }

    function renderLandscapeView(table, manualItems, lang = "zh-TW") {
      const langSetting = lang === "zh-TW" ? "text_ch" : "text_en";

      for (let i = 0; i < Math.ceil(manualItems.length) / 2; i++) {
        const row = document.createElement("tr");

        for (let j = 1; j <= 4; j++) {
          const itemNumber = Math.ceil((i * 4 + j) / 2) - 1;

          if (itemNumber < manualItems.length) {
            const cell = document.createElement("td");
            const instruction = manualItems[itemNumber];
            const iconImg = document.getElementById("manualIcon" + itemNumber).cloneNode(true);

            if (j % 2 === 1) {
              cell.appendChild(iconImg);
            } else {
              cell.innerHTML = `        
              <div><b>${instruction[langSetting]}</b></div>
          `;
            }

            row.appendChild(cell);
          }
        }

        table.appendChild(row);
      }
    }

    function adjustRowHeights(table, availableHeight) {
      const rowCount = table.rows.length;
      const rowHeight = availableHeight / rowCount;

      Array.from(table.rows).forEach((row) => {
        row.style.height = `${rowHeight}px`;
        const imgs = row.querySelectorAll("img");
        imgs.forEach((img) => {
          img.style.height = `${rowHeight - 10}px`;
          img.style.width = "auto";
          img.style.objectFit = "contain";
        });
      });
    }

    function createManualStylesheet() {
      const style = document.createElement("style");
      style.id = "manualStylesheet";
      style.textContent = `
      #manual {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 5000;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: rgba(0, 0, 0, 0.4);
        display: flex;
        justify-content: center;
        align-items: center;
        display:none;
      }
  
  
    #manualBox {
      background-color: #fefefe;
      border: 1px dotted red;
      height: 90%;
      max-width: 1000px;
      width: 90%;
      padding: 0px 30px;
      border-radius: 20px;
      box-sizing: border-box;
      overflow: hidden;
    }
  
    #manualBox table {
        margin: 0px auto;
        margin-bottom: 10px;
    }
  
    #manualBox table td {
        vertical-align: middle;
        padding: 0 10px;
    }
    #manualBox table td:nth-child(2) {
        position: relative;
        top: -10px;
    }
  
    #manualBox button {
        float: right;
        margin-right: 10px;
        margin-bottom: 10px;
    }
  
    #closeManual {
        float: right;
        font-size: 30px;
        margin-top: 20px;
        color: blue;
    }

    #loadingText {
      float: right;
      margin-top: 20px;
      font-size: 12px;
      color: #888;
    }

    #closeManual:hover,
    #closeManual:focus {
        color: blue;
        text-decoration: none;
        cursor: pointer;
    }
      `;
      document.head.appendChild(style);
    }
  }

  async customConfirm(message, xPos = 30, yPos = 150) {
    let customModal = document.getElementById("customConfirm");
    if (!customModal) {
      customModal = document.createElement("DIV");
      customModal.id = "customConfirm";
      customModal.classList.add("modal");
      customModal.innerHTML = `
      <div class="modal-content">
      <p>Join highlights on the previous page?</p>
      <button id="confirmYes">Yes</button>
      <button id="confirmNo">No</button>
      </div>
      `;
      document.documentElement.append(customModal);
    }

    return new Promise((resolve) => {
      const modalText = customModal.querySelector("p");
      const modalBox = customModal.querySelector(".modal-content");
      if (xPos === undefined || xPos === "default") {
        xPos = (window.innerWidth - 300) / 2;
      }
      modalBox.style.top = `${yPos}px`;
      modalBox.style.left = `${xPos}px`;
      modalText.textContent = message;
      customModal.style.display = "block";

      const yesButton = document.getElementById("confirmYes");
      const noButton = document.getElementById("confirmNo");

      function handleClick(result) {
        customModal.style.display = "none";
        resolve(result);
      }

      yesButton.onclick = () => handleClick(true);
      noButton.onclick = () => handleClick(false);
    });
  }

  setupControl(panelObjArray = [], rowItemNum = 3) {
    let controlPanel;
    controlPanel = document.getElementById("controlPanel");
    let controlBox = document.getElementById("controlBox");
    const contTable = this.mainBook.container.querySelector(".cont_table");
    const boxWidth = 60 * rowItemNum + 10 * (rowItemNum + 1);

    if (!controlPanel) {
      controlPanel = document.createElement("DIV");
      controlBox = document.createElement("DIV");
      controlPanel.id = "controlPanel";
      controlPanel.classList.add("eink");
      controlBox.id = "controlBox";

      setStyle();
    }

    controlBox.innerHTML = "";
    $(controlBox).css("width", `${boxWidth}px`);
    // If there are no panel objects, create default ones
    if (panelObjArray.length === 0) {
      panelObjArray = [
        this.makePanelObj(
          "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhGogFFCYWS2k_Hr2bYZQp3Vt36O-3kVUlnSK758Qon7mLhBpqADpL6h16B7ZU8r1u906cXMl4PGwyVyvMIVbmWTZSFy_9Oe4PFdgq6IAeQsYWGR9d2bC5gcpAsOcLTmk6TmE8Fq3roWg/s200/Icons.001.png",
          this.#increaseText.bind(this),
          "increaseText"
        ),
        this.makePanelObj(
          "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgigG2M2hO3UhFmHW0lMuqcJWp1xLA_PUqS5mBu1V0_45jUjEuBEmiXQMLwxqcQKbVVdRKLa88_ixO5ObMwj0_TitNM3-doOmbwH8sQcXud-24zHEKEqdA6l9nSyJ4mG5deegiImMi0Vw/s320/Icons.004.png",
          this.#decreaseText,
          "decreaseText"
        ),
        this.makePanelObj(
          "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiTlsX1vb-orCpX4uUapoCvAPDMBx7el484_fEIu8M41gi9R7JSaV4XuJwqFXXIaPd3_nijiDoCBn12nrSj3geh1T8ESOO-wmatEB9xSoyRCqeedswk6-8ePKgHnjS1vnZTIQksOgnZqrPAwK38Ey_gKZUYnJTul0EQUw8OWmI169vdpw3MhelyDqLL/s1600/My%20Icons.002.jpeg",
          () => {
            this.highlighter.enterHighlightMode(this.bookContents);
          },
          "highlightMode"
        ),
        this.makePanelObj(
          "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgLTmabfpczkcfTrJgzBo_LR-RWaJIhyTNM8A7p_WHA5J2TIqs4drAqgI8QHvJjxr707Xy-Jw56Iq9H8NEjE7BZ_Bf_3Lxd3Ff2EuyLJTI3PD9_yjgBQr7kX7NU8wLclfUfl-V_3y40YFdI9kpfZ2hqBDq1GmGrIDD1sgfEEqHzuGnXjhYfjcy8JVFB/s1600/My%20Icons.001.jpeg",
          () => {
            this.floatToolBar.setFloatToolBar("draw");
            this.painter.enterDrawMode();
          },
          "draw"
        ),
        this.makePanelObj(this.toolBarIconSrc.scroll_mode, this.enterScrollMode, "scrollMode"),
        this.makePanelObj(this.toolBarIconSrc.noteBook_icon, this.highlighter.showNoteBook.bind(this.highlighter), "noteBook"),
        this.makePanelObj(
          this.toolBarIconSrc.printer,
          () => {
            window.print();
          },
          "printMode"
        ),
        this.makePanelObj(
          this.toolBarIconSrc.info_icon,
          () => {
            const titleText = this.lang === "zh-TW" ? "操作說明" : "manual";
            $("#manualBox h3").text(titleText);
            this.manual.show();
          },
          "showManual"
        ),
      ];

      if (contTable) {
        panelObjArray.unshift(this.makePanelObj(this.toolBarIconSrc.content_table, this.checkContent, "checkContent"));
      }
    }

    panelObjArray.forEach((panelObj) => {
      const item = document.createElement("DIV");
      const icon = document.createElement("IMG");
      icon.setAttribute("src", panelObj.img);
      item.setAttribute("id", panelObj.id);
      if (panelObj.id === "spacer") {
        item.style.visibility = "hidden";
      }
      item.onclick = panelObj.func.bind(this);
      item.setAttribute("class", "ctrBtn");
      item.append(icon);
      controlBox.append(item);
    });

    controlPanel.append(controlBox);
    controlPanel.style.display = "none";
    $(controlPanel).on("click", (evt) => {
      evt.stopPropagation();
      this.hidePanel(evt);
    });
    document.documentElement.append(controlPanel);
    console.log("Control Panel created");

    function setStyle() {
      const styleSheet = document.createElement("STYLE");
      styleSheet.id = "controlPanelStylesheet";
      styleSheet.textContent = `
    #controlPanel {
      position: fixed;
      top: 0px;
      left: 0px;
      z-index: 5000;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: rgba(0, 0, 0, 0.4);
      display: flex;
      justify-content: center;
      align-items: center;
  }

  #controlBox {
      background-color: #fefefe;
      display: flex;
      width: 220px;
      flex-wrap: wrap;
      justify-content: space-evenly;
      align-content: space-around;
      padding: 10px;
      border-radius: 20px;
      border: 1px solid #888;
  }

  .ctrBtn {
      display: flex;
      width: 60px;
      height: 60px;
  }
    `;
      document.head.appendChild(styleSheet);
    }
  }

  makePanelObj = (img, func, id) => ({ img, func, id });

  checkContent() {
    const contTablePage = this.mainBook.findContTablePage();
    if (contTablePage) {
      this.mainBook.currentPage = contTablePage;
    }
  }

  hidePanel(evt) {
    evt.stopPropagation();
    $("#controlPanel").hide();

    if (this.previewBook) this.#changeBookFontSize();
  }

  #showLoadingWindow(show = true, message = "Loading...") {
    let loadingWindow = document.getElementById("loadingWindow");
    if (show) {
      this.#loading = true;

      if (!loadingWindow) {
        loadingWindow = document.createElement("div");
        loadingWindow.id = "loadingWindow";
        loadingWindow.style.position = "fixed";
        loadingWindow.style.top = "0";
        loadingWindow.style.left = "0";
        loadingWindow.style.width = "100%";
        loadingWindow.style.height = "100%";
        loadingWindow.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        loadingWindow.style.zIndex = "10000";
        loadingWindow.style.display = "flex";
        loadingWindow.style.justifyContent = "center";
        loadingWindow.style.alignItems = "center";

        const messageBox = document.createElement("div");
        messageBox.style.backgroundColor = "white";
        messageBox.style.padding = "20px";
        messageBox.style.borderRadius = "10px";
        messageBox.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.3)";
        messageBox.style.textAlign = "center";

        if (!this.isEinkDevice) {
          const spinner = document.createElement("div");
          spinner.id = "loadingSpinner";
          spinner.style.border = "4px solid #f3f3f3";
          spinner.style.borderTop = "4px solid #3498db";
          spinner.style.borderRadius = "50%";
          spinner.style.width = "30px";
          spinner.style.height = "30px";
          spinner.style.animation = "spin 1s linear infinite";
          spinner.style.margin = "0 auto 10px auto";

          const style = document.createElement("style");
          style.textContent = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
          document.head.appendChild(style);

          messageBox.appendChild(spinner);
        }

        const messageText = document.createElement("div");
        messageText.id = "loadingMessage";

        messageBox.appendChild(messageText);
        loadingWindow.appendChild(messageBox);

        document.documentElement.appendChild(loadingWindow);
      }

      const messageText = document.getElementById("loadingMessage");
      messageText.textContent = message;
      loadingWindow.style.display = "flex";

      // Show or hide spinner based on isEinkDevice
      const spinner = document.getElementById("loadingSpinner");
      if (spinner) {
        spinner.style.display = this.isEinkDevice ? "none" : "block";
      }
    } else {
      this.#loading = false;
      if (loadingWindow) {
        loadingWindow.style.display = "none";
      }
    }
  }

  #changeBookFontSize() {
    // Check if Font size has been set
    if (this.#fontSizeAdjustment !== 0) {
      this.#fontSizeChangeComplete = false;
      let BoundaryHit = false;
      let jump;

      this.#updateFontSizeButtons(true);
      this.previewBook.onpagechange = (evt) => {
        if (evt.startPageNum === evt.endPageNum) {
          // Show loading window to inform the user the setting of font size is not complete yet
          BoundaryHit = true;
          this.#showLoadingWindow(true, "Loading....");
        }
      };

      // Prevent previewBook gesture while loading.
      let x0, y0, toucheNum;
      this.previewBook.removeEventListener("touchstart touchend");
      this.previewBook.addEventListener("touchstart", (evt) => {
        evt.stopPropagation();
        toucheNum = evt.touches.length;
        if (evt.touches.length === 1) {
          x0 = evt.touches[0].clientX;
          y0 = evt.touches[0].clientY;
        }
      });

      const targetBook = this.#targetBook;
      this.previewBook.addEventListener("touchend", (evt) => {
        evt.stopPropagation();
        if (toucheNum === 1) {
          const yMove = evt.changedTouches[0].clientY - y0;
          const xMove = evt.changedTouches[0].clientX - x0;
          const threshold = 50;
          if (Math.abs(xMove) < threshold && yMove > threshold) {
            jump = "tail";
            if (!this.#fontSizeChangeComplete) this.#showLoadingWindow();
            else {
              targetBook.currentPage = targetBook.totalPages;
              this.previewBook.remove(true);
              this.previewBook = null;
              this.#targetBook = null;
            }
          } else if (Math.abs(xMove) < threshold && yMove < -threshold) {
            jump = "head";
            if (!this.#fontSizeChangeComplete) this.#showLoadingWindow();
            else {
              targetBook.currentPage = 1;
              this.previewBook.remove(true);
              this.previewBook = null;
              this.#targetBook = null;
            }
          }
        }
        x0 = null;
        y0 = null;
      });

      new Promise((resolve) => {
        this.books.forEach((book) => {
          if (book !== this.previewBook) {
            book.changeFontSizeBy(this.#fontSizeAdjustment);
          }
        });
        this.#fontSizeAdjustment = 0;
        resolve();
      }).then(() => {
        this.#fontSizeChangeComplete = true;
        this.#updateFontSizeButtons();
        this.#showLoadingWindow(false); // Hide loading window
        console.log("Font size change complete");

        const range = this.previewBook.previewRange;
        if (jump) {
          this.#targetBook.currentPage = jump === "head" ? 1 : this.#targetBook.totalPages;
          this.previewBook.remove(true);
          this.previewBook = null;
          this.#targetBook = null;
          return;
        } else if (BoundaryHit) {
          const target = this.previewBook.currentPage === 1 ? range.head : range.tail;
          this.#targetBook.currentPage = this.#targetBook.getPageNumByItem(target);
          if (target === range.tail) this.#targetBook.hint(target);
          this.previewBook.remove(true);
          this.previewBook = null;
          this.#targetBook = null;
          return;
        }

        this.previewBook.onpagechange = (evt) => {
          sessionStorage.setItem("pageNumBook" + this.previewBook.instanceID, ""); // Do not store the last location of preview book, let it always starts from page 1.

          let pageStarter;
          if (evt.startPageNum !== evt.endPageNum) {
            // Flip pages between the endPoints
            pageStarter = this.previewBook.getPageStarter(0);

            if (pageStarter.starter.nodeType === Node.TEXT_NODE) {
              const treeWalker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, (node) => {
                if (range.comparePoint(node, 0) === 0) {
                  return NodeFilter.FILTER_ACCEPT;
                } else {
                  return NodeFilter.FILTER_REJECT;
                }
              });
              // Trim the tail pageJumper to prevent "/n" at the end of the text node.
              const searchStr = pageStarter.starter.textContent.slice(pageStarter.offset, pageStarter.starter.length);
              while (treeWalker.nextNode()) {
                if (treeWalker.currentNode.textContent.includes(searchStr) && treeWalker.currentNode.parentNode.nodeName === pageStarter.starter.parentNode.nodeName) {
                  const index = treeWalker.currentNode.textContent.indexOf(searchStr);
                  const range = Book.rangeTool.createRange(treeWalker.currentNode, treeWalker.currentNode, index, index + 30 < treeWalker.currentNode.textContent.length ? index + 30 : treeWalker.currentNode.textContent.length);
                  this.#targetBook.currentPage = this.#targetBook.getPageNumByItem(range);
                  this.#targetBook.hint(range);
                  break;
                }
              }
            } else {
              // If the pageStarter of previewBook is an element node.
              const treeWalker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT, null);
              let target;
              while (treeWalker.nextNode()) {
                const node = treeWalker.currentNode;
                if (node.outerHTML === pageStarter.starter.outerHTML) {
                  target = node;
                  this.#targetBook.currentPage = this.#targetBook.getPageNumByItem(target);
                  this.#targetBook.hint(target);
                  break;
                }
              }
              if (!target) {
                this.#targetBook.currentPage += this.previewBook.currentPage - 1;
                this.#targetBook.hint(pageStarter.starter);
              }
            }
          } else {
            const target = evt.startPageNum === 1 ? range.head : range.tail;
            this.#targetBook.currentPage = this.#targetBook.getPageNumByItem(target);
            if (target === range.tail) this.#targetBook.hint(target);
          }

          this.previewBook.remove(true);
          this.previewBook = null;
          this.#targetBook = null;
        };

        this.previewBook.onhidden = () => {
          this.previewBook.remove(true);
          this.previewBook = null;
          this.#targetBook = null;
        };
      });
    } else if (this.#fontSizeAdjustment === 0) {
      this.previewBook.remove(true);
      this.previewBook = null;
      this.#targetBook = null;
    }
  }

  #increaseText(event) {
    console.log("Increase text size");
    event.stopPropagation();

    if (this.#fontSizeChangeComplete && this.#totalFontSizeChange < this.#maxIncrease) {
      $(".draw").hide();
      this.#totalFontSizeChange += 2;
      this.#fontSizeAdjustment += 2;
      if (!this.previewBook) {
        this.#targetBook = Book.focusedBook;
        this.previewBook = Book.focusedBook.quickPreview(Book.focusedBook.currentPage, Book.focusedBook.currentPage + 6, +2);
      } else {
        this.previewBook.changeFontSizeBy(+2);
      }

      this.#updateFontSizeButtons();
    }
  }

  #decreaseText(event) {
    console.log("Decrease text size");
    event.stopPropagation();

    if (this.#fontSizeChangeComplete && this.#totalFontSizeChange > 0) {
      $(".draw").hide();
      this.#totalFontSizeChange -= 2;
      this.#fontSizeAdjustment -= 2;
      if (!this.previewBook) {
        this.#targetBook = Book.focusedBook;
        this.previewBook = Book.focusedBook.quickPreview(Book.focusedBook.currentPage, Book.focusedBook.currentPage + 6, -2);
      } else {
        this.previewBook.changeFontSizeBy(-2);
      }
      this.#updateFontSizeButtons();
    }
  }

  #updateFontSizeButtons(disable = false) {
    if (!disable) {
      $("#increaseText")
        .children()
        .replaceWith(Eink.getIconImg(`increaseText_${this.#totalFontSizeChange === this.#maxIncrease ? "dis" : "en"}abled`));

      $("#decreaseText")
        .children()
        .replaceWith(Eink.getIconImg(`decreaseText_${this.#totalFontSizeChange === 0 ? "dis" : "en"}abled`));
    } else {
      $("#increaseText").children().replaceWith(Eink.getIconImg(`increaseText_disabled`));
      $("#decreaseText").children().replaceWith(Eink.getIconImg(`decreaseText_disabled`));
    }
  }

  #showSizeChangePopup(isIncrease) {
    clearTimeout(this.#popupTimeout);

    let popup = document.getElementById("sizeChangePopup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "sizeChangePopup";
      document.body.appendChild(popup);
    }

    popup.textContent = isIncrease ? `+${this.#totalFontSizeChange}` : `${this.#totalFontSizeChange}`;
    popup.style.position = "fixed";
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    popup.style.color = "white";
    popup.style.padding = "10px";
    popup.style.borderRadius = "5px";
    popup.style.zIndex = "9999";

    popup.style.display = "block";

    this.#popupTimeout = setTimeout(() => {
      popup.style.display = "none";
    }, 1000);
  }

  resetPages() {
    this.books.forEach((book) => {
      book.resetPages();
    });
  }

  enterScrollMode() {
    // This is for the immediately sketch by stylus or printing feature, which is possible to enterScroll mode directly when the draw mode or highlight mode is on.
    if (this.mode === "eink.draw") this.floatToolBar.exitDraw();
    if (this.mode === "eink.highlight") this.floatToolBar.exitHighlight();

    this.mode = "scroll";
    sessionStorage.mode = "scroll";
    this.removeEinkStyle();
    this.books.forEach((book) => {
      book.enterScrollMode();
    });

    $(window).off(".print");
    this.manual.hide();
    $(".draw").hide();
    $("#einkBtn").show();

    // Create and show the popup
    let message = this.lang === "zh-TW" ? "滑動瀏覽模式" : "Scroll Mode Activated";
    this.showPopup(message);
    document.documentElement.classList.remove("disable-default-touch");
    this.onEnterScroll({ books: this.books });
    this.onSwitchMode({ mode: "scroll", books: this.books });
  }

  showPopup(message = "message") {
    // Create popup element if it doesn't exist
    let popup = document.getElementById("einkPupup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "einkPupup";
      popup.classList.add(".eink");
      document.documentElement.appendChild(popup);
    }

    // Set popup styles
    popup.style.position = "fixed";
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    popup.style.color = "white";
    popup.style.padding = "20px";
    popup.style.borderRadius = "10px";
    popup.style.zIndex = "9999";
    popup.style.textAlign = "center";

    // Set popup content
    popup.textContent = message;

    // Show the popup
    popup.style.display = "block";

    // Hide popup when clicked anywhere on the document
    const hidePopup = () => {
      popup.style.display = "none";
      $(window).off("popup");
    };

    $(window).on("click.popup touchstart.popup", hidePopup);

    // Automatically hide popup after 2 seconds
    setTimeout(hidePopup, 2000);
  }

  painter = {
    eink: this,
    mode: "draw",
    currentBook: null,
    hasPen: false,
    penActive: false,
    penActiveTimer: null,
    muteTarget: null,
    color: "rgb(0, 0, 255)",
    hasMoved: false,
    lineWidth: 1,
    startTouch: null,
    maxTouchCount: 0,
    lastTouchTime: 0,
    oneTouchTime: null,
    prevColor: "rgb(0, 0, 255)",
    countTimer: null,
    flipTimer: null,
    pressTimer: null,
    currentCanvas: null,
    floatToolBar: null,
    selectionMode: false,
    selectionCanvas: null,
    selectionCtx: null,
    storedSelectionPoints: [],
    offsetX: 0,
    offsetY: 0,
    lastTouch: null,
    handlePagechange: () => {},

    enterDrawMode() {
      if (this.eink.mode !== "eink.draw") {
        this.eink.mode = "eink.draw";
        console.log("Entering draw mode. Setting up Canvas for drawing.");
        this.floatToolBar = this.eink.floatToolBar.view;
        this.eink.#removeListeners();

        this.handlePagechange = (evt) => {
          this.createCanvas(evt.book);
        };
        this.eink.books.forEach((book) => {
          this.createCanvas(book);
          book.addEventListener("pagechange", this.handlePagechange);
          book.preventGestures = true;
        });
        $(".draw").css("pointer-events", "auto"); // Reset this property to auto to allow touch and mouse events if users don't want to use the stylus and re-enter draw mode.

        this.eink.onenterdraw({ books: this.eink.books });
        this.eink.onSwitchMode({ mode: "eink.draw", books: this.eink.books });
      }
    },

    createCanvas(book) {
      if (book.isVisible && book.bookConfig.allowDraw) {
        let canvas = document.getElementById(this.getCanvasId(book));
        if (!canvas) {
          canvas = document.createElement("CANVAS");
          canvas.classList.add("draw");
          canvas.id = this.getCanvasId(book);
          canvas.setAttribute("width", book.container.clientWidth + "px");
          canvas.setAttribute("height", book.container.clientHeight + "px");
          canvas.style.position = "absolute";
          canvas.style.top = "0px";
          canvas.style.left = book.container.scrollLeft + "px";
          canvas.style.zIndex = "200";

          $(canvas).on("touchstart.draw", (evt) => {
            evt.preventDefault();
          }); // Prevent click events and long press actions.
          $(canvas).on("pointerdown.draw", this.drawStart.bind(this));
          $(canvas).on("pointermove.draw", this.drawMove.bind(this));
          $(canvas).on("pointerup.draw", this.drawEnd.bind(this));
          $(canvas).on("pointercancel.draw", this.drawCancel.bind(this));
          if (this.eink.inIOSBrowser) {
            $(canvas).on("touchstart touchmove touchend touchcancel", (evt) => {
              evt.stopPropagation();
            });
          }
          book.container.append(canvas);
        }

        const rect = canvas.getBoundingClientRect();
        canvas.offsetX = rect.x;
        canvas.offsetY = rect.y;
        this.hasPen ? (canvas.style.pointerEvents = "none") : (canvas.style.pointerEvents = "auto");
        return canvas;
      }
    },

    handlePenDown(evt) {
      if (evt.pointerType === "pen") {
        evt.stopPropagation(); // Important, this is to prevent the re-activation of enterDrawMode by event propagation to the window element and subseqeuntyly triggered by the #handlePointerDown event handler of Eink Class.

        if (!this.eink.bookContainers.includes(evt.currentTarget)) {
          // Prevent the long press behavior of the browser, such as selecting the text or triggering the context
          this.muteTarget = evt.target;
          evt.target.style.pointerEvents = "none";
        }
        window.clearTimeout(this.penActiveTimer);
        const canvas = this.createCanvas(evt.currentTarget.book);
        this.currentCanvas = canvas;
        this.offsetX = canvas.offsetX;
        this.offsetY = canvas.offsetY;
        $(canvas).trigger("pointerdown", {
          target: canvas,
          pointerType: "pen",
          pointerId: evt.pointerId,
          clientX: evt.clientX,
          clientY: evt.clientY,
          buttons: evt.buttons,
          button: evt.button,
          stopPropagation: () => {},
        });
        canvas.setPointerCapture(evt.pointerId);
        evt.currentTarget.book.preventFlip = true;
      } else if (evt.pointerType === "touch") {
        console.log("touch with pen is started");
        this.prevColor = this.color;
        if (!this.lastTouch || (this.lastTouch !== evt && Math.abs(evt.clientX - this.lastTouch.clientX) > 10)) {
          // The first criteria after OR operator is to prevent duplicate record of maxTouchCount if the event is propagated to other parent elements.
          // The second criteria after OR operator is to prevent duplicate record of maxTouchCount if the user click very quickly.
          this.maxTouchCount += 1;
          this.lastTouch = evt;
        }
        if (this.maxTouchCount === 2) {
          this.pressTimer = setTimeout(() => {
            this.eink.floatToolBar.exitDraw();
          }, 600);
        } else {
          clearTimeout(this.pressTimer);
        }
      }
    },

    handleTouchUpWithPen(evt) {
      // This event handler is used to change the stroke color while pen is active. It's only registered to the window element while pen is active..
      if (evt.pointerType === "touch") {
        window.clearTimeout(this.pressTimer);
        window.clearTimeout(this.countTimer);
        console.log("Touch with pen: Max touch count: " + this.maxTouchCount);
        if (this.maxTouchCount >= 2) {
          evt.currentTarget.book.preventFlip = true;
          if (this.maxTouchCount === 2) {
            this.color = "rgb(0, 0, 255)";
          } else if (this.maxTouchCount === 3) {
            this.color = "rgb(255, 0, 0)";
          } else if (this.maxTouchCount === 4) {
            this.color = "rgb(0, 255, 0)";
          } else if (this.maxTouchCount === 5) {
            this.color = "rgb(0, 0, 0)";
          }
          $("#mainIconImg").css("border-color", this.color);
        }
        this.lastTouchTime = performance.now();
        this.countTimer = setTimeout(() => {
          evt.currentTarget.book.preventFlip = false;
          this.maxTouchCount = 0;
          this.lastTouch = null;
        }, 300);
      }
    },

    drawStart(evt, data) {
      evt.preventDefault();
      evt.stopPropagation();
      if (data) evt = data;
      this.currentBook = evt.target.parentElement.book;
      if (this.currentCanvas !== evt.target) {
        this.currentCanvas = evt.target;
        this.offsetX = evt.target.offsetX;
        this.offsetY = evt.target.offsetY;
      }

      if (this.selectionMode) {
        this.startTouch = evt;
        this.storedSelectionPoints.push([evt.clientX - this.offsetX, evt.clientY - this.offsetY]);
        this.selectionCanvas = this.currentCanvas.cloneNode();
        this.selectionCanvas.id = "selectionCanvas";
        this.currentBook.container.append(this.selectionCanvas);
        this.selectionCtx = this.selectionCanvas.getContext("2d");
        this.selectionCtx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        this.selectionCtx.lineWidth = 2;
        this.selectionCtx.setLineDash([10, 10]);
        this.selectionCtx.beginPath();
      } else if (!this.penActive && evt.pointerType === "touch") {
        console.log("touch started");
        window.clearTimeout(this.countTimer);
        if (!this.lastTouch || (this.lastTouch !== evt && Math.abs(evt.clientX - this.lastTouch.clientX) > 10)) {
          // The first criteria after OR operator is to prevent duplicate record of maxTouchCount if the event is propagated to other parent elements. (This is possible if there are several books.)
          // The second criteria after OR operator is to prevent duplicate record of maxTouchCount if the user click very quickly.
          this.maxTouchCount += 1;
          this.lastTouch = evt;
        }
        this.prevColor = this.color;
        const contacts = this.maxTouchCount;

        clearTimeout(this.pressTimer);

        if (contacts === 1) {
          this.startTouch = evt;
          this.oneTouchTime = performance.now();
        } else if (contacts === 2) {
          // Set a timer to detect long press
          this.pressTimer = setTimeout(() => {
            this.eink.floatToolBar.exitDraw();
          }, 600);
          this.startTouch = null;
        } else {
          this.startTouch = null;
        }
      } else if (evt.pointerType === "pen") {
        console.log("pen started");
        // Override the activeTouches made by mouse and touch pointer type.
        window.clearTimeout(this.flipTimer);
        if (!this.hasPen && !this.eink.inIOSBrowser) {
          this.hasPen = true;
          this.eink.#setupListeners();
          $(".draw").css("pointer-events", "none");
          this.eink.books.forEach((book) => {
            $(book.container).on("pointerdown.draw", this.handlePenDown.bind(this));
            $(book.container).on("pointerup.draw pointercancel.draw", this.handleTouchUpWithPen.bind(this));
          });
        }
        this.eink.inIOSBrowser ? $(this.floatToolBar).show() : $(this.floatToolBar).hide();
        this.penActive = true;
        this.startTouch = evt;
        this.currentBook.preventGestures = true;
        const timeDuration = performance.now() - this.lastTouchTime;
        console.log("Time duration: " + timeDuration);
        if (timeDuration < 500) {
          this.color = this.prevColor;
        } else {
          this.prevColor = this.color;
        }
      } else if (evt.pointerType === "mouse") {
        this.startTouch = evt;
      }

      // If the submenu is open, close it
      if (this.floatToolBar.submenuOn === true) {
        this.floatToolBar.toggleSubmenu(evt);
        if (evt.type === "touch") this.currentBook.preventFlip = 1;
      }
    },

    drawMove(evt) {
      evt.preventDefault();
      evt.stopPropagation();
      console.log(evt.pointerType + " moved");
      this.maxTouchCount = 0;
      this.lastTouch = 0;

      if (this.startTouch && this.startTouch.pointerId === evt.pointerId) {
        const ctx = evt.target.getContext("2d");
        this.hasMoved = true;

        if (this.selectionMode) {
          const lastPoint = this.storedSelectionPoints[this.storedSelectionPoints.length - 1];
          const newPoint = [evt.clientX - this.offsetX, evt.clientY - this.offsetY];
          const distance = Math.sqrt(Math.pow(newPoint[0] - lastPoint[0], 2) + Math.pow(newPoint[1] - lastPoint[1], 2));

          this.totalPathLength = (this.totalPathLength || 0) + distance;
          const dashPattern = [10, 10];
          this.selectionCtx.setLineDash(dashPattern);
          this.selectionCtx.lineDashOffset = -this.totalPathLength % (dashPattern[0] + dashPattern[1]);

          this.selectionCtx.beginPath();
          this.selectionCtx.moveTo(lastPoint[0], lastPoint[1]);
          this.selectionCtx.lineTo(newPoint[0], newPoint[1]);
          this.selectionCtx.stroke();

          this.storedSelectionPoints.push(newPoint);
        } else if (this.mode === "draw" && (evt.pointerType === "touch" || evt.buttons === 1)) {
          this.maxTouchCount = 0;
          ctx.beginPath();
          ctx.moveTo(this.startTouch.clientX - this.offsetX, this.startTouch.clientY - this.offsetY);
          ctx.lineTo(evt.clientX - this.offsetX, evt.clientY - this.offsetY);
          ctx.lineWidth = evt.pointerType === "pen" ? this.lineWidth * evt.originalEvent.pressure * 5 : this.lineWidth;
          ctx.strokeStyle = this.color;
          ctx.stroke();
          this.startTouch = evt;
        } else {
          let clearRectWidth;
          const pressure = evt.originalEvent.pressure ? evt.originalEvent.pressure : 0.5;
          clearRectWidth = 100 * (evt.buttons === 32 ? 2 : 1) * pressure;

          ctx.clearRect(evt.clientX - this.offsetX - clearRectWidth / 2, evt.clientY - this.offsetY - clearRectWidth / 2, clearRectWidth, clearRectWidth);
        }
      }
    },

    drawEnd(evt) {
      evt.preventDefault();
      evt.stopPropagation();

      if (this.selectionMode) {
        this.eraseSelection(evt.target);
      }

      if (evt.pointerType === "touch") {
        console.log("Touch ended.");
        console.log(`Touch count: ${this.maxTouchCount}`);

        clearTimeout(this.pressTimer);
        if (this.maxTouchCount === 1 && performance.now() - this.oneTouchTime < 300 && !this.hasMoved) {
          this.flipTimer = setTimeout(() => {
            $(evt.target).trigger({
              type: "click",
              clientX: evt.clientX,
              clientY: evt.clientY,
            });
          }, 100);
        } else {
          window.clearTimeout(this.flipTimer);
          if (this.maxTouchCount === 2) {
            this.color = "rgb(0, 0, 255)";
          } else if (this.maxTouchCount === 3) {
            this.color = "rgb(255, 0, 0)";
          } else if (this.maxTouchCount === 4) {
            this.color = "rgb(0, 255, 0)";
          } else if (this.maxTouchCount === 5) {
            this.color = "rgb(0, 0, 0)";
          }
          $("#mainIconImg").css("border-color", this.color);
        }
        this.lastTouchTime = performance.now();
        this.countTimer = setTimeout(() => {
          this.lastTouch = null;
          this.maxTouchCount = 0;
        }, 150);
      } else if (evt.pointerType === "pen") {
        this.penActiveTimer = setTimeout(() => {
          if (this.muteTarget) {
            this.muteTarget.style.pointerEvents = "auto";
            this.muteTarget = null;
          }
          this.penActive = false;
          this.currentBook.preventFlip = false;
          this.currentBook.preventGestures = false;
        }, 300);
        console.log("pen ended");
      } else if (evt.pointerType === "mouse" && this.hasMoved) {
        this.currentBook.preventFlip = 1;
      }
      this.startTouch = null;
      this.hasMoved = false;
    },

    drawCancel(evt) {
      evt.preventDefault();

      if (this.selectionMode) {
        this.eraseSelection(evt.target);
      }

      if (evt.pointerType === "touch") {
        console.log("Touch cancelled.");
        console.log(`Touch count: ${this.maxTouchCount}`);

        clearTimeout(this.pressTimer);
        window.clearTimeout(this.flipTimer);

        if (this.maxTouchCount === 2) {
          this.color = "rgb(0, 0, 255)";
        } else if (this.maxTouchCount === 3) {
          this.color = "rgb(255, 0, 0)";
        } else if (this.maxTouchCount === 4) {
          this.color = "rgb(0, 255, 0)";
        } else if (this.maxTouchCount === 5) {
          this.color = "rgb(0, 0, 0)";
        }

        $("#mainIconImg").css("border-color", this.color);
        this.lastTouchTime = performance.now();
        this.countTimer = setTimeout(() => {
          this.lastTouch = null;
          this.maxTouchCount = 0;
        }, 150);
      } else if (evt.pointerType === "pen") {
        this.penActiveTimer = setTimeout(() => {
          if (this.muteTarget) {
            this.muteTarget.style.pointerEvents = "auto";
            this.muteTarget = null;
          }
          this.penActive = false;
          this.currentBook.preventFlip = false;
          this.currentBook.preventGestures = false;
        }, 300);
        console.log("pen cancelled.");
      } else if (evt.pointerType === "mouse" && this.hasMoved) {
        this.currentBook.preventFlip = 1;
      }
      this.startTouch = null;
      this.hasMoved = false;
    },

    eraseSelection(canvas) {
      // Remove the temporary selection canvas
      this.selectionCanvas.remove();

      const ctx = canvas.getContext("2d");

      // Erase the area inside the selection path
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(this.storedSelectionPoints[0][0], this.storedSelectionPoints[0][1]);
      for (let i = 1; i < this.storedSelectionPoints.length; i++) {
        ctx.lineTo(this.storedSelectionPoints[i][0], this.storedSelectionPoints[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Reset the selection path
      this.storedSelectionPoints = [];
      this.selectionCanvas = null;
      this.selectionCtx = null;
    },

    toggleSelectionMode() {
      this.selectionMode = !this.selectionMode;
    },

    getCanvasId(book) {
      const scrollLength = book.bookConfig.pagingMethod === "vertical" ? book.container.scrollHeight : book.container.scrollWidth;
      return "draw" + book.currentPage + "_" + book.instanceID + "_" + Math.round(book.container.clientWidth) + "_" + Math.round(book.container.clientHeight) + "_" + parseInt($(book.contents).css("font-size")) + "_" + scrollLength;
    },

    disableDraw() {
      if (this.hasPen) {
        this.hasPen = false;
        this.eink.books.forEach((book) => {
          $(book.container).off(".draw"); // Remove the handlePenDown and handleTouchUp pointer-event handlers.
        });
        this.eink.#removeListeners(); // Prevent duplicate .eink event listeners because when pen is active, these .eink event listeners has been reactivated to keep the touch gesture features. In the exitDraw function, these event listeners will be setup again.
      }
      $(this.floatToolBar).hide();
      if (this.floatToolBar.submenuOn) this.floatToolBar.toggleSubmenu();
      this.floatToolBar = null;
      this.boundCreateCanvas = this.createCanvas.bind(this);
      this.eink.books.forEach((book) => {
        book.removeEventListener("pagechange", this.handlePagechange);
        book.preventGestures = false;
      });
      $(".draw").css("pointer-events", "none");
      console.log("Draw mode ended.");
    },
  };

  highlighter = {
    eink: this,
    targetRange: undefined,
    marks: [], // The highlight marks added to highlight the text during one touch event
    highlightAreas: [],
    highlightMoved: false, // Used to distinguish user's intend to highlight or click.
    highlightColor: "rgb(0, 255, 0)", // The default color
    highlightColorName: "green",
    cachedStarterText: null,
    cachedMode: null,
    reverseDir: false, // Flag to determine the direction of highlight movement
    maxTouchCount: 0,
    book: undefined,
    highlightBook: undefined,
    highlightRemoved: false, // Flag to determine whether a highlight has been removed during pointer event.
    tx0: null,
    ty0: null,
    countTimer: null,
    longPressTimer: null,
    lastTouch: null,

    enterHighlightMode(areas) {
      if (this.eink.mode === "eink.draw") this.eink.floatToolBar.exitDraw(); // This is for the immediately sketch by stylus feature, which is possible to enterScroll mode directly when the draw mode is on.

      this.eink.mode = "eink.highlight";
      this.eink.floatToolBar.setFloatToolBar("highlight");
      console.log("Enter highlight mode");
      this.eink.#removeListeners();
      this.highlightAreas = areas;
      areas.forEach((area) => {
        if (area) {
          $(area).on("pointerdown.highlight", this.startHighlight.bind(this));
          $(area).on("pointermove.highlight", this.moveHighlight.bind(this));
          $(area).on("pointerup.highlight pointercancel.highlight", this.endHighlight.bind(this));
          if (!this.eink.inIOSBrowser) area.classList.add("no-select"); // iOS and Safari of Mac can't use no-select, this will prevent the use of caretRangeFromePoint method.
        }
      });

      this.eink.onenterhighlight(areas);
      this.eink.onSwitchMode({ mode: "eink.highlight" });
      console.log("highlight touch and mouse event listeners have been set up.");
    },

    startHighlight(evt) {
      evt.preventDefault();
      evt.stopPropagation();

      console.log("Start highlight at target: ", evt.target.nodeName);

      const floatToolBar = document.getElementById("floatToolBar");
      if (floatToolBar.submenuOn === true) {
        floatToolBar.toggleSubmenu(evt);
        return;
      }

      if (evt.pointerType === "touch") {
        clearTimeout(this.countTimer);
        if (!this.lastTouch) {
          this.lastTouch = evt;
          this.maxTouchCount++;
        } else if (Math.abs(evt.clientX - this.lastTouch.clientX) > 10) {
          // The first criteria after OR operator is to prevent duplicate record of maxTouchCount if the event is propagated to other parent elements. (This is possible if there are several books.)
          // The second criteria after OR operator is to prevent duplicate record of maxTouchCount if the user click very quickly.
          this.maxTouchCount++;
        }
      }

      if (evt.target.closest(".bookContents").book.bookConfig.allowHighlight === false) return;

      if (this.maxTouchCount === 1 || ["pen", "mouse"].includes(evt.pointerType)) {
        // Handle both touch and mouse events
        const { clientX: tx0, clientY: ty0 } = evt.setPointerType === "touch" ? this.lastTouch : evt;
        this.tx0 = tx0;
        this.ty0 = ty0;
        const targetEle = document.elementFromPoint(tx0, ty0);
        this.book = targetEle?.closest(".book")?.book;

        if (this.book && this.pointWithinThePage(this.book, tx0, ty0)) {
          this.cachedStarterText = this.book.pageStarter.starter.textContent; // Cache the page starter text to check if the highlight is at the beginning of the page.
          //If erase mode is on, remove the highlight.
          if (this.highlightColor === "rgb(128, 128, 128)" || evt.buttons === 32 || (evt.altKey && evt.buttons === 1)) {
            if (targetEle) this.removeHighlight(this.book, targetEle);
          }

          // If is in highlight mode, highlight the text.
          else {
            this.targetRange = this.getCaretRangeFromPoint(tx0, ty0);
            if (this.targetRange) {
              this.highlightColorName = {
                "rgb(255, 0, 0)": "red",
                "rgb(0, 0, 255)": "blue",
                "rgb(0, 255, 0)": "green",
                "rgb(128, 128, 128)": "gray",
              }[this.highlightColor];

              if (this.targetRange.startOffset > 0) {
                this.targetRange.setStart(this.targetRange.startContainer, this.targetRange.startOffset - 1);

                // Check if the touch/click is in the targetRange, if not , correct the range.
                const { left, right } = this.targetRange.getBoundingClientRect();

                if (!(left <= tx0 && tx0 <= right)) {
                  // the range stays on the previous line, correct the range.
                  try {
                    this.targetRange.setStart(this.targetRange.startContainer, this.targetRange.startOffset + 1);
                    this.targetRange.setEnd(this.targetRange.endContainer, this.targetRange.endOffset + 1);
                  } catch (error) {
                    return;
                  }
                }
              } else {
                try {
                  this.targetRange.setEnd(this.targetRange.endContainer, this.targetRange.endOffset + 1);
                } catch (error) {
                  return;
                }
              }
            }
          }
        }
      } else if (this.maxTouchCount === 2) {
        this.longPressTimer = setTimeout(() => {
          this.lastTouch = null;
          this.maxTouchCount = 0;
          this.highlightMoved = false;
          this.tx0 = null;
          this.ty0 = null;
          this.book = undefined;
          this.highlightRemoved = false;
          this.eink.floatToolBar.exitHighlight(evt);
        }, 600);
      } else {
        /* these two lines are necessary because for some browsers, 2 touches on the screen at the same time will be separated into 2 different touch events with touches.length === 1 and touches.length === 2. So we need to clean the values got from the first touchstart event. */
        this.targetRange = undefined;
        clearTimeout(this.longPressTimer);
      }
    },

    moveHighlight(evt) {
      evt.preventDefault();
      evt.stopPropagation();

      if (this.maxTouchCount === 1 || evt.pointerType === "pen" || (evt.pointerType === "mouse" && evt.buttons === 1)) {
        if (this.eink.floatToolBar.view.style.display === "none" && !(evt.metaKey || evt.altKey)) return; // if the user doesn't keep pressing the meta key, then return.

        const { clientX: tx0, clientY: ty0 } = evt;
        if ((evt.pointerType === "touch" && Math.abs(tx0 - this.tx0) < 5 && Math.abs(ty0 - this.ty0) < 5) || (evt.pointerType === "pen" && Math.abs(tx0 - this.tx0) < 3 && Math.abs(ty0 - this.ty0) < 3)) return; // Allow some tolerance for touches that are close to the initial touch position if the user only wants to flip the page by click motion.

        if (evt.target.closest(".bookContents").book.bookConfig.allowHighlight === false) {
          let message = this.eink.lang === "zh-TW" ? "這本書不可螢光畫註" : "Highlighting is not allowed for this book.";
          this.eink.showPopup(message);
          return;
        }

        this.highlightMoved = true;

        //If erase mode is on, remove the highlight.
        if (this.highlightColor === "rgb(128, 128, 128)" || evt.buttons === 32 || (evt.altKey && evt.buttons === 1)) {
          const targetEle = document.elementFromPoint(tx0, ty0);
          if (targetEle) this.removeHighlight(this.book, targetEle);
        }

        // If is in highlight mode, highlight the text.
        else if (this.targetRange && this.pointWithinThePage(this.book, tx0, ty0)) {
          const { startContainer: endTextNode, endOffset } = this.getCaretRangeFromPoint(tx0, ty0);
          if (this.targetRange.startContainer.nodeType === Node.TEXT_NODE && endTextNode.nodeType === Node.TEXT_NODE) {
            $(".client-rect-overlay").remove();

            if (!this.reverseDir) {
              let range = Book.rangeTool.createRange(this.targetRange.startContainer, endTextNode, this.targetRange.startOffset, endOffset);
              if (range.collapsed) {
                this.reverseDir = !this.reverseDir;
                this.targetRange = Book.rangeTool.createRange(endTextNode, this.targetRange.startContainer, endOffset, this.targetRange.startOffset + 1);
              } else {
                this.targetRange = range;
              }
            } else {
              let range = Book.rangeTool.createRange(endTextNode, this.targetRange.endContainer, endOffset, this.targetRange.endOffset);
              if (range.collapsed) {
                this.reverseDir = !this.reverseDir;
                this.targetRange = Book.rangeTool.createRange(this.targetRange.endContainer, endTextNode, this.targetRange.endOffset - 1, endOffset);
              } else {
                this.targetRange = range;
              }
            }

            /* Absolutely cover a colored mask over each touched text to indicate selection.*/
            this.modifyTextNodeRanges(this.targetRange, (textNodeRange) => {
              this.addClientRectsOverlay(textNodeRange, this.highlightColor);
            });
          }
        }
      }
    },

    pointWithinThePage(book, x, y) {
      const errorTolerence = 10; // This is to prevent erroneously getting the caretPosition/caretRange from elements outside the page. (A brower's rendering bug.)
      const { left, right, top, bottom } = book.container.getBoundingClientRect();

      return x > left + book.bookConfig.leftMargin && x < right - book.bookConfig.rightMargin - errorTolerence && y > top + book.bookConfig.upperMargin && y < bottom - book.bookConfig.lowerMargin - errorTolerence;
    },

    endHighlight(evt) {
      evt.preventDefault();
      evt.stopPropagation();

      console.log("Ending highlight.....");
      /* Detect highlightMoved to prevent accidentally highlight a word during click event to flip the page. And detect range.collapsed because there's no need to make an empty highlight. */
      if (this.targetRange && this.highlightMoved && !this.targetRange.collapsed) {
        this.modifyTextNodeRanges(this.targetRange, (textNodeRange) => {
          this.markRange(textNodeRange, this.highlightColorName);
        });

        $(".client-rect-overlay").remove();
        this.joinHighlights();
        this.targetRange = undefined;
        this.marks = [];
      }

      if (evt.pointerType === "touch") {
        clearTimeout(this.longPressTimer);
        if (this.maxTouchCount === 2) {
          this.highlightColor = "rgb(0, 255, 0)";
        } else if (this.maxTouchCount === 3) {
          this.highlightColor = "rgb(255, 0, 0)";
        } else if (this.maxTouchCount === 4) {
          this.highlightColor = "rgb(0, 0, 255)";
        } else if (this.maxTouchCount === 5) {
          this.highlightColor = "rgb(128, 128, 128)";
        }
        this.eink.floatToolBar.changeHighlightColor({
          target: $(".toolDiv img").filter((index, img) => img.style.borderColor === this.highlightColor)[0].parentElement,
          stopPropagation: () => {},
        });

        this.countTimer = setTimeout(() => {
          this.lastTouch = null;
          this.maxTouchCount = 0;
        }, 150);
      }

      if (this.book) {
        if (evt.pointerType === "mouse" && this.highlightMoved) {
          // If it's mouse event, prevent click event to flip the page.
          this.book.preventFlip = 1;
        } else if (evt.pointerType === "touch" || evt.pointerType === "pen") {
          this.book.preventGestures = 1;
        }

        if (this.highlightMoved && this.highlightRemoved) {
          this.book.preventFlip = 1;
        }
        this.book.pageStarter = this.book.getPageStarter(); // The highlighting process may remove the book's page starter, so find it again.
        this.book.ignoreMutation = 1;
        this.book = undefined;
      }

      this.targetRange = undefined;
      this.marks = [];
      this.highlightRemoved = false;
      this.highlightMoved = false;
      this.tx0 = null;
      this.ty0 = null;

      if (evt.pointerType === "mouse" && this.eink.floatToolBar.view.style.display === "none") {
        this.eink.floatToolBar.exitHighlight(evt);
      }
      console.log("highlight properties have been reset!");
    },

    modifyTextNodeRanges(range, modifier) {
      const completeTextNodes = findCompleteTextNodesInTheRange(range);

      if (range.startContainer === range.endContainer) {
        modifier(range);
      } else {
        modifier(Book.rangeTool.createRange(range.startContainer, range.startContainer, range.startOffset, range.startContainer.length));
        completeTextNodes.forEach((node) => {
          modifier(Book.rangeTool.createRange(node, node, 0, node.textContent.length));
        });
        modifier(Book.rangeTool.createRange(range.endContainer, range.endContainer, 0, range.endOffset));
      }

      function findCompleteTextNodesInTheRange(range) {
        const cptTextNodes = [];
        const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, (node) => {
          if (range.comparePoint(node, 0) === 0) {
            return NodeFilter.FILTER_ACCEPT;
          } else {
            return NodeFilter.FILTER_REJECT;
          }
        });

        let cptTextNode = walker.nextNode();
        while (cptTextNode && cptTextNode !== range.endContainer) {
          if (cptTextNode !== range.startContainer) {
            cptTextNodes.push(cptTextNode);
          }
          cptTextNode = walker.nextNode();
        }
        return cptTextNodes;
      }
    },

    getCaretRangeFromPoint(x, y) {
      if (document.caretPositionFromPoint) {
        const caretPosition = document.caretPositionFromPoint(x, y);
        if (caretPosition) {
          const range = document.createRange();
          range.setStart(caretPosition.offsetNode, caretPosition.offset);
          range.collapse(true);
          return range;
        }
      } else if (document.caretRangeFromPoint) {
        // Safari support
        return document.caretRangeFromPoint(x, y);
      }
      return null;
    },

    markRange(range, color) {
      const mark = document.createElement(`${color}mark`.toUpperCase());
      range.surroundContents(mark);
      this.marks.push(mark);
    },

    addClientRectsOverlay(range, color) {
      color = color.slice(0, -1) + ", 0.33"; // Add transparency to the color.
      for (const rect of range.getClientRects()) {
        const tableRectDiv = document.createElement("div");
        tableRectDiv.classList.add("client-rect-overlay");
        tableRectDiv.style.position = "absolute";
        tableRectDiv.style.backgroundColor = color;
        tableRectDiv.style.pointerEvents = "none";
        const scrollTop = document.documentElement.scrollTop;
        const scrollLeft = document.documentElement.scrollLeft;
        tableRectDiv.style.margin = tableRectDiv.style.padding = "0";
        tableRectDiv.style.top = `${rect.top + scrollTop}px`;
        tableRectDiv.style.left = `${rect.left + scrollLeft}px`;
        tableRectDiv.style.width = `${rect.width}px`;
        tableRectDiv.style.height = `${rect.height}px`;
        tableRectDiv.style.zIndex = "999999"; // Ensure the overlay is always on top of other elements.
        document.documentElement.appendChild(tableRectDiv);
      }
    },

    async joinHighlights() {
      let garbages = [];
      let joinPrevPage = true;
      if (this.marks.length > 0) {
        for (let i = 0; i < this.marks.length; i++) {
          let mark = this.marks[i];
          // Check if the highlight is at the beginning of this page and ask the user whether to join the highlights on the previous page.
          if (i === 0 && mark.previousSibling && mark.previousSibling.previousSibling) {
            const prevSibling = mark.previousSibling;
            if (prevSibling === this.book.pageStarter.starter && prevSibling.previousSibling.nodeName === mark.nodeName) {
              const containPunctuation = [",", ".", ";", ":", ">", ")", "]", "}", "!", "?", "，", "。", "、", "：", "；", "！", "？", "」", "』", "》"].includes(prevSibling.previousSibling.textContent.slice(-1));
              if (containPunctuation) {
                const book = this.book;
                const { bottom } = mark.getBoundingClientRect();
                let confirmMessage = "";
                if (book.bookConfig.lang === "zh-TW") {
                  confirmMessage = "是否要將前一頁的螢光筆畫註結合？";
                } else {
                  confirmMessage = "Join highlights on the previous page?";
                }
                joinPrevPage = await this.eink.customConfirm(confirmMessage, "default", bottom / 2, book.pageWidth);
                book.ignoreMutation = 1;
              }
            }
          }

          // Check if this mark has been removed from the DOM tree during previous iteration of this for loop.
          if (!mark.parentElement) {
            garbages.push(mark);
            this.marks.splice(i, 1);
            i--; // Decrement i to account for the removed element
            continue;
          }
          mark.parentElement.normalize();

          // Check if the mark is the only content of it's "inline" parent, if it is, wraps the parent with the mark.
          mark = upLevelHighlight(mark);

          // Join previous neighboring highlights with the same color
          if (joinPrevPage) {
            while (mark.previousSibling?.nodeName === mark.nodeName) {
              mark.innerHTML = mark.previousSibling.innerHTML + mark.innerHTML;
              mark.previousSibling.remove();
              mark.parentElement.normalize();
              mark = upLevelHighlight(mark);
              console.log("Highlights have been joined!");
            }
          }
          // Join next neighboring highlights with the same color
          while (mark.nextSibling?.nodeName === mark.nodeName) {
            mark.innerHTML += mark.nextSibling.innerHTML;
            mark.nextSibling.remove();
            mark.parentElement.normalize();
            mark = upLevelHighlight(mark);
            console.log("Highlights have been joined!");
          }
        }
        if (garbages.length > 0) {
          garbages = [];
          this.joinHighlights();
        }
      }

      // Clean empty highlights produced by the joinHighlights process.
      $("greenmark, bluemark, redmark")
        .filter(function () {
          return Book.isElementEmpty(this);
        })
        .remove();

      function upLevelHighlight(mark) {
        while (mark.outerHTML === mark.parentElement.innerHTML) {
          const isInlineEle = getComputedStyle(mark.parentElement).display === "inline";
          if (isInlineEle) {
            const newMark = document.createElement(`${mark.nodeName}`.toUpperCase());
            const parentElement = mark.parentElement;
            mark.outerHTML = mark.innerHTML;
            newMark.innerHTML = parentElement.outerHTML;
            parentElement.parentElement.replaceChild(newMark, parentElement);
            mark = newMark;
            console.log("Parent element has been wrapped with the mark!");
          } else {
            break;
          }
        }
        return mark;
      }
    },

    removeHighlight(book, targetEle) {
      const highlight = targetEle?.closest("redmark, bluemark, greenmark");
      if (highlight) {
        highlight.outerHTML = highlight.innerHTML;
        book.ignoreMutation = 1;
        this.highlightRemoved = true;
      }
    },

    showNoteBook() {
      this.cachedMode = this.eink.mode;
      if (this.eink.mode === "eink.highlight") this.eink.floatToolBar.exitHighlight();
      else if (this.eink.mode === "eink.draw") this.eink.floatToolBar.exitDraw();

      this.eink.mode = "eink.notebook";

      // Show the note book control panel
      const panelObjArray = [
        this.eink.makePanelObj(
          "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhGogFFCYWS2k_Hr2bYZQp3Vt36O-3kVUlnSK758Qon7mLhBpqADpL6h16B7ZU8r1u906cXMl4PGwyVyvMIVbmWTZSFy_9Oe4PFdgq6IAeQsYWGR9d2bC5gcpAsOcLTmk6TmE8Fq3roWg/s200/Icons.001.png",
          this.eink.#increaseText,
          "increaseText"
        ),
        this.eink.makePanelObj(
          "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgigG2M2hO3UhFmHW0lMuqcJWp1xLA_PUqS5mBu1V0_45jUjEuBEmiXQMLwxqcQKbVVdRKLa88_ixO5ObMwj0_TitNM3-doOmbwH8sQcXud-24zHEKEqdA6l9nSyJ4mG5deegiImMi0Vw/s320/Icons.004.png",
          this.eink.#decreaseText,
          "decreaseText"
        ),
        this.eink.makePanelObj(
          this.eink.toolBarIconSrc.printer,
          () => {
            window.print();
          },
          "printMode"
        ),
        this.eink.makePanelObj(this.eink.toolBarIconSrc.exit_icon, this.hideNoteBook.bind(this), "hideNoteBook"),
      ];
      this.eink.setupControl(panelObjArray, 2);

      $("HTML > *").hide();
      let noteBook, highlightSection;
      if (!this.highlightBook) {
        noteBook = document.createElement("div");
        const author = document.createElement("h4");
        const webAdr = document.createElement("h4");
        const bookTitle = document.createElement("h2");
        const hlTitle = document.createElement("h3");
        highlightSection = document.createElement("div");
        highlightSection.classList.add("highlight-section");
        noteBook.classList.add("noteBook");
        if (this.eink.mainBook.bookTitle) bookTitle.textContent = this.eink.mainBook.bookTitle.textContent;
        noteBook.append(bookTitle);
        author.innerHTML = `Author: <span style="color:blue;">${this.eink.mainBook.author}</span>`;
        author.classList.add("author");
        author.setAttribute("ignoreTable", "true");
        noteBook.append(author);
        webAdr.innerHTML = `<b>Original Article: </b><a href="${window.location.href}">${window.location.href}</a>`;
        webAdr.href = window.location.href;
        webAdr.classList.add("web-address");
        webAdr.setAttribute("ignoreTable", "true");
        noteBook.append(webAdr);
        hlTitle.classList.add("highlight-title");
        hlTitle.textContent = "Highlights";
        hlTitle.setAttribute("ignoreTable", "true");
        hlTitle.style.backgroundColor = "yellow";
        noteBook.append(hlTitle);
        noteBook.append(highlightSection);
        document.documentElement.appendChild(noteBook);
        this.highlightBook = new Book(noteBook, {
          useNotes: false,
          allowDraw: false,
          allowHighlight: false,
        });
        this.highlightBook.enterEinkMode();
      } else {
        noteBook = this.highlightBook.container;
        highlightSection = noteBook.querySelector(".highlight-section");
        $(noteBook).show();
      }

      highlightSection.innerHTML = ""; // Remove previous highlights
      ["greenmark", "bluemark", "redmark"].forEach((colormark) => {
        showMarks(colormark);
      });

      function showMarks(markTagName) {
        const marks = $("body")
          .find(markTagName)
          .filter((index, mark) => {
            return !mark.parentElement?.closest("redmark, bluemark, greenmark");
          });
        if (marks.length > 0) {
          const markTitle = document.createElement("h4");
          const markList = document.createElement("ul");
          const colorName = markTagName.replace("mark", "");

          markTitle.textContent = colorName.charAt(0).toUpperCase() + colorName.slice(1) + " Marks";
          markTitle.style.color = colorName;
          highlightSection.append(markTitle);
          marks.each((index, mark) => {
            const markItem = document.createElement("li");
            markItem.innerHTML = mark.innerHTML;
            markList.append(markItem);
          });
          highlightSection.append(markList);
        }
      }
    },

    hideNoteBook() {
      $("body").show();
      $(window).off(".notebook");
      $(this.highlightBook.container).hide();

      this.eink.setupControl();
      if (this.cachedMode === "eink.highlight") {
        this.enterHighlightMode(this.eink.bookContents);
      } else this.eink.mode = "eink.read";
    },
  };

  floatToolBar = {
    eink: this,
    book: null,
    view: null,
    toolObjs: {},
    mainTool: {},
    lineWidthIcons: {},
    toolColors: [],
    mouseMoved: false,
    x0: 0,
    y0: 0,
    iconSrc: this.toolBarIconSrc,

    getColorName(colorCode) {
      const colorName = {
        "rgb(255, 0, 0)": "red",
        "rgb(0, 0, 255)": "blue",
        "rgb(0, 255, 0)": "green",
        "rgb(128, 128, 128)": "gray",
      };
      return colorName[colorCode];
    },

    getColorCode(colorName) {
      const colorCode = {
        red: "rgb(255, 0, 0)",
        blue: "rgb(0, 0, 255)",
        green: "rgb(0, 255, 0)",
        gray: "rgb(128, 128, 128)",
      };
      return colorCode[colorName];
    },

    setFloatToolBar(mode) {
      if (!this.view || this.view.mode !== mode) {
        this.view?.remove();
        const floatToolBar = document.createElement("DIV");
        let defaultColor = undefined;
        let defaultLineWidth = undefined;
        const toolWidth = 40;

        this.view = floatToolBar;
        this.view.toggleSubmenu = this.toggleSubmenu.bind(this);
        this.view.submenuOn = false;
        this.view.eraseMode = false;
        this.view.mode = mode;
        this.toolColors = ["rgb(0, 255, 0)", "rgb(0, 0, 255)", "rgb(255, 0, 0)", "rgb(128, 128, 128)", "rgb(0, 0, 0)"];
        this.view.classList.add("floatToolBar");
        this.view.classList.add("eink");
        this.view.id = "floatToolBar";
        this.view.style.top = "250px";
        this.view.style.width = toolWidth + "px";

        if (mode === "draw") {
          //setup draw float toolbar
          defaultColor = this.eink.painter.color;
          defaultLineWidth = this.eink.painter.lineWidth;
          this.lineWidthIcons = {
            1: "lightLine_icon",
            2: "mediumLine_icon",
            3: "heavyLine_icon",
          };

          this.toolObjs = {
            pencil: this.makeTool("pencilActivated_icon", this.toggleSubmenu.bind(this), "pencil"),
            colorPt: this.makeTool("", this.showColorPt.bind(this), "showColorPt"),
            lineWidth: this.makeTool(this.lineWidthIcons[defaultLineWidth], this.showLineWidth.bind(this), "showLineWidth"),
            eraser: this.makeTool("eraser_icon", this.toggleEraser.bind(this), "toggleEraser"),
            selection_erase: this.makeTool(
              "selection_erase",
              () => {
                if (this.view.submenuOn) this.toggleSubmenu();
                if (this.eink.painter.selectionMode === true) {
                  $("#mainIconImg").replaceWith(Eink.getIconImg("pencilActivated_icon", "mainIconImg"));
                  $("#selectionErase img").replaceWith(Eink.getIconImg("selection_erase"));
                } else {
                  $("#mainIconImg").replaceWith(Eink.getIconImg("selection_erase", "mainIconImg"));
                  $("#selectionErase img").replaceWith(Eink.getIconImg("pencil_icon"));
                }
                this.eink.painter.toggleSelectionMode();
              },
              "selectionErase"
            ),
            exit: this.makeTool(
              "flip_icon",
              (evt) => {
                this.exitDraw(evt);
              },
              "exitDraw"
            ),
          };
        } else {
          // setup highlight float toolbar
          defaultColor = this.eink.highlighter.highlightColor;
          defaultLineWidth = 1;
          this.toolObjs = {
            greenMark: this.makeTool("greenMarkPen_icon", this.changeHighlightColor.bind(this), "greenMark"),
            blueMark: this.makeTool("blueMarkPen_icon", this.changeHighlightColor.bind(this), "blueMark"),
            redMark: this.makeTool("redMarkPen_icon", this.changeHighlightColor.bind(this), "redMark"),
            eraser: this.makeTool("eraser_icon", this.changeHighlightColor.bind(this), "toggleEraser"),
            notebook: this.makeTool(
              "noteBook_icon",
              () => {
                this.eink.highlighter.showNoteBook();
              },
              "showNoteBook"
            ),
            exit: this.makeTool("close_icon", this.exitHighlight, "exitHighlight"),
          };
        }

        //setup mainIcon
        const mainIcon = document.createElement("DIV");
        const mainIconTool = mode === "draw" ? this.toolObjs.pencil : this.toolObjs[this.getColorName(defaultColor) + "Mark"];
        const mainIconImg = Eink.getIconImg(mainIconTool.icon);

        mainIcon.id = "mainIcon";
        mainIcon.classList.add("toolDiv");
        mainIcon.style.opacity = "0.7";
        mainIconImg.id = "mainIconImg";
        mainIconImg.style.borderStyle = "solid";
        mainIconImg.style.borderWidth = defaultLineWidth * 1.3 + "px";
        mainIconImg.style.borderColor = defaultColor;
        $(mainIcon).on("click", (evt) => {
          if (this.mouseMoved) {
            this.mouseMoved = false;
            return;
          }
          mainIconTool.func(evt);
        });
        mainIcon.append(mainIconImg);
        floatToolBar.append(mainIcon);

        //setup submenu icons
        const submenu = document.createElement("DIV");
        const toolCount = Object.keys(this.toolObjs).length;
        submenu.id = "submenu";
        submenu.style.flexDirection = "column";
        submenu.style.justifyContent = "space-evenly";
        submenu.style.height = toolWidth * toolCount + "px";
        submenu.style.display = "none";

        // Iterate over the tools object, skipping the first tool (mainIcon)
        Object.entries(this.toolObjs).forEach(([key, toolObj]) => {
          if (toolObj.name !== mainIconTool.name) {
            const toolDiv = document.createElement("DIV");
            toolDiv.id = toolObj.name;
            toolDiv.classList.add("toolDiv");

            if (toolDiv.id === "showColorPt") {
              toolDiv.innerHTML = `<div style="background-color:${defaultColor}"> </div>`;
            } else {
              toolDiv.appendChild(Eink.getIconImg(toolObj.icon));
            }

            if (mode !== "draw") {
              const colorIndex = Object.keys(this.toolObjs).indexOf(key);
              if (colorIndex < this.toolColors.length) {
                toolDiv.children[0].style.borderColor = this.toolColors[colorIndex];
              }
            }
            $(toolDiv).on("click", (evt) => {
              if (this.mouseMoved) {
                this.mouseMoved = false;
                return;
              }
              toolObj.func(evt);
            });
            submenu.append(toolDiv);
          }
        });

        floatToolBar.append(submenu);
        document.documentElement.append(floatToolBar);
        $(".toolDiv").on("pointerdown", this.handleToolBarMoveStart.bind(this));
        $(".toolDiv").on("pointermove", this.handleToolBarMove.bind(this));
        $(".toolDiv").on("pointerup", this.handleToolBarMoveEnd.bind(this));

        return floatToolBar;
      } else {
        $(this.view).show();
        return this.view;
      }
    },

    getIconImg(iconId, newID = undefined) {
      const img = document.getElementById(iconId).cloneNode(true);
      img.removeAttribute("id");
      if (newID) {
        img.id = newID;
      }
      return img;
    },

    repositionFloatToolBar() {
      if (this.view) {
        const floatToolBar = this.view;
        const isHiding = $(floatToolBar).css("display") === "none";
        if (isHiding) $(floatToolBar).show();
        const { left, top, bottom, right, width, height } = floatToolBar.getBoundingClientRect();
        if (left < 0) {
          floatToolBar.style.left = "0px";
        } else if (right > window.innerWidth) {
          floatToolBar.style.left = window.innerWidth - width + "px";
        }
        if (top < 0) {
          floatToolBar.style.top = "0px";
        } else if (bottom > window.innerHeight) {
          floatToolBar.style.top = window.innerHeight - height + "px";
        }
        if (isHiding) $(floatToolBar).hide();
      }
    },

    handleToolBarMoveStart(evt) {
      evt.stopPropagation();
      if (evt.pointerType === "touch" || evt.buttons === 1) {
        const floatToolBar = this.view;
        this.x0 = evt.clientX - floatToolBar.offsetLeft;
        this.y0 = evt.clientY - floatToolBar.offsetTop;
      }
      if (evt.pointerType === "mouse" || evt.pointerType === "pen") evt.target.setPointerCapture(evt.pointerId);
    },

    handleToolBarMove(evt) {
      evt.stopPropagation();
      if (this.x0 && this.y0) {
        if (evt.pointerType === "mouse") {
          // Add a small tolerance to allow subtle movements still being regarded as a click event.
          if ((Math.abs(evt.clientX - this.x0) > 5 || Math.abs(evt.clientY - this.y0) > 5) && evt.buttons === 1) {
            this.mouseMoved = true;
          } else {
            return;
          }
        }
        const floatToolBar = this.view;
        const newTop = evt.clientY - this.y0;
        const newLeft = evt.clientX - this.x0;
        const newBottom = newTop + floatToolBar.clientHeight;
        const newRight = newLeft + floatToolBar.clientWidth;
        $("#paletteBlock").remove();
        $("#lineWidthBlock").remove();

        //dealing Y position
        if (newTop >= 0 && newBottom <= window.innerHeight) {
          floatToolBar.style.top = newTop + "px";
        }

        //dealing X position
        if (newLeft >= 0 && newRight <= window.innerWidth) {
          floatToolBar.style.left = newLeft + "px";
        }
      }
    },

    handleToolBarMoveEnd(evt) {
      evt.stopPropagation();
      this.x0 = null;
      this.y0 = null;
    },

    toggleSubmenu(evt = undefined) {
      evt?.stopPropagation();

      const floatToolBar = document.getElementById("floatToolBar");
      const submenu = floatToolBar.querySelector("#submenu");
      const toolWidth = $("#mainIcon").width();
      const toolCount = submenu.children.length + 1; // add 1 for mainIcon
      const toolBarHeight = toolWidth * (toolCount + 1);

      if (floatToolBar.submenuOn === false) {
        // Show submenu
        submenu.style.display = "flex";
        floatToolBar.style.height = toolBarHeight + "px";
        floatToolBar.style.width = toolWidth + "px";
        submenu.style.height = toolBarHeight - toolWidth + "px";
        submenu.style.width = toolWidth + "px";

        if (parseInt(floatToolBar.style.top) + toolBarHeight < window.innerHeight) {
          floatToolBar.style.flexDirection = "column";
          submenu.style.flexDirection = "column";
        } else {
          floatToolBar.style.flexDirection = "column-reverse";
          submenu.style.flexDirection = "column-reverse";
          floatToolBar.style.top = parseInt(floatToolBar.style.top) + toolWidth - toolBarHeight + "px";
        }

        if (floatToolBar.mode === "draw") {
          $("#showLineWidth img").replaceWith(Eink.getIconImg(this.lineWidthIcons[this.eink.painter.lineWidth]));
          $("#showColorPt *").css("background-color", this.eink.painter.color);
        }
        $("#mainIcon").css("opacity", "1");
      } else {
        // Hide Submenu
        if (floatToolBar.style.flexDirection === "column-reverse") {
          floatToolBar.style.top = parseInt(floatToolBar.style.top) - toolWidth + toolBarHeight + "px";
        }
        floatToolBar.style.height = toolWidth + "px";
        submenu.style.display = "none";
        $("#mainIcon").css("opacity", "0.7");
        $("#lineWidthBlock").remove();
        $("#paletteBlock").remove();
      }
      floatToolBar.submenuOn = !floatToolBar.submenuOn;
    },

    showColorPt(evt) {
      evt.stopPropagation();

      if (!document.getElementById("paletteBlock")) {
        $("#lineWidthBlock").remove();
        const imgSize = parseInt($(this.view).css("width"));
        const currentColor = this.eink.painter.color;
        const colors = this.toolColors;
        const paletteBlock = document.createElement("DIV");
        const toolBarLeft = evt.target.offsetParent.offsetLeft;

        paletteBlock.id = "paletteBlock";
        paletteBlock.classList.add("floatToolBar");
        paletteBlock.style.flexDirection = "row";
        paletteBlock.style.flexWrap = "wrap";
        paletteBlock.style.width = imgSize * ((colors.length - 1) / 2) + 20 + "px";
        paletteBlock.style.height = imgSize * 2 + imgSize / 2 + "px";
        paletteBlock.style.top = evt.target.offsetParent.offsetTop + evt.target.offsetTop + "px";

        if (toolBarLeft > parseInt(paletteBlock.style.width)) {
          paletteBlock.style.left = toolBarLeft - parseInt(paletteBlock.style.width) - 5 + "px";
        } else {
          paletteBlock.style.left = toolBarLeft + imgSize + 5 + "px";
        }

        document.documentElement.append(paletteBlock);
        $("#paletteBlock").on("click touchstart touchmove touchend", function (e) {
          if (e.type == "touchmove") {
            e.preventDefault();
          }
          e.stopPropagation();
        });

        colors.forEach((color) => {
          const colorDiv = document.createElement("div");

          if (currentColor !== color) {
            colorDiv.style.display = "flex";
            colorDiv.style.width = imgSize + "px";
            colorDiv.style.height = imgSize + "px";
            colorDiv.style.backgroundColor = color;
            colorDiv.style.borderRadius = "100%";
            colorDiv.onclick = this.colorPicked.bind(this);
            paletteBlock.append(colorDiv);
          }
        });
      } else {
        $("#paletteBlock").remove();
      }
    },

    colorPicked(evt) {
      evt.stopPropagation();
      const color = evt.target.style.backgroundColor;

      $("#showColorPt").children().css("background-color", color);
      $("#paletteBlock").remove();
      $("#mainIconImg").css("border-color", color);
      if (this.view.eraseMode === true) {
        this.toggleEraser(evt); // Change to draw mode after picking color
      }
      this.eink.painter.color = color;
    },

    showLineWidth(evt) {
      if (!document.getElementById("lineWidthBlock")) {
        const floatToolBar = document.getElementById("floatToolBar");
        $("#paletteBlock").remove();
        const currentWidth = this.eink.painter.lineWidth;
        const imgSize = parseInt($(floatToolBar).css("width"));
        const lineWidthBlock = document.createElement("DIV");
        const toolBarLeft = evt.target.offsetParent.offsetLeft;
        const iconCount = Object.keys(this.lineWidthIcons).length - 1; // 1 is picked and showed in the submenu

        lineWidthBlock.id = "lineWidthBlock";
        lineWidthBlock.classList.add("floatToolBar");
        lineWidthBlock.style.flexDirection = "row";
        lineWidthBlock.style.width = imgSize * iconCount + 10 + "px";
        lineWidthBlock.style.height = imgSize + "px";
        lineWidthBlock.style.top = evt.target.offsetParent.offsetTop + evt.target.offsetTop + "px";

        if (toolBarLeft > parseInt(lineWidthBlock.style.width)) {
          lineWidthBlock.style.left = toolBarLeft - parseInt(lineWidthBlock.style.width) - 5 + "px";
        } else {
          lineWidthBlock.style.left = toolBarLeft + imgSize + 5 + "px";
        }

        document.documentElement.append(lineWidthBlock);
        $("#lineWidthBlock").on("click touchstart touchmove touchend", function (e) {
          if (e.type === "touchmove") {
            e.preventDefault();
          }
          e.stopPropagation();
        });

        for (const lineWidth in this.lineWidthIcons) {
          if (lineWidth != currentWidth) {
            const icon = Eink.getIconImg(this.lineWidthIcons[lineWidth]);
            icon.setAttribute("lineWidth", lineWidth);
            icon.style.display = "flex";
            icon.style.border = "1px solid red";
            icon.style.width = imgSize - 2 + "px";
            icon.style.height = imgSize - 2 + "px";
            icon.style.borderRadius = "100%";
            icon.onclick = this.widthPicked.bind(this);
            lineWidthBlock.append(icon);
          }
        }
      } else {
        $("#lineWidthBlock").remove();
      }
    },

    widthPicked(evt) {
      evt.stopPropagation();
      let lineWidth = evt.target.getAttribute("lineWidth");
      const previousImg = document.getElementById("showLineWidth").firstElementChild;
      document.getElementById("showLineWidth").replaceChild(evt.target, previousImg);
      evt.target.onclick = undefined;
      $("#mainIconImg").css("border-width", lineWidth * 1.3);
      $("#lineWidthBlock").remove();
      this.eink.painter.lineWidth = lineWidth;
      if (this.view.eraseMode) this.toggleEraser();
    },

    toggleEraser(evt) {
      evt?.stopPropagation();
      const currentColor = document.getElementById("mainIconImg").style.borderColor;
      const currentWidth = parseInt(document.getElementById("mainIconImg").style.borderWidth);
      if (this.view.eraseMode === true) {
        $("#mainIconImg").replaceWith(Eink.getIconImg("pencilActivated_icon", "mainIconImg"));
        $("#toggleEraser img").replaceWith(Eink.getIconImg("eraser_icon"));
      } else {
        $("#mainIconImg").replaceWith(Eink.getIconImg("eraserActivated_icon", "mainIconImg"));
        $("#toggleEraser img").replaceWith(Eink.getIconImg("pencil_icon"));
      }
      $("#mainIconImg").css("border-color", currentColor);
      $("#mainIconImg").css("border-width", currentWidth);
      this.view.eraseMode = !this.view.eraseMode;
      this.eink.painter.mode = this.eink.painter.mode === "draw" ? "erase" : "draw";
      this.toggleSubmenu(evt);
    },

    changeHighlightColor(evt) {
      evt.stopPropagation();
      if (!evt.target.closest("#mainIcon")) {
        // If the mainIcon toolDiv is clicked, it is used to toggle submenu rather than changing the highlight color.
        const colorPicked = evt.target.firstElementChild.style.borderColor;
        const currentColor = document.getElementById("mainIconImg").style.borderColor;

        if (this.getColorName(colorPicked) === "gray") {
          $("#mainIconImg").replaceWith(Eink.getIconImg("eraserActivated_icon", "mainIconImg"));
        } else {
          $("#mainIconImg").replaceWith(Eink.getIconImg(`${this.getColorName(colorPicked)}MarkPen_icon`, "mainIconImg"));
        }
        this.eink.highlighter.highlightColor = colorPicked;
        $("#mainIconImg").css("border-color", colorPicked);

        let returnedIcon;
        if (this.getColorName(currentColor) === "gray") {
          returnedIcon = Eink.getIconImg("eraser_icon");
        } else {
          returnedIcon = Eink.getIconImg(`${this.getColorName(currentColor)}MarkPen_icon`);
        }
        returnedIcon.style.borderColor = currentColor;
        $(evt.target.firstElementChild).replaceWith(returnedIcon);
      }
      if (evt.type) this.toggleSubmenu(evt); //evt.type is used to distinguish between true click event or fake event called by the endHighlight function of highlighter.
    },

    exitDraw: (evt) => {
      evt?.stopPropagation();
      this.painter.disableDraw();

      this.mode = "eink.read";
      this.#setupListeners();
      this.onexitdraw();
      this.onSwitchMode({ mode: "eink.read" });
    },

    exitHighlight: (evt) => {
      evt?.stopPropagation();
      this.#setupListeners();
      this.highlighter.highlightAreas.forEach((area) => {
        if (area) {
          $(area).off(".highlight");
          area.classList.remove("no-select");
        }
      });
      this.highlighter.highlightAreas = [];
      if (this.floatToolBar.view.submenuOn) this.floatToolBar.toggleSubmenu();
      $(this.floatToolBar.view).hide();
      this.books.forEach((book) => {
        book.preventTouchEnd = false;
      });
      this.mode = this.noteBook?.book.isVisible ? "eink.notebook" : "eink.read";
      this.onexithighlight();
      this.onSwitchMode({ mode: "eink.read" });
      console.log("Exit highlight mode");
    },

    makeTool: (icon, func, name) => ({
      icon,
      func,
      name,
    }),
  };
}

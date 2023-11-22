function init() {
  const parser =
    really_relaxed_json.tv.twelvetone.rjson.RJsonParserFactory.Companion.getDefault().createParser();
  const iframeSrc = "https://playground.wordpress.net/?mode=seamless";
  const iframe = document.querySelector("iframe");
  const textarea = document.querySelector("#jsontext");
  const button = document.querySelector("button");
  const urlPreviewLink = document.querySelector("#url-preview a");

  window.test = {
    iframeSrc,
    iframe,
    textarea,
    button,
  };

  function formatJson(el, jsonObject = {}) {
    el.innerHTML = prettyPrintJson.toHtml(jsonObject, {
      quoteKeys: true,
      trailingComma: false,
    });
  }

  function appendBlueprint(opts = {}) {
    const { fromButton = false } = opts;
    try {
      let blueprintString = parser.stringToJson(
        textarea.innerText.replace(/\n/g, "").replace(/\\t/g, "")
      );
      const blueprintJsonObject = JSON.parse(blueprintString);
      blueprintString = JSON.stringify(blueprintJsonObject);
      console.log("blueprintString", blueprintString);

      if (fromButton) {
        formatJson(textarea, blueprintJsonObject);
      }

      iframe.src = `${iframeSrc}?time=${new Date().getTime()}#${blueprintString}`;
      history.pushState(null, null, `#${blueprintString}`);
      const playgroundURL = iframe.src.replace(/\?mode=.*\#/, "#");
      urlPreviewLink.href = playgroundURL;
      urlPreviewLink.innerText = playgroundURL;
    } catch (error) {
      console.error(error);
    }
  }

  textarea.addEventListener("input", appendBlueprint);
  button.addEventListener("click", () => appendBlueprint({ fromButton: true }));

  let defaultBlueprint = {
    landingPage: "/wp-admin/",
    preferredVersions: {
      php: "7.4",
      wp: "5.9",
    },
    steps: [
      {
        step: "login",
        username: "admin",
        password: "password",
      },
    ],
  };
  if (window.location.hash) {
    const hash = decodeURI(window.location.hash.replace(/^#/, ""));
    try {
      const hashJson = JSON.parse(hash);
      defaultBlueprint = hashJson;
    } catch (error) {
      console.error(error);
    }
  }

  formatJson(textarea, defaultBlueprint, {
    quoteKeys: true,
    trailingComma: false,
  });

  appendBlueprint();
}

// on ready run init()
document.addEventListener("DOMContentLoaded", init);

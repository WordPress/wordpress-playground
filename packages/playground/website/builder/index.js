//*/ // Prod
const importStartPlaygroundWeb = import('https://unpkg.com/@wp-playground/client/index.js');
const fetchBlueprintSchema = fetch('https://unpkg.com/@wp-playground/blueprints/blueprint-schema.json').then(r=>r.json());
/*/ // Dev
const importStartPlaygroundWeb = import('http://localhost:8080/client/index.js');
const fetchBlueprintSchema = fetch('http://localhost:8080/blueprints/blueprint-schema.json').then(r=>r.json());
//*/



let debounce = null;
let starting = null;



let errorTag;
const showError = (error) => {
  console.error(error);
  if(!errorTag) errorTag = document.getElementById('error-output');
  errorTag.innerText = String(error);
}
const clearError = (error) => {
  if(!errorTag) errorTag = document.getElementById('error-output');
  errorTag.innerText = '';
}

const formatJson = ( jsonObject = {}) => {
  //const existing = editor.getSession().getValue();
  const formatted = JSON.stringify(jsonObject, null, 2) + "\n";
  // if(formatted !== existing) {
  //   editor.getSession().setValue(formatted)
  // }
  document.getElementById('jsontext').innerText = formatted;
};

function getCurrentBlueprint() {
  const blueprint = JSON.parse( document.getElementById('jsontext').innerText.replace(/\n/g, '') );
  if ( blueprint.features && blueprint.features.networking === false ) {
    blueprint.features.networking = true;
  }
  return blueprint;
}

const fetchBluePrintFromAI = async () => {
  const description = document.getElementById('prompt').value;
  const blueprint = getCurrentBlueprint();
  document.body.setAttribute('data-starting', true);
  document.getElementById( 'prompt' ).setAttribute( 'disabled', true );

  console.log( 'Calling AI', description, blueprint );
  const response = await fetch('https://public-api.wordpress.com/wpcom/v2/playground/ai/blueprint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description,
      blueprint,
    }),
  });
  const json = await response.json();
  document.getElementById( 'prompt' ).setAttribute( 'disabled', false );
  document.getElementById( 'prompt' ).innerText = '';
  console.log( 'Returned AI blueprint', json );
  return json;
};

const runBlueprint = async (editor) => {
  if (starting) {
    return;
  }
  document.body.setAttribute('data-starting', true);
  try {
    clearError();
    window.location.hash = JSON.stringify( getCurrentBlueprint() );
    const blueprintCopy = JSON.parse( JSON.stringify( getCurrentBlueprint() ) );
    delete blueprintCopy.features; // I am getting error otherwise
  
    //window.location.hash = JSON.stringify(JSON.parse(editor.getValue()));
    // const blueprintJsonObject = JSON.parse(editor.getValue());
    // formatJson(editor, blueprintJsonObject);
    const startPlaygroundWeb = (await importStartPlaygroundWeb).startPlaygroundWeb;
    starting = startPlaygroundWeb({
      iframe: document.getElementById('wp-playground'),
      remoteUrl: `https://playground.wordpress.net/remote.html`,
      blueprint: blueprintCopy,
    });
    await starting;
    starting = null;
  }
  catch (error) {
    showError(error);
  }
  finally {
    document.body.setAttribute('data-starting', false);

  }
  
};

const loadFromHash = () => {
  const hash = decodeURI(window.location.hash.substr(1));
  try {
    formatJson(JSON.parse(hash));
  } catch (error) {
    console.error(error);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const iframeSrc = "https://playground.wordpress.net/";
  const iframe = document.querySelector("iframe");
  const textarea = document.querySelector("#jsontext");
  const button = document.querySelector("button#run");
  const newTab = document.querySelector("button#new-tab");

  window.test = {
    iframeSrc,
    iframe,
    textarea,
    button,
  };

  button.addEventListener('click', () => {
    try {
      clearError();
      fetchBluePrintFromAI().then( blueprint => {
        formatJson(blueprint);
        runBlueprint();
      } );
    }
    catch (error) {
      showError(error);
    }
  });

  let prevWin;

  newTab.addEventListener('click', () => {
    runBlueprint();
    const query = new URLSearchParams();

    query.set('mode', 'seamless');
    // query.set('php', blueprint?.preferredVersions?.php);
    // query.set('wp', blueprint?.preferredVersions?.wp);
    const url = `https://playground.wordpress.net/?${query}#` + JSON.stringify(getCurrentBlueprint());
    if (prevWin) {
      prevWin.close();
    }
    prevWin = window.open(url, '_blank');
  });

  if (window.location.hash) {
    loadFromHash();
  }
  else {
    formatJson( {
      landingPage: "/wp-admin/",
      phpExtensionBundles: [
        "kitchen-sink"
      ],
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
    });
  }

  runBlueprint();

  window.addEventListener('hashchange', () => {
    loadFromHash();
    runBlueprint();
  });
});

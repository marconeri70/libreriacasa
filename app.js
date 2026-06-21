let currentBook = null;
let html5QrCode = null;
let editingBookIndex = null;

const GOOGLE_BOOKS_API_KEY = 'AIzaSyB6fg392aV7JjXI9IfCo0ROuiOgvH12QC4';

const CLOUD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxfNt2NS4v_e-EvWflkrG_MZ-7jBe6VcDEx5t98odOT0KmbRCN94ksMCCYiNLGNU9KQqA/exec';

let cloudSession = JSON.parse(localStorage.getItem('libreriaCasaCloudSession')) || null;
let library = [];

const $ = id => document.getElementById(id);

const libraryDiv = $('library');
const searchInput = $('search');
const statsDiv = $('stats');

const cloudStatus = $('cloudStatus');
const loginCode = $('loginCode');
const loginPin = $('loginPin');
const loginLibraryBtn = $('loginLibraryBtn');
const newLibraryName = $('newLibraryName');
const newLibraryCode = $('newLibraryCode');
const newLibraryPin = $('newLibraryPin');
const createLibraryBtn = $('createLibraryBtn');
const syncBtn = $('syncBtn');
const logoutLibraryBtn = $('logoutLibraryBtn');

const scanBtn = $('scanBtn');
const stopScanBtn = $('stopScanBtn');
const reader = $('reader');
const scanResult = $('scanResult');
const scannedCode = $('scannedCode');
const useScannedBtn = $('useScannedBtn');

const isbnInput = $('isbnInput');
const searchIsbnBtn = $('searchIsbnBtn');

const manualTitle = $('manualTitle');
const manualAuthor = $('manualAuthor');
const manualYear = $('manualYear');
const searchTitleBtn = $('searchTitleBtn');
const manualBtn = $('manualBtn');

const posizione = $('posizione');
const posizioneAltro = $('posizioneAltro');
const category = $('category');
const statusSelect = $('status');
const rating = $('rating');
const notes = $('notes');
const saveBtn = $('saveBtn');
const exportBtn = $('exportBtn');

const refreshLoansBtn = $('refreshLoansBtn');
const loanedBooksDiv = $('loanedBooks');
const loadRequestsBtn = $('loadRequestsBtn');
const requestsListDiv = $('requestsList');

function getLibraryStorageKey(){
  if(cloudSession && cloudSession.codiceLibreria){
    return 'library_' + cloudSession.codiceLibreria;
  }

  return 'library_offline';
}

function loadLibrary(){
  const key = getLibraryStorageKey();
  let saved = JSON.parse(localStorage.getItem(key) || 'null');

  if(!saved && key === 'library_offline'){
    saved = JSON.parse(localStorage.getItem('library') || '[]');
  }

  library = Array.isArray(saved) ? saved : [];
}

function saveLibraryLocal(){
  localStorage.setItem(getLibraryStorageKey(), JSON.stringify(library));
}

function updateCloudStatus(){
  if(!cloudSession){
    cloudStatus.innerHTML = `
      <strong>Modalità locale</strong><br>
      I libri vengono salvati solo su questo dispositivo.<br>
      Accedi o crea una libreria online per sincronizzarli.
    `;
    return;
  }

  cloudStatus.innerHTML = `
    <strong>Libreria online collegata</strong><br>
    Nome: <strong>${safe(cloudSession.nomeLibreria)}</strong><br>
    Codice: <strong>${safe(cloudSession.codiceLibreria)}</strong>
  `;
}

function cleanCode(code){
  return String(code || '')
    .replace(/[^0-9Xx]/g,'')
    .trim();
}

function cleanDigits(code){
  return String(code || '')
    .replace(/\D/g,'')
    .trim();
}

function isLikelyISBN(code){
  const clean = cleanCode(code);

  if(clean.length === 10){
    return true;
  }

  if(clean.length === 13 && (clean.startsWith('978') || clean.startsWith('979'))){
    return true;
  }

  return false;
}

function isMagazineOrIssn(code){
  const clean = cleanDigits(code);
  return clean.startsWith('977');
}

function safe(value){
  return String(value || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function normalizeCover(url){
  if(!url){
    return '';
  }

  return String(url).replace('http://','https://');
}

function getPositionValue(){
  const extra = posizioneAltro.value.trim();

  if(extra){
    return extra;
  }

  return posizione.value || 'Non indicato';
}

function ratingStars(value){
  const number = Number(value || 0);

  if(number <= 0){
    return 'Senza voto';
  }

  return '⭐'.repeat(number);
}

function loanStatusText(book){
  if(book.restituito === 'si'){
    return `✅ Restituito il ${safe(book.dataRestituzione || 'data non indicata')}`;
  }

  if(book.prestatoA){
    return `📤 Prestato a ${safe(book.prestatoA)} dal ${safe(book.dataPrestito || 'data non indicata')}`;
  }

  return '📚 Disponibile';
}

function setLoading(message){
  $('bookInfo').innerHTML = `
    <p>⏳ ${safe(message)}</p>
  `;
}

function emptyLoanFields(){
  return {
    prestatoA: '',
    dataPrestito: '',
    dataPrevistaRestituzione: '',
    restituito: '',
    dataRestituzione: ''
  };
}

function showBook(){
  if(!currentBook){
    $('bookInfo').innerHTML = 'Nessun libro selezionato';
    return;
  }

  manualTitle.value = currentBook.title || '';
  manualAuthor.value = currentBook.author || '';
  manualYear.value = currentBook.year || '';

  $('bookInfo').innerHTML = `
    <div class="preview">
      ${
        currentBook.cover
        ? `<img src="${safe(currentBook.cover)}" alt="${safe(currentBook.title)}">`
        : `<div class="cover-placeholder">📚</div>`
      }

      <div>
        <h3>📖 ${safe(currentBook.title)}</h3>
        <p>✍️ ${safe(currentBook.author)}</p>
        <p>📅 ${safe(currentBook.year)}</p>
        <p>🔢 Codice: ${safe(currentBook.isbn || 'Manuale')}</p>
        <p>🌐 Fonte: ${safe(currentBook.source || 'Manuale')}</p>
      </div>
    </div>
  `;
}

function showNotIsbnMessage(code){
  currentBook = null;

  $('bookInfo').innerHTML = `
    <h3>⚠️ Codice non valido come ISBN</h3>
    <p>Codice letto:</p>
    <p><strong>${safe(code)}</strong></p>
    <p>Probabilmente è un codice ISSN, una collana da edicola o un codice non presente nei cataloghi libri.</p>
    <p>Puoi cercare il libro per titolo oppure inserirlo manualmente.</p>
  `;
}

function makeBookFromGoogle(volumeInfo, fallbackIsbn){
  let isbn = fallbackIsbn || 'Manuale';

  if(volumeInfo.industryIdentifiers && volumeInfo.industryIdentifiers.length){
    const isbn13 = volumeInfo.industryIdentifiers.find(i => i.type === 'ISBN_13');
    const isbn10 = volumeInfo.industryIdentifiers.find(i => i.type === 'ISBN_10');

    isbn = isbn13?.identifier || isbn10?.identifier || isbn;
  }

  return {
    id: String(Date.now()),
    isbn: isbn,
    title: volumeInfo.title || 'Titolo sconosciuto',
    author: (volumeInfo.authors || ['Autore sconosciuto']).join(', '),
    year: (volumeInfo.publishedDate || 'Anno non disponibile').substring(0,4),
    cover: normalizeCover(
      volumeInfo.imageLinks?.thumbnail ||
      volumeInfo.imageLinks?.smallThumbnail ||
      ''
    ),
    source: 'Google Books',
    place: '',
    category: '',
    status: '',
    rating: 0,
    notes: '',
    ...emptyLoanFields()
  };
}

async function searchGoogleBooks(query){
  if(
    !GOOGLE_BOOKS_API_KEY ||
    GOOGLE_BOOKS_API_KEY === 'INCOLLA_QUI_LA_TUA_CHIAVE_GOOGLE_BOOKS'
  ){
    return null;
  }

  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${GOOGLE_BOOKS_API_KEY}`;

  const response = await fetch(url);

  if(!response.ok){
    return null;
  }

  const data = await response.json();

  if(data.totalItems && data.items && data.items.length > 0){
    return data.items[0].volumeInfo;
  }

  return null;
}

async function searchOpenLibraryByIsbn(isbn){
  try{
    let response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);

    if(response.ok){
      const data = await response.json();

      let author = 'Autore sconosciuto';

      if(data.authors && data.authors.length > 0){
        try{
          const authorResponse = await fetch(`https://openlibrary.org${data.authors[0].key}.json`);
          const authorData = await authorResponse.json();
          author = authorData.name || author;
        }catch(e){}
      }

      let cover = '';

      if(data.covers && data.covers.length > 0){
        cover = `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`;
      }else{
        cover = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
      }

      return {
        id: String(Date.now()),
        isbn: isbn,
        title: data.title || 'Titolo sconosciuto',
        author: author,
        year: data.publish_date || 'Anno non disponibile',
        cover: cover,
        source: 'Open Library',
        place: '',
        category: '',
        status: '',
        rating: 0,
        notes: '',
        ...emptyLoanFields()
      };
    }
  }catch(e){}

  try{
    const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}`);
    const data = await response.json();

    if(data.docs && data.docs.length > 0){
      const doc = data.docs[0];

      return {
        id: String(Date.now()),
        isbn: isbn,
        title: doc.title || 'Titolo sconosciuto',
        author: (doc.author_name || ['Autore sconosciuto']).join(', '),
        year: doc.first_publish_year || 'Anno non disponibile',
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
        source: 'Open Library',
        place: '',
        category: '',
        status: '',
        rating: 0,
        notes: '',
        ...emptyLoanFields()
      };
    }
  }catch(e){}

  return null;
}

async function searchBookByIsbn(rawCode){
  const isbn = cleanCode(rawCode);

  if(!isbn){
    alert('Inserisci un codice ISBN.');
    return;
  }

  isbnInput.value = isbn;
  scannedCode.value = isbn;

  if(isMagazineOrIssn(isbn)){
    showNotIsbnMessage(isbn);
    alert('Questo codice inizia con 977: probabilmente è un codice ISSN o da edicola, non un ISBN.');
    return;
  }

  if(!isLikelyISBN(isbn)){
    showNotIsbnMessage(isbn);
    alert('Il codice letto non sembra un ISBN valido.');
    return;
  }

  setLoading('Ricerca libro nei cataloghi online...');

  try{
    let volume = await searchGoogleBooks(`isbn:${isbn}`);

    if(!volume){
      volume = await searchGoogleBooks(isbn);
    }

    if(volume){
      currentBook = makeBookFromGoogle(volume, isbn);
      showBook();

      if(typeof openPage === 'function'){
        openPage('add');
      }

      return;
    }

    const openBook = await searchOpenLibraryByIsbn(isbn);

    if(openBook){
      currentBook = openBook;
      showBook();

      if(typeof openPage === 'function'){
        openPage('add');
      }

      return;
    }

    currentBook = null;

    $('bookInfo').innerHTML = `
      <h3>📕 Libro non trovato nei cataloghi online</h3>
      <p>ISBN letto:</p>
      <p><strong>${safe(isbn)}</strong></p>
      <p>Lo scanner ha letto correttamente il codice, ma il libro non è stato trovato automaticamente.</p>
      <p>Puoi salvarlo comunque: compila titolo, autore e anno, poi premi <strong>“Prepara inserimento manuale”</strong>.</p>
    `;

    if(typeof openPage === 'function'){
      openPage('add');
    }

    manualTitle.focus();

    alert(
      'Libro non trovato nei cataloghi online.\n\nLo scanner ha letto correttamente l’ISBN.\n\nInserisci titolo, autore e anno, poi premi “Prepara inserimento manuale”.'
    );

  }catch(e){
    currentBook = null;

    $('bookInfo').innerHTML = `
      <h3>⚠️ Errore nella ricerca online</h3>
      <p>ISBN letto:</p>
      <p><strong>${safe(isbn)}</strong></p>
      <p>Potrebbe esserci un problema temporaneo con la connessione o con la chiave Google Books.</p>
      <p>Puoi comunque salvare il libro manualmente.</p>
    `;

    if(typeof openPage === 'function'){
      openPage('add');
    }

    manualTitle.focus();

    alert(
      'Errore durante la ricerca online.\n\nControlla la connessione o la chiave Google Books.\n\nPuoi comunque inserirlo manualmente.'
    );
  }
}

async function searchBookByTitle(){
  const title = manualTitle.value.trim();
  const author = manualAuthor.value.trim();

  if(!title){
    alert('Inserisci almeno il titolo.');
    return;
  }

  setLoading('Ricerca per titolo in corso...');

  try{
    let query = title;

    if(author){
      query += ' ' + author;
    }

    let volume = await searchGoogleBooks(query);

    if(volume){
      currentBook = makeBookFromGoogle(volume, '');
      showBook();
      alert('Libro trovato. Controlla i dati e poi premi Salva libro.');
      return;
    }

    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
    const response = await fetch(url);
    const data = await response.json();

    if(data.docs && data.docs.length > 0){
      const doc = data.docs[0];

      currentBook = {
        id: String(Date.now()),
        isbn: doc.isbn && doc.isbn.length ? doc.isbn[0] : 'Manuale',
        title: doc.title || title,
        author: (doc.author_name || [author || 'Autore sconosciuto']).join(', '),
        year: doc.first_publish_year || manualYear.value.trim() || 'Anno non disponibile',
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
        source: 'Open Library',
        place: '',
        category: '',
        status: '',
        rating: 0,
        notes: '',
        ...emptyLoanFields()
      };

      showBook();
      alert('Libro trovato. Controlla i dati e poi premi Salva libro.');
      return;
    }

    prepareManualBook();
    alert('Libro non trovato online. È stato preparato un inserimento manuale.');

  }catch(e){
    prepareManualBook();
    alert('Errore nella ricerca. È stato preparato un inserimento manuale.');
  }
}

function prepareManualBook(){
  const title = manualTitle.value.trim();
  const author = manualAuthor.value.trim();
  const year = manualYear.value.trim();
  const isbn = isbnInput.value.trim() || scannedCode.value.trim() || 'Manuale';

  if(!title){
    alert('Inserisci almeno il titolo del libro.');
    return;
  }

  currentBook = {
    id: String(Date.now()),
    isbn: isbn || 'Manuale',
    title: title,
    author: author || 'Autore non indicato',
    year: year || 'Anno non indicato',
    cover: '',
    source: 'Manuale',
    place: '',
    category: '',
    status: '',
    rating: 0,
    notes: '',
    ...emptyLoanFields()
  };

  showBook();
}

function cloudRequest(params){
  return new Promise((resolve, reject) => {
    const callbackName = 'libreriaCasaCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo scaduto nel collegamento all’archivio online'));
    }, 20000);

    function cleanup(){
      clearTimeout(timeout);
      if(script.parentNode){
        script.parentNode.removeChild(script);
      }
      delete window[callbackName];
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    const query = new URLSearchParams({
      ...params,
      callback: callbackName,
      t: Date.now()
    });

    script.onerror = () => {
      cleanup();
      reject(new Error('Errore collegamento archivio online'));
    };

    script.src = CLOUD_SCRIPT_URL + '?' + query.toString();
    document.body.appendChild(script);
  });
}

function getAuthParams(){
  if(!cloudSession){
    return null;
  }

  return {
    codiceLibreria: cloudSession.codiceLibreria,
    pin: cloudSession.pin
  };
}

async function createOnlineLibrary(){
  const nome = newLibraryName.value.trim();
  const codice = newLibraryCode.value.trim();
  const pin = newLibraryPin.value.trim();

  if(!nome || !codice || !pin){
    alert('Compila nome libreria, codice libreria e PIN.');
    return;
  }

  if(pin.length < 4){
    alert('Il PIN deve avere almeno 4 cifre.');
    return;
  }

  try{
    cloudStatus.innerHTML = '⏳ Creazione libreria online...';

    const result = await cloudRequest({
      action: 'createLibrary',
      nomeLibreria: nome,
      codiceLibreria: codice,
      pin: pin
    });

    if(!result.ok){
      updateCloudStatus();
      alert(result.error || 'Errore nella creazione della libreria.');
      return;
    }

    cloudSession = {
      codiceLibreria: result.codiceLibreria,
      nomeLibreria: result.nomeLibreria,
      pin: pin
    };

    localStorage.setItem('libreriaCasaCloudSession', JSON.stringify(cloudSession));

    loadLibrary();
    updateCloudStatus();
    renderLibrary(searchInput.value);
    renderLoans();
    updateStats();

    newLibraryName.value = '';
    newLibraryCode.value = '';
    newLibraryPin.value = '';

    alert('✅ Libreria online creata e collegata.');

  }catch(e){
    updateCloudStatus();
    alert('Errore collegamento archivio online. Riprova.');
  }
}

async function loginOnlineLibrary(){
  const codice = loginCode.value.trim();
  const pin = loginPin.value.trim();

  if(!codice || !pin){
    alert('Inserisci codice libreria e PIN.');
    return;
  }

  try{
    cloudStatus.innerHTML = '⏳ Accesso alla libreria online...';

    const result = await cloudRequest({
      action: 'login',
      codiceLibreria: codice,
      pin: pin
    });

    if(!result.ok){
      updateCloudStatus();
      alert(result.error || 'Codice o PIN non corretto.');
      return;
    }

    cloudSession = {
      codiceLibreria: result.codiceLibreria,
      nomeLibreria: result.nomeLibreria,
      pin: pin
    };

    localStorage.setItem('libreriaCasaCloudSession', JSON.stringify(cloudSession));

    loadLibrary();
    updateCloudStatus();
    renderLibrary(searchInput.value);
    renderLoans();
    updateStats();

    loginCode.value = '';
    loginPin.value = '';

    alert('✅ Accesso effettuato. Ora puoi sincronizzare i libri dall’archivio online.');

  }catch(e){
    updateCloudStatus();
    alert('Errore collegamento archivio online. Riprova.');
  }
}

function logoutOnlineLibrary(){
  const conferma = confirm('Vuoi scollegare questa libreria online da questo dispositivo? I dati online non verranno cancellati.');

  if(!conferma){
    return;
  }

  cloudSession = null;
  localStorage.removeItem('libreriaCasaCloudSession');

  loadLibrary();
  updateCloudStatus();
  renderLibrary(searchInput.value);
  renderLoans();
  updateStats();

  alert('Libreria online scollegata. Ora sei in modalità locale.');
}

async function saveBookOnline(book){
  const auth = getAuthParams();

  if(!auth){
    return {
      ok: false,
      offline: true,
      error: 'Nessuna libreria online collegata'
    };
  }

  return await cloudRequest({
    action: 'saveBook',
    ...auth,
    id: book.id,
    isbn: book.isbn || '',
    title: book.title || '',
    author: book.author || '',
    year: book.year || '',
    cover: book.cover || '',
    place: book.place || '',
    category: book.category || '',
    status: book.status || '',
    rating: book.rating || 0,
    notes: book.notes || '',
    prestatoA: book.prestatoA || '',
    dataPrestito: book.dataPrestito || '',
    dataPrevistaRestituzione: book.dataPrevistaRestituzione || '',
    restituito: book.restituito || '',
    dataRestituzione: book.dataRestituzione || ''
  });
}

async function syncFromCloud(){
  const auth = getAuthParams();

  if(!auth){
    alert('Prima accedi o crea una libreria online.');
    return;
  }

  try{
    cloudStatus.innerHTML = '⏳ Sincronizzazione in corso...';

    const result = await cloudRequest({
      action: 'listBooks',
      ...auth
    });

    if(!result.ok){
      updateCloudStatus();
      alert(result.error || 'Errore durante la sincronizzazione.');
      return;
    }

    library = (result.books || []).map(book => ({
      id: String(book.id || Date.now()),
      isbn: book.isbn || '',
      title: book.title || '',
      author: book.author || '',
      year: book.year || '',
      cover: book.cover || '',
      place: book.place || '',
      category: book.category || 'Non indicata',
      status: book.status || 'Da leggere',
      rating: Number(book.rating || 0),
      notes: book.notes || '',
      prestatoA: book.prestatoA || '',
      dataPrestito: book.dataPrestito || '',
      dataPrevistaRestituzione: book.dataPrevistaRestituzione || '',
      restituito: book.restituito || '',
      dataRestituzione: book.dataRestituzione || '',
      source: book.source || 'Archivio online'
    }));

    saveLibraryLocal();
    updateCloudStatus();
    renderLibrary(searchInput.value);
    renderLoans();
    updateStats();

    alert('✅ Sincronizzazione completata. Libri scaricati: ' + library.length);

  }catch(e){
    updateCloudStatus();
    alert('Errore collegamento archivio online. Riprova.');
  }
}

async function deleteBookOnline(id){
  const auth = getAuthParams();

  if(!auth){
    return;
  }

  try{
    await cloudRequest({
      action: 'deleteBook',
      ...auth,
      id: id
    });
  }catch(e){}
}

async function updateBookOnline(book){
  if(!cloudSession || !book || !book.id){
    return;
  }

  try{
    await deleteBookOnline(book.id);
    await saveBookOnline(book);
  }catch(e){}
}

async function requestBookOnline(book, richiedente, messaggio){
  const auth = getAuthParams();

  if(!auth){
    return {
      ok: false,
      error: 'Nessuna libreria online collegata'
    };
  }

  return await cloudRequest({
    action: 'requestBook',
    ...auth,
    idLibro: book.id,
    titoloLibro: book.title,
    richiedente: richiedente,
    messaggio: messaggio
  });
}

async function stopScanner(){
  try{
    if(html5QrCode){
      await html5QrCode.stop();
      await html5QrCode.clear();
      html5QrCode = null;
    }
  }catch(e){}

  reader.innerHTML = '';
}

async function startScanner(){
  try{
    await stopScanner();

    reader.innerHTML = '<p class="box">📷 Avvio fotocamera...</p>';

    if(!window.Html5Qrcode){
      alert('Libreria scanner non caricata. Ricarica la pagina.');
      return;
    }

    const cameras = await Html5Qrcode.getCameras();

    if(!cameras || cameras.length === 0){
      alert('Nessuna fotocamera trovata. Controlla i permessi del browser.');
      reader.innerHTML = '';
      return;
    }

    const cameraId = cameras[cameras.length - 1].id;

    html5QrCode = new Html5Qrcode('reader');

    const config = {
      fps:10,
      qrbox:{
        width:280,
        height:160
      },
      aspectRatio:1.777778
    };

    if(window.Html5QrcodeSupportedFormats){
      config.formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39
      ];
    }

    await html5QrCode.start(
      cameraId,
      config,
      async decodedText => {
        await stopScanner();

        const code = cleanCode(decodedText);

        scannedCode.value = code;
        isbnInput.value = code;
        scanResult.hidden = false;

        alert('Codice letto: ' + code + '\n\nControllalo e premi “Cerca questo codice”.');
      },
      errorMessage => {}
    );

  }catch(e){
    reader.innerHTML = '';
    alert('Fotocamera non avviata. Controlla i permessi della fotocamera e ricarica la pagina.');
  }
}

function openBookDetail(index){
  const book = library[index];

  if(!book){
    return;
  }

  closeBookDetail();

  const modal = document.createElement('div');
  modal.id = 'bookDetailModal';
  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>📖 Scheda libro</h2>
        <button class="modal-close" data-close-detail>✕</button>
      </div>

      <div class="detail-content">
        ${
          book.cover
          ? `<img class="detail-cover" src="${safe(book.cover)}" alt="${safe(book.title)}">`
          : `<div class="detail-cover placeholder">📚</div>`
        }

        <div class="detail-info">
          <h3>${safe(book.title)}</h3>
          <p>✍️ <strong>Autore:</strong> ${safe(book.author)}</p>
          <p>📅 <strong>Anno:</strong> ${safe(book.year)}</p>
          <p>🔢 <strong>ISBN:</strong> ${safe(book.isbn || 'Manuale')}</p>
          <p>📍 <strong>Posizione:</strong> ${safe(book.place || 'Non indicata')}</p>
          <p>🏷️ <strong>Categoria:</strong> ${safe(book.category || 'Non indicata')}</p>
          <p>📘 <strong>Stato:</strong> ${safe(book.status || 'Da leggere')}</p>
          <p>⭐ <strong>Valutazione:</strong> ${safe(ratingStars(book.rating))}</p>
          ${book.notes ? `<p>📝 <strong>Note:</strong> ${safe(book.notes)}</p>` : ''}

          <hr>

          <p>🤝 <strong>Prestito:</strong> ${loanStatusText(book)}</p>
          ${book.dataPrevistaRestituzione ? `<p>🔔 <strong>Restituzione prevista:</strong> ${safe(book.dataPrevistaRestituzione)}</p>` : ''}
          ${book.dataRestituzione ? `<p>✅ <strong>Restituito il:</strong> ${safe(book.dataRestituzione)}</p>` : ''}
        </div>
      </div>

      <div class="detail-actions">
        <button class="secondary" data-detail-edit="${index}">✏️ Modifica libro</button>
        <button class="primary" data-detail-loan="${index}">🤝 Segna come prestato</button>
        <button class="secondary" data-detail-return="${index}">✅ Segna come restituito</button>
        <button class="secondary" data-detail-request="${index}">📩 Richiedi questo libro</button>
        <button class="danger" data-detail-delete="${index}">🗑️ Elimina libro</button>
        <button class="primary" data-close-detail>Chiudi</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', e => {
    if(e.target.id === 'bookDetailModal'){
      closeBookDetail();
    }
  });
}

function closeBookDetail(){
  const modal = document.getElementById('bookDetailModal');

  if(modal){
    modal.remove();
  }
}

function startEditBook(index){
  const book = library[index];

  if(!book){
    return;
  }

  editingBookIndex = index;
  currentBook = {...book};

  isbnInput.value = book.isbn || '';
  scannedCode.value = book.isbn || '';

  manualTitle.value = book.title || '';
  manualAuthor.value = book.author || '';
  manualYear.value = book.year || '';

  const availablePositions = Array.from(posizione.options).map(option => option.value);

  if(availablePositions.includes(book.place)){
    posizione.value = book.place;
    posizioneAltro.value = '';
  }else{
    posizione.value = 'Altro';
    posizioneAltro.value = book.place || '';
  }

  category.value = book.category || 'Non indicata';
  statusSelect.value = book.status || 'Da leggere';
  rating.value = String(book.rating || 0);
  notes.value = book.notes || '';

  showBook();
  closeBookDetail();

  if(typeof openPage === 'function'){
    openPage('add');
  }

  setTimeout(() => {
    document.getElementById('bookInfo').scrollIntoView({
      behavior:'smooth',
      block:'start'
    });
  }, 300);

  alert('Scheda aperta in modifica. Cambia i dati e poi premi “Salva libro”.');
}

async function markBookLoaned(index){
  const book = library[index];

  if(!book){
    return;
  }

  const nome = prompt('A chi è stato prestato il libro?');

  if(!nome){
    return;
  }

  const oggi = new Date().toISOString().slice(0,10);

  const dataPrestito = prompt('Data prestito:', oggi) || oggi;
  const dataPrevista = prompt('Data prevista restituzione, puoi lasciare vuoto:', '') || '';

  book.prestatoA = nome;
  book.dataPrestito = dataPrestito;
  book.dataPrevistaRestituzione = dataPrevista;
  book.restituito = 'no';
  book.dataRestituzione = '';

  saveLibraryLocal();
  renderLibrary(searchInput.value);
  renderLoans();
  updateStats();
  closeBookDetail();

  await updateBookOnline(book);

  alert('✅ Libro segnato come prestato.');
}

async function markBookReturned(index){
  const book = library[index];

  if(!book){
    return;
  }

  if(!book.prestatoA){
    alert('Questo libro non risulta prestato.');
    return;
  }

  const oggi = new Date().toISOString().slice(0,10);
  const data = prompt('Data restituzione:', oggi) || oggi;

  book.restituito = 'si';
  book.dataRestituzione = data;

  saveLibraryLocal();
  renderLibrary(searchInput.value);
  renderLoans();
  updateStats();
  closeBookDetail();

  await updateBookOnline(book);

  alert('✅ Libro segnato come restituito.');
}

async function requestBook(index){
  const book = library[index];

  if(!book){
    return;
  }

  if(!cloudSession){
    alert('Per inviare una richiesta bisogna accedere a una libreria online.');
    return;
  }

  const richiedente = prompt('Nome di chi richiede il libro:');

  if(!richiedente){
    return;
  }

  const messaggio = prompt('Messaggio facoltativo:', 'Vorrei prendere in prestito questo libro.') || '';

  try{
    const result = await requestBookOnline(book, richiedente, messaggio);

    if(result.ok){
      alert('✅ Richiesta inviata.');
    }else{
      alert(result.error || 'Errore durante l’invio della richiesta.');
    }
  }catch(e){
    alert('Errore collegamento archivio online.');
  }
}

async function saveCurrentBook(){
  if(!currentBook){
    alert('Prima scannerizza, cerca o inserisci un libro.');
    return;
  }

  const isEditing = editingBookIndex !== null && library[editingBookIndex];
  const oldBook = isEditing ? library[editingBookIndex] : null;

  const title = manualTitle.value.trim();
  const author = manualAuthor.value.trim();
  const year = manualYear.value.trim();

  if(title){
    currentBook.title = title;
  }

  if(author){
    currentBook.author = author;
  }

  if(year){
    currentBook.year = year;
  }

  currentBook.id = isEditing
    ? String(oldBook.id || Date.now())
    : String(Date.now());

  currentBook.place = getPositionValue();
  currentBook.category = category.value || 'Non indicata';
  currentBook.status = statusSelect.value || 'Da leggere';
  currentBook.rating = Number(rating.value || 0);
  currentBook.notes = notes.value.trim();

  currentBook.prestatoA = currentBook.prestatoA || '';
  currentBook.dataPrestito = currentBook.dataPrestito || '';
  currentBook.dataPrevistaRestituzione = currentBook.dataPrevistaRestituzione || '';
  currentBook.restituito = currentBook.restituito || '';
  currentBook.dataRestituzione = currentBook.dataRestituzione || '';

  const sameBook = library.find((book, index) =>
    index !== editingBookIndex &&
    book.isbn &&
    currentBook.isbn &&
    book.isbn !== 'Manuale' &&
    String(book.isbn) === String(currentBook.isbn)
  );

  if(sameBook){
    const confirmDuplicate = confirm('Questo ISBN sembra già presente. Vuoi salvarlo comunque?');

    if(!confirmDuplicate){
      return;
    }
  }

  const bookToSave = {...currentBook};

  if(isEditing){
    library[editingBookIndex] = bookToSave;
  }else{
    library.push(bookToSave);
  }

  saveLibraryLocal();

  let onlineMessage = '';

  if(cloudSession){
    try{
      if(isEditing && oldBook && oldBook.id){
        await deleteBookOnline(oldBook.id);
      }

      const result = await saveBookOnline(bookToSave);

      if(result.ok){
        onlineMessage = isEditing
          ? '\n☁️ Modifica salvata anche online.'
          : '\n☁️ Salvato anche online.';
      }else{
        onlineMessage = '\n⚠️ Salvato sul dispositivo, ma non online.';
      }
    }catch(e){
      onlineMessage = '\n⚠️ Salvato sul dispositivo, ma non online.';
    }
  }else{
    onlineMessage = '\n📱 Salvato solo su questo dispositivo.';
  }

  currentBook = null;
  editingBookIndex = null;

  $('bookInfo').innerHTML = 'Nessun libro selezionato';

  isbnInput.value = '';
  scannedCode.value = '';
  scanResult.hidden = true;

  manualTitle.value = '';
  manualAuthor.value = '';
  manualYear.value = '';

  posizione.value = '';
  posizioneAltro.value = '';
  category.value = 'Non indicata';
  statusSelect.value = 'Da leggere';
  rating.value = '0';
  notes.value = '';

  renderLibrary(searchInput.value);
  renderLoans();
  updateStats();

  alert(
    isEditing
    ? '✅ Modifiche salvate.' + onlineMessage
    : '✅ Libro salvato nella tua libreria.' + onlineMessage
  );
}

function renderLibrary(filter = ''){
  const text = filter.toLowerCase().trim();

  const books = library
    .map((book,index) => ({book,index}))
    .filter(item => {
      const book = item.book;

      const searchable = [
        book.title,
        book.author,
        book.isbn,
        book.place,
        book.category,
        book.status,
        book.notes,
        book.prestatoA
      ].join(' ').toLowerCase();

      return searchable.includes(text);
    });

  libraryDiv.innerHTML = '';

  if(books.length === 0){
    libraryDiv.innerHTML = '<p>Nessun libro presente.</p>';
    renderLoans();
    return;
  }

  books.forEach(item => {
    const book = item.book;
    const index = item.index;

    libraryDiv.innerHTML += `
      <div class="card book-card" data-open="${index}">
        <div class="card-content">
          ${
            book.cover
            ? `<img src="${safe(book.cover)}" alt="${safe(book.title)}">`
            : `<div class="cover-placeholder">📚</div>`
          }

          <div>
            <h3>📖 ${safe(book.title)}</h3>
            <p>✍️ ${safe(book.author)}</p>
            <p>📅 ${safe(book.year)}</p>
            <p>📍 ${safe(book.place)}</p>
            <p>🏷️ ${safe(book.category || 'Non indicata')}</p>
            <p>📘 ${safe(book.status || 'Da leggere')}</p>
            <p>⭐ ${safe(ratingStars(book.rating))}</p>
            <p>🔢 ${safe(book.isbn || 'Manuale')}</p>
            ${book.notes ? `<p>📝 ${safe(book.notes)}</p>` : ''}
            <p>🤝 ${loanStatusText(book)}</p>
          </div>
        </div>

        <div class="card-actions">
          <button class="open-btn" data-open="${index}">📖 Apri scheda</button>
          <button class="delete-btn" data-delete="${index}">🗑️ Elimina</button>
        </div>
      </div>
    `;
  });

  renderLoans();
}

function updateStats(){
  const total = library.length;
  const letti = library.filter(b => b.status === 'Letto').length;
  const inLettura = library.filter(b => b.status === 'In lettura').length;
  const daLeggere = library.filter(b => b.status === 'Da leggere').length;

  statsDiv.innerHTML = `
    <div class="stat">Totale libri<span>${total}</span></div>
    <div class="stat">Letti<span>${letti}</span></div>
    <div class="stat">In lettura<span>${inLettura}</span></div>
    <div class="stat">Da leggere<span>${daLeggere}</span></div>
  `;
}

async function deleteBook(index){
  const book = library[index];
  const confirmDelete = confirm('Vuoi eliminare questo libro?');

  if(!confirmDelete){
    return;
  }

  library.splice(index,1);
  saveLibraryLocal();
  renderLibrary(searchInput.value);
  renderLoans();
  updateStats();

  if(book && book.id && cloudSession){
    await deleteBookOnline(book.id);
  }
}

function renderLoans(){
  if(!loanedBooksDiv){
    return;
  }

  const prestati = library.filter(book =>
    book.prestatoA && book.restituito !== 'si'
  );

  loanedBooksDiv.innerHTML = '';

  if(prestati.length === 0){
    loanedBooksDiv.innerHTML = '<p>Nessun libro attualmente prestato.</p>';
    return;
  }

  prestati.forEach(book => {
    loanedBooksDiv.innerHTML += `
      <div class="loan-card">
        <h3>📖 ${safe(book.title)}</h3>
        <p>✍️ ${safe(book.author)}</p>
        <p>📤 Prestato a: <strong>${safe(book.prestatoA)}</strong></p>
        <p>📅 Data prestito: ${safe(book.dataPrestito || 'Non indicata')}</p>
        ${
          book.dataPrevistaRestituzione
          ? `<p>🔔 Restituzione prevista: ${safe(book.dataPrevistaRestituzione)}</p>`
          : ''
        }
        <p>📍 Posizione originale: ${safe(book.place || 'Non indicata')}</p>
      </div>
    `;
  });
}

async function loadRequests(){
  if(!requestsListDiv){
    return;
  }

  if(!cloudSession){
    alert('Per vedere le richieste devi accedere a una libreria online.');
    return;
  }

  requestsListDiv.innerHTML = '<p>⏳ Caricamento richieste...</p>';

  try{
    const result = await cloudRequest({
      action: 'listRequests',
      ...getAuthParams()
    });

    if(!result.ok){
      requestsListDiv.innerHTML = '<p>Errore nel caricamento richieste.</p>';
      alert(result.error || 'Errore durante il caricamento richieste.');
      return;
    }

    const richieste = result.richieste || [];

    if(richieste.length === 0){
      requestsListDiv.innerHTML = '<p>Nessuna richiesta ricevuta.</p>';
      return;
    }

    requestsListDiv.innerHTML = '';

    richieste.reverse().forEach(req => {
      requestsListDiv.innerHTML += `
        <div class="request-card">
          <h3>📩 ${safe(req.titoloLibro)}</h3>
          <p>👤 Richiedente: <strong>${safe(req.richiedente)}</strong></p>
          <p>💬 Messaggio: ${safe(req.messaggio || 'Nessun messaggio')}</p>
          <p>📅 Data richiesta: ${safe(req.dataRichiesta || '')}</p>
          <p><span class="request-badge">${safe(req.statoRichiesta || 'Nuova')}</span></p>
        </div>
      `;
    });

  }catch(e){
    requestsListDiv.innerHTML = '<p>Errore collegamento archivio online.</p>';
    alert('Errore collegamento archivio online.');
  }
}

function exportCSV(){
  if(library.length === 0){
    alert('Non ci sono libri da esportare.');
    return;
  }

  const headers = [
    'Titolo',
    'Autore',
    'Anno',
    'ISBN',
    'Posizione',
    'Categoria',
    'Stato',
    'Valutazione',
    'Note',
    'Prestato a',
    'Data prestito',
    'Data prevista restituzione',
    'Restituito',
    'Data restituzione'
  ];

  const rows = library.map(book => [
    book.title,
    book.author,
    book.year,
    book.isbn,
    book.place,
    book.category,
    book.status,
    book.rating,
    book.notes,
    book.prestatoA,
    book.dataPrestito,
    book.dataPrevistaRestituzione,
    book.restituito,
    book.dataRestituzione
  ]);

  const csv = [headers,...rows]
    .map(row =>
      row.map(value =>
        `"${String(value || '').replace(/"/g,'""')}"`
      ).join(',')
    )
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], {
    type:'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'libreria-casa.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

createLibraryBtn.addEventListener('click', createOnlineLibrary);
loginLibraryBtn.addEventListener('click', loginOnlineLibrary);
syncBtn.addEventListener('click', syncFromCloud);
logoutLibraryBtn.addEventListener('click', logoutOnlineLibrary);

scanBtn.addEventListener('click', startScanner);
stopScanBtn.addEventListener('click', stopScanner);

useScannedBtn.addEventListener('click', () => {
  searchBookByIsbn(scannedCode.value);
});

searchIsbnBtn.addEventListener('click', () => {
  searchBookByIsbn(isbnInput.value);
});

searchTitleBtn.addEventListener('click', searchBookByTitle);

manualBtn.addEventListener('click', () => {
  prepareManualBook();
  alert('Inserimento manuale preparato. Ora puoi scegliere posizione, categoria e salvare.');
});

saveBtn.addEventListener('click', saveCurrentBook);

searchInput.addEventListener('input', e => {
  renderLibrary(e.target.value);
});

libraryDiv.addEventListener('click', e => {
  if(e.target.dataset.delete !== undefined){
    e.stopPropagation();
    deleteBook(Number(e.target.dataset.delete));
    return;
  }

  const openTarget = e.target.closest('[data-open]');

  if(openTarget){
    openBookDetail(Number(openTarget.dataset.open));
  }
});

document.addEventListener('click', e => {
  if(e.target.dataset.closeDetail !== undefined){
    closeBookDetail();
  }

  if(e.target.dataset.detailEdit !== undefined){
    startEditBook(Number(e.target.dataset.detailEdit));
  }

  if(e.target.dataset.detailDelete !== undefined){
    const index = Number(e.target.dataset.detailDelete);
    closeBookDetail();
    deleteBook(index);
  }

  if(e.target.dataset.detailLoan !== undefined){
    markBookLoaned(Number(e.target.dataset.detailLoan));
  }

  if(e.target.dataset.detailReturn !== undefined){
    markBookReturned(Number(e.target.dataset.detailReturn));
  }

  if(e.target.dataset.detailRequest !== undefined){
    requestBook(Number(e.target.dataset.detailRequest));
  }
});

if(refreshLoansBtn){
  refreshLoansBtn.addEventListener('click', renderLoans);
}

if(loadRequestsBtn){
  loadRequestsBtn.addEventListener('click', loadRequests);
}

exportBtn.addEventListener('click', exportCSV);

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

loadLibrary();
updateCloudStatus();
renderLibrary();
renderLoans();
updateStats();

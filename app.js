let library = JSON.parse(localStorage.getItem('library')) || [];
let currentBook = null;
let html5QrCode = null;
const GOOGLE_BOOKS_API_KEY = 'AIzaSyB6fg392aV7JjXI9IfCo0ROuiOgvH12QC4';

const $ = id => document.getElementById(id);

const libraryDiv = $('library');
const searchInput = $('search');
const statsDiv = $('stats');

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

function setLoading(message){
  $('bookInfo').innerHTML = `
    <p>⏳ ${safe(message)}</p>
  `;
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
    id: Date.now(),
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
    notes: ''
  };
}

async function searchGoogleBooks(query){
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;

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
        id: Date.now(),
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
        notes: ''
      };
    }
  }catch(e){}

  try{
    const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}`);
    const data = await response.json();

    if(data.docs && data.docs.length > 0){
      const doc = data.docs[0];

      return {
        id: Date.now(),
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
        notes: ''
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

  setLoading('Ricerca libro su Open Library...');

  try{
    const openBook = await searchOpenLibraryByIsbn(isbn);

    if(openBook){
      currentBook = openBook;
      showBook();
      return;
    }

    currentBook = null;

    $('bookInfo').innerHTML = `
      <h3>📕 Libro non trovato online</h3>
      <p>Codice ISBN letto:</p>
      <p><strong>${safe(isbn)}</strong></p>
      <p>Il codice è stato inserito nel campo ISBN.</p>
      <p>Compila titolo, autore e anno, poi premi <strong>“Prepara inserimento manuale”</strong>.</p>
    `;

    manualTitle.focus();

    alert('Libro non trovato online. Inserisci titolo, autore e anno, poi premi “Prepara inserimento manuale”.');

  }catch(e){
    currentBook = null;

    $('bookInfo').innerHTML = `
      <h3>⚠️ Errore ricerca</h3>
      <p>Non è stato possibile collegarsi a Open Library.</p>
      <p>Codice ISBN:</p>
      <p><strong>${safe(isbn)}</strong></p>
      <p>Puoi comunque inserirlo manualmente.</p>
    `;

    manualTitle.focus();

    alert('Errore durante la ricerca. Puoi inserirlo manualmente.');
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
        id: Date.now(),
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
        notes: ''
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
    id: Date.now(),
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
    notes: ''
  };

  showBook();
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

function saveCurrentBook(){
  if(!currentBook){
    alert('Prima scannerizza, cerca o inserisci un libro.');
    return;
  }

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

  currentBook.id = Date.now();
  currentBook.place = getPositionValue();
  currentBook.category = category.value || 'Non indicata';
  currentBook.status = statusSelect.value || 'Da leggere';
  currentBook.rating = Number(rating.value || 0);
  currentBook.notes = notes.value.trim();

  const sameBook = library.find(book =>
    book.isbn &&
    currentBook.isbn &&
    book.isbn !== 'Manuale' &&
    book.isbn === currentBook.isbn
  );

  if(sameBook){
    const confirmDuplicate = confirm('Questo ISBN sembra già presente. Vuoi salvarlo comunque?');

    if(!confirmDuplicate){
      return;
    }
  }

  library.push({...currentBook});

  localStorage.setItem('library', JSON.stringify(library));

  currentBook = null;

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
  updateStats();

  alert('✅ Libro salvato nella tua libreria.');
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
        book.notes
      ].join(' ').toLowerCase();

      return searchable.includes(text);
    });

  libraryDiv.innerHTML = '';

  if(books.length === 0){
    libraryDiv.innerHTML = '<p>Nessun libro presente.</p>';
    return;
  }

  books.forEach(item => {
    const book = item.book;
    const index = item.index;

    libraryDiv.innerHTML += `
      <div class="card">
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
          </div>
        </div>

        <button data-delete="${index}">🗑️ Elimina libro</button>
      </div>
    `;
  });
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

function deleteBook(index){
  const confirmDelete = confirm('Vuoi eliminare questo libro?');

  if(!confirmDelete){
    return;
  }

  library.splice(index,1);
  localStorage.setItem('library', JSON.stringify(library));
  renderLibrary(searchInput.value);
  updateStats();
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
    'Note'
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
    book.notes
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
    deleteBook(Number(e.target.dataset.delete));
  }
});

exportBtn.addEventListener('click', exportCSV);

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

renderLibrary();
updateStats();

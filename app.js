let library = JSON.parse(localStorage.getItem('library')) || [];
let currentBook = null;
let html5QrCode = null;

const libraryDiv = document.getElementById('library');
const searchInput = document.getElementById('search');
const scanBtn = document.getElementById('scanBtn');
const reader = document.getElementById('reader');

const manualTitle = document.getElementById('manualTitle');
const manualAuthor = document.getElementById('manualAuthor');
const manualYear = document.getElementById('manualYear');
const manualBtn = document.getElementById('manualBtn');

function cleanCode(code) {
  return String(code || '')
    .replace(/-/g, '')
    .replace(/\s/g, '')
    .trim();
}

function isLikelyISBN(code) {
  const clean = cleanCode(code);

  if (clean.length === 10) return true;

  if (clean.length === 13 && (clean.startsWith('978') || clean.startsWith('979'))) {
    return true;
  }

  return false;
}

function isIssnOrMagazineCode(code) {
  const clean = cleanCode(code);
  return clean.startsWith('977');
}

function renderLibrary(filter = '') {
  libraryDiv.innerHTML = '';

  const text = filter.toLowerCase();

  const books = library.filter(book =>
    book.title.toLowerCase().includes(text) ||
    book.author.toLowerCase().includes(text) ||
    book.isbn.toLowerCase().includes(text) ||
    book.place.toLowerCase().includes(text)
  );

  if (books.length === 0) {
    libraryDiv.innerHTML = '<p>Nessun libro presente.</p>';
    return;
  }

  books.forEach((book, index) => {
    libraryDiv.innerHTML += `
      <div class="card">
        ${book.cover ? `<img src="${book.cover}" alt="${book.title}">` : ''}
        <h3>📖 ${book.title}</h3>
        <p>✍️ ${book.author}</p>
        <p>📅 ${book.year}</p>
        <p>📍 ${book.place}</p>
        <p>🔢 Codice: ${book.isbn || 'Manuale'}</p>
        <button onclick="deleteBook(${index})">🗑️ Elimina</button>
      </div>
    `;
  });
}

function deleteBook(index) {
  const conferma = confirm('Vuoi eliminare questo libro dalla libreria?');

  if (!conferma) return;

  library.splice(index, 1);
  localStorage.setItem('library', JSON.stringify(library));
  renderLibrary(searchInput.value);
}

function showBook() {
  document.getElementById('bookInfo').innerHTML = `
    <h3>📖 ${currentBook.title}</h3>
    <p>✍️ ${currentBook.author}</p>
    <p>📅 ${currentBook.year}</p>
    <p>🔢 Codice: ${currentBook.isbn || 'Inserimento manuale'}</p>
    ${currentBook.cover ? `<img src="${currentBook.cover}" width="120">` : ''}
  `;
}

function showManualMessage(code = '') {
  document.getElementById('bookInfo').innerHTML = `
    <h3>⚠️ Codice non riconosciuto come ISBN</h3>
    <p>Il codice letto è:</p>
    <p><strong>${code}</strong></p>
    <p>Probabilmente è un codice ISSN o un codice da edicola/collana.</p>
    <p>Puoi inserire il libro manualmente usando i campi sotto.</p>
  `;
}

async function searchBook(isbn) {
  isbn = cleanCode(isbn);

  if (isIssnOrMagazineCode(isbn)) {
    showManualMessage(isbn);
    alert('Questo codice inizia con 977: probabilmente non è un ISBN. Inserisci il libro manualmente.');
    return;
  }

  if (!isLikelyISBN(isbn)) {
    showManualMessage(isbn);
    alert('Il codice letto non sembra un ISBN valido. Puoi inserirlo manualmente.');
    return;
  }

  try {
    let response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );

    let data = await response.json();

    if (data.totalItems && data.totalItems > 0) {
      const book = data.items[0].volumeInfo;

      currentBook = {
        isbn: isbn,
        title: book.title || 'Titolo sconosciuto',
        author: (book.authors || ['Autore sconosciuto']).join(', '),
        year: (book.publishedDate || 'Anno non disponibile').substring(0, 4),
        cover: book.imageLinks?.thumbnail || '',
        place: ''
      };

      showBook();
      return;
    }

    response = await fetch(
      `https://openlibrary.org/isbn/${isbn}.json`
    );

    if (!response.ok) {
      throw new Error('Libro non trovato');
    }

    data = await response.json();

    let author = 'Autore sconosciuto';

    if (data.authors && data.authors.length > 0) {
      try {
        const authorResponse = await fetch(
          `https://openlibrary.org${data.authors[0].key}.json`
        );

        const authorData = await authorResponse.json();
        author = authorData.name || 'Autore sconosciuto';
      } catch (e) {
        author = 'Autore sconosciuto';
      }
    }

    currentBook = {
      isbn: isbn,
      title: data.title || 'Titolo sconosciuto',
      author: author,
      year: data.publish_date || 'Anno non disponibile',
      cover: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
      place: ''
    };

    showBook();

  } catch (e) {
    document.getElementById('bookInfo').innerHTML = `
      <h3>📕 Libro non trovato online</h3>
      <p>Codice letto: <strong>${isbn}</strong></p>
      <p>Puoi inserirlo manualmente compilando titolo, autore e anno.</p>
    `;

    alert('Libro non trovato online. Inseriscilo manualmente.');
  }
}

async function searchByTitle(title, author = '') {
  try {
    const query = encodeURIComponent(`${title} ${author}`);

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}`
    );

    const data = await response.json();

    if (data.totalItems && data.totalItems > 0) {
      const book = data.items[0].volumeInfo;

      currentBook = {
        isbn: book.industryIdentifiers
          ? book.industryIdentifiers[0].identifier
          : 'Manuale',
        title: book.title || title,
        author: (book.authors || [author || 'Autore sconosciuto']).join(', '),
        year: (book.publishedDate || manualYear.value || 'Anno non disponibile').substring(0, 4),
        cover: book.imageLinks?.thumbnail || '',
        place: ''
      };

      showBook();
      alert('Libro trovato tramite ricerca per titolo. Ora puoi salvarlo.');
      return true;
    }

    return false;

  } catch (e) {
    return false;
  }
}

async function startScanner() {
  try {
    reader.style.display = 'block';
    reader.innerHTML = '<p>📷 Avvio fotocamera...</p>';

    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      alert('Nessuna fotocamera trovata. Controlla i permessi del browser.');
      reader.style.display = 'none';
      return;
    }

    const cameraId = cameras[cameras.length - 1].id;

    html5QrCode = new Html5Qrcode('reader');

    await html5QrCode.start(
      cameraId,
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 150
        }
      },
      decodedText => {
        html5QrCode.stop().then(() => {
          reader.style.display = 'none';
          searchBook(decodedText);
        });
      },
      errorMessage => {}
    );

  } catch (e) {
    alert('Fotocamera non avviata. Controlla i permessi della fotocamera e ricarica la pagina.');
    reader.style.display = 'none';
  }
}

scanBtn.addEventListener('click', () => {
  startScanner();
});

manualBtn.addEventListener('click', async () => {
  const title = manualTitle.value.trim();
  const author = manualAuthor.value.trim();
  const year = manualYear.value.trim();

  if (!title) {
    alert('Inserisci almeno il titolo del libro.');
    return;
  }

  const provaRicerca = confirm(
    'Vuoi provare a cercare il libro online tramite titolo?\n\nOK = cerca online\nAnnulla = inserisci manualmente'
  );

  if (provaRicerca) {
    const trovato = await searchByTitle(title, author);

    if (trovato) {
      return;
    }

    alert('Non trovato online. Verrà preparato come inserimento manuale.');
  }

  currentBook = {
    isbn: 'Manuale',
    title: title,
    author: author || 'Autore non indicato',
    year: year || 'Anno non indicato',
    cover: '',
    place: ''
  };

  showBook();

  alert('Libro inserito manualmente. Ora premi “Salva libro”.');
});

document.getElementById('saveBtn').addEventListener('click', () => {
  if (!currentBook) {
    alert('Prima scannerizza, cerca o inserisci un libro.');
    return;
  }

  currentBook.place =
    document.getElementById('posizione').value || 'Non indicato';

  library.push(currentBook);

  localStorage.setItem(
    'library',
    JSON.stringify(library)
  );

  currentBook = null;

  document.getElementById('bookInfo').innerHTML = 'Nessun libro selezionato';
  document.getElementById('posizione').value = '';
  manualTitle.value = '';
  manualAuthor.value = '';
  manualYear.value = '';

  renderLibrary();

  alert('✅ Libro salvato nella tua libreria.');
});

searchInput.addEventListener('input', e => {
  renderLibrary(e.target.value);
});

renderLibrary();

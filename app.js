let library = JSON.parse(localStorage.getItem('library')) || [];
let currentBook = null;
let html5QrCode = null;

const libraryDiv = document.getElementById('library');
const searchInput = document.getElementById('search');
const scanBtn = document.getElementById('scanBtn');
const reader = document.getElementById('reader');

function renderLibrary(filter = '') {
  libraryDiv.innerHTML = '';

  const books = library.filter(book =>
    book.title.toLowerCase().includes(filter.toLowerCase()) ||
    book.author.toLowerCase().includes(filter.toLowerCase()) ||
    book.isbn.includes(filter)
  );

  if (books.length === 0) {
    libraryDiv.innerHTML = '<p>Nessun libro presente.</p>';
    return;
  }

  books.forEach(book => {
    libraryDiv.innerHTML += `
      <div class="card">
        ${book.cover ? `<img src="${book.cover}" alt="${book.title}">` : ''}
        <h3>📖 ${book.title}</h3>
        <p>✍️ ${book.author}</p>
        <p>📅 ${book.year}</p>
        <p>📍 ${book.place}</p>
        <p>🔢 ISBN: ${book.isbn}</p>
      </div>
    `;
  });
}

async function searchBook(isbn) {
  try {
    isbn = isbn.replace(/-/g, '').replace(/\s/g, '');

    const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);

    if (!response.ok) throw new Error();

    const data = await response.json();

    let author = 'Autore sconosciuto';

    if (data.authors && data.authors.length > 0) {
      try {
        const authorResponse = await fetch(`https://openlibrary.org${data.authors[0].key}.json`);
        const authorData = await authorResponse.json();
        author = authorData.name || 'Autore sconosciuto';
      } catch (e) {}
    }

    currentBook = {
      isbn,
      title: data.title || 'Titolo sconosciuto',
      author,
      year: data.publish_date || 'Anno non disponibile',
      cover: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
      place: ''
    };

    document.getElementById('bookInfo').innerHTML = `
      <h3>📖 ${currentBook.title}</h3>
      <p>✍️ ${currentBook.author}</p>
      <p>📅 ${currentBook.year}</p>
      <p>🔢 ISBN: ${currentBook.isbn}</p>
      <img src="${currentBook.cover}" width="120">
    `;

  } catch (e) {
    alert('Libro non trovato. Prova a inserire manualmente il codice ISBN.');
  }
}

async function startScanner() {
  reader.style.display = 'block';
  reader.innerHTML = '<p>📷 Avvio fotocamera...</p>';

  try {
    if (!window.Html5Qrcode) {
      alert('Libreria scanner non caricata. Ricarica la pagina.');
      return;
    }

    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      alert('Nessuna fotocamera trovata o permesso non concesso.');
      return;
    }

    const cameraId = cameras[cameras.length - 1].id;

    html5QrCode = new Html5Qrcode("reader");

    await html5QrCode.start(
      cameraId,
      {
        fps: 10,
        qrbox: { width: 250, height: 160 }
      },
      decodedText => {
        html5QrCode.stop().then(() => {
          reader.style.display = 'none';
          const isbn = decodedText.replace(/-/g, '').replace(/\s/g, '');
          searchBook(isbn);
        });
      },
      errorMessage => {}
    );

  } catch (err) {
    alert('Fotocamera non avviata. Controlla i permessi del browser e ricarica la pagina.');
    reader.style.display = 'none';
  }
}

scanBtn.addEventListener('click', () => {
  const scelta = confirm(
    'Vuoi usare la fotocamera?\n\nOK = Fotocamera\nAnnulla = Inserimento manuale'
  );

  if (scelta) {
    startScanner();
  } else {
    let isbn = prompt('Inserisci ISBN');
    if (!isbn) return;
    searchBook(isbn);
  }
});

document.getElementById('saveBtn').addEventListener('click', () => {
  if (!currentBook) {
    alert('Prima cerca o scannerizza un libro');
    return;
  }

  currentBook.place = document.getElementById('posizione').value || 'Non indicato';

  library.push(currentBook);
  localStorage.setItem('library', JSON.stringify(library));

  currentBook = null;
  document.getElementById('bookInfo').innerHTML = 'Nessun libro selezionato';
  document.getElementById('posizione').value = '';

  renderLibrary();
  alert('Libro salvato');
});

searchInput.addEventListener('input', e => {
  renderLibrary(e.target.value);
});

renderLibrary();

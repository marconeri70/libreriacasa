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

        ${book.cover ? `<img src="${book.cover}">` : ''}

        <h3>📖 ${book.title}</h3>

        <p>✍️ ${book.author}</p>

        <p>📅 ${book.year}</p>

        <p>📍 ${book.place}</p>

        <p>🔢 ${book.isbn}</p>

      </div>

    `;

  });

}

async function searchBook(isbn){

  isbn = isbn.replace(/-/g,'')

             .replace(/\s/g,'');

  try{

    let response = await fetch(

      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`

    );

    let data = await response.json();

    if(data.totalItems > 0){

      let book = data.items[0].volumeInfo;

      currentBook = {

        isbn:isbn,

        title:book.title || 'Titolo sconosciuto',

        author:(book.authors || ['Autore sconosciuto']).join(', '),

        year:(book.publishedDate || '').substring(0,4),

        cover:book.imageLinks?.thumbnail || '',

        place:''

      };

      showBook();

      return;

    }

    response = await fetch(

      `https://openlibrary.org/isbn/${isbn}.json`

    );

    if(!response.ok){

      throw new Error();

    }

    data = await response.json();

    currentBook = {

      isbn:isbn,

      title:data.title || 'Titolo sconosciuto',

      author:'Autore sconosciuto',

      year:data.publish_date || '',

      cover:`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,

      place:''

    };

    showBook();

  }

  catch(e){

    alert(

      '📕 Libro non trovato.\n\nInserisci un altro ISBN.'

    );

  }

}

function showBook(){

  document.getElementById('bookInfo').innerHTML = `

    <h3>📖 ${currentBook.title}</h3>

    <p>✍️ ${currentBook.author}</p>

    <p>📅 ${currentBook.year}</p>

    <img src="${currentBook.cover}" width="120">

  `;

}

async function startScanner(){

  try{

    reader.style.display='block';

    reader.innerHTML='';

    const cameras = await Html5Qrcode.getCameras();

    const cameraId = cameras[cameras.length-1].id;

    html5QrCode = new Html5Qrcode('reader');

    await html5QrCode.start(

      cameraId,

      {

        fps:10,

        qrbox:{

          width:250,

          height:150

        }

      },

      decodedText=>{

        html5QrCode.stop()

        .then(()=>{

          reader.style.display='none';

          searchBook(decodedText);

        });

      },

      ()=>{}

    );

  }

  catch(e){

    alert(

      '⚠️ Controlla i permessi della fotocamera.'

    );

  }

}

scanBtn.addEventListener('click',()=>{

  startScanner();

});

document.getElementById('saveBtn')

.addEventListener('click',()=>{

  if(!currentBook){

    alert('Prima scannerizza un libro');

    return;

  }

  currentBook.place =

  document.getElementById('posizione')

  .value || 'Non indicato';

  library.push(currentBook);

  localStorage.setItem(

    'library',

    JSON.stringify(library)

  );

  renderLibrary();

  document.getElementById('posizione')

  .value='';

  alert('✅ Libro salvato');

});

searchInput.addEventListener(

'input',

e=>{

 renderLibrary(e.target.value);

});

renderLibrary();

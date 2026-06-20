let library = JSON.parse(localStorage.getItem('library')) || [];

let currentBook = null;

function renderLibrary() {

 const container = document.getElementById('library');

 container.innerHTML = '';

 library.forEach(book => {

   container.innerHTML += `

   <div class="card">

   ${book.cover ? `<img src="${book.cover}">` : ''}

   <h3>${book.title}</h3>

   <p>✍️ ${book.author}</p>

   <p>📅 ${book.year}</p>

   <p>📍 ${book.place}</p>

   </div>

   `;

 });

}

document.getElementById('scanBtn').addEventListener('click', () => {

 const isbn = prompt('Inserisci il codice ISBN');

 if (!isbn) return;

 searchBook(isbn);

});

async function searchBook(isbn){

 try{

   const response = await fetch(

   `https://openlibrary.org/isbn/${isbn}.json`

   );

   const data = await response.json();

   currentBook={

     isbn:isbn,

     title:data.title || 'Titolo sconosciuto',

     author:'Autore non disponibile',

     year:data.publish_date || ''

   };

   document.getElementById('bookInfo').innerHTML=`

   <h3>${currentBook.title}</h3>

   <p>ISBN: ${isbn}</p>

   `;

 }

 catch(e){

   alert('Libro non trovato');

 }

}

document.getElementById('saveBtn').addEventListener('click',()=>{

 if(!currentBook){

   alert('Prima seleziona un libro');

   return;

 }

 currentBook.place =

 document.getElementById('posizione').value;

 currentBook.cover='';

 library.push(currentBook);

 localStorage.setItem(

 'library',

 JSON.stringify(library)

 );

 renderLibrary();

 alert('Libro salvato');

});

renderLibrary();

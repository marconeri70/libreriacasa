let library = JSON.parse(localStorage.getItem('library')) || [];

let currentBook = null;

const libraryDiv = document.getElementById('library');

const searchInput = document.getElementById('search');

function renderLibrary(filter = '') {

  libraryDiv.innerHTML = '';

  let books = library.filter(book =>

    book.title.toLowerCase().includes(filter.toLowerCase()) ||

    book.author.toLowerCase().includes(filter.toLowerCase())

  );

  if (books.length === 0) {

    libraryDiv.innerHTML = '<p>Nessun libro presente.</p>';

    return;

  }

  books.forEach(book => {

    libraryDiv.innerHTML += `

    <div class="card">

      ${book.cover ?

      `<img src="${book.cover}" alt="${book.title}">`

      : ''}

      <h3>📖 ${book.title}</h3>

      <p>✍️ ${book.author}</p>

      <p>📅 ${book.year}</p>

      <p>📍 ${book.place}</p>

      <p>🔢 ISBN: ${book.isbn}</p>

    </div>

    `;

  });

}

async function searchBook(isbn){

 try{

   const response = await fetch(

   `https://openlibrary.org/isbn/${isbn}.json`

   );

   if(!response.ok){

      throw new Error();

   }

   const data = await response.json();

   let author='Autore sconosciuto';

   if(data.authors){

      try{

        const a=await fetch(

        `https://openlibrary.org${data.authors[0].key}.json`

        );

        const ad=await a.json();

        author=ad.name;

      }

      catch(e){}

   }

   currentBook={

      isbn:isbn,

      title:data.title || 'Titolo sconosciuto',

      author:author,

      year:data.publish_date || '',

      cover:`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`

   };

   document.getElementById('bookInfo').innerHTML=`

   <h3>📖 ${currentBook.title}</h3>

   <p>✍️ ${currentBook.author}</p>

   <p>📅 ${currentBook.year}</p>

   <img src="${currentBook.cover}" width="120">

   `;

 }

 catch(e){

   alert('Libro non trovato');

 }

}

document.getElementById('scanBtn').addEventListener('click',()=>{

 let isbn=prompt('Inserisci ISBN');

 if(!isbn)return;

 isbn=isbn.replace(/-/g,'');

 searchBook(isbn);

});

document.getElementById('saveBtn').addEventListener('click',()=>{

 if(!currentBook){

   alert('Prima cerca un libro');

   return;

 }

 currentBook.place=

 document.getElementById('posizione').value || 'Non indicato';

 library.push(currentBook);

 localStorage.setItem(

 'library',

 JSON.stringify(library)

 );

 renderLibrary();

 alert('Libro salvato');

});

searchInput.addEventListener('input',e=>{

 renderLibrary(e.target.value);

});

renderLibrary();

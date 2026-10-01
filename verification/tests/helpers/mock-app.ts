import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Reference mock app for harness E2E tests.
 *
 * Serves deliberately plain, framework-free pages implementing the five
 * challenge contracts ("golden path") plus broken variants used to prove the
 * harness fails bad submissions. Server-side logic is intentionally minimal;
 * state lives in browser localStorage so each fresh Playwright context gets a
 * clean slate.
 */

export interface MockApp {
  readonly url: string;
  close(): Promise<void>;
}

function page(title: string, body: string, extraHead = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${extraHead}
<title>${title}</title>
</head>
<body>
${body}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Calculator                                                          */
/* ------------------------------------------------------------------ */

function calculatorHtml({ broken }: { broken?: boolean }): string {
  const clearButton = broken ? '' : '<button data-key="C">C</button>';
  return page(
    'Calculator',
    `<main>
  <h1>Calculator</h1>
  <div id="display" class="display">0</div>
  <div class="keys">
    <button data-key="7">7</button><button data-key="8">8</button><button data-key="9">9</button><button data-key="/">/</button>
    <button data-key="4">4</button><button data-key="5">5</button><button data-key="6">6</button><button data-key="*">*</button>
    <button data-key="1">1</button><button data-key="2">2</button><button data-key="3">3</button><button data-key="-">-</button>
    <button data-key="0">0</button><button data-key=".">.</button><button data-key="=">=</button><button data-key="+">+</button>
    ${clearButton}
  </div>
</main>
<style>.display{font-size:32px;text-align:right;padding:8px;border:1px solid #ccc;min-height:40px}</style>
<script>
(function () {
  var displayEl = document.getElementById('display');
  var display = '0', acc = null, op = null, fresh = true;
  function calc(o, a, b) {
    if (o === '+') { return a + b; }
    if (o === '-') { return a - b; }
    if (o === '*') { return a * b; }
    if (b === 0) { return 'Error'; }
    return a / b;
  }
  function render() { displayEl.textContent = display; }
  function digit(d) {
    if (fresh) { display = d === '.' ? '0.' : d; fresh = false; return; }
    if (d === '.' && display.indexOf('.') !== -1) { return; }
    display = display === '0' && d !== '.' ? d : display + d;
  }
  function operator(o) {
    var v = Number(display);
    if (op !== null && !fresh) { acc = calc(op, acc, v); display = String(acc); }
    else if (acc === null) { acc = v; }
    op = o; fresh = true;
  }
  function equals() {
    var v = Number(display);
    if (op !== null) {
      var r = calc(op, acc, v);
      display = String(r); acc = null; op = null; fresh = true;
    }
  }
  function clear() { display = '0'; acc = null; op = null; fresh = true; }
  function press(key) {
    if (key === 'C') { clear(); }
    else if (key === '=') { equals(); }
    else if (key === '+' || key === '-' || key === '*' || key === '/') { operator(key); }
    else { digit(key); }
    render();
  }
  document.querySelectorAll('button[data-key]').forEach(function (btn) {
    btn.addEventListener('click', function () { press(btn.getAttribute('data-key')); });
  });
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (/^[0-9.]$/.test(k)) { press(k); }
    else if (k === '+' || k === '-' || k === '*' || k === '/') { press(k); }
    else if (k === 'Enter' || k === '=') { press('='); }
    else if (k === 'Escape') { press('C'); }
  });
})();
</script>`);
}

/* ------------------------------------------------------------------ */
/* Todo + auth (localStorage-backed)                                   */
/* ------------------------------------------------------------------ */

function todoHtml(): string {
  return page(
    'Todo App',
    `<main>
  <div id="authview">
    <h1>Todo App</h1>
    <h2 id="formtitle">Log in</h2>
    <input id="email" type="email" placeholder="Email address" autocomplete="off">
    <input id="pw" type="password" placeholder="Password">
    <button id="submitbtn">Log in</button>
    <a href="#" id="togglereg">Sign up</a>
    <p id="autherror" class="error"></p>
  </div>
  <div id="todoview" hidden>
    <h1>My Todos</h1>
    <button id="logoutbtn">Log out</button>
    <input id="newtodo" type="text" placeholder="What needs doing?">
    <button id="addbtn">Add</button>
    <ul id="list"></ul>
  </div>
</main>
<script>
(function () {
  var mode = 'login';
  var authView = document.getElementById('authview');
  var todoView = document.getElementById('todoview');
  var formTitle = document.getElementById('formtitle');
  var submitBtn = document.getElementById('submitbtn');
  var toggleReg = document.getElementById('togglereg');
  var authError = document.getElementById('autherror');
  var emailInput = document.getElementById('email');
  var pwInput = document.getElementById('pw');
  var newTodo = document.getElementById('newtodo');
  var addBtn = document.getElementById('addbtn');
  var listEl = document.getElementById('list');
  var logoutBtn = document.getElementById('logoutbtn');

  function users() {
    try { return JSON.parse(localStorage.getItem('vf-users') || '{}'); }
    catch (e) { return {}; }
  }
  function session() { return localStorage.getItem('vf-session'); }
  function todosKey() { return 'vf-todos:' + session(); }
  function todos() {
    try { return JSON.parse(localStorage.getItem(todosKey()) || '[]'); }
    catch (e) { return []; }
  }
  function saveTodos(items) { localStorage.setItem(todosKey(), JSON.stringify(items)); }

  toggleReg.addEventListener('click', function (e) {
    e.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    formTitle.textContent = mode === 'login' ? 'Log in' : 'Register';
    submitBtn.textContent = mode === 'login' ? 'Log in' : 'Sign up';
    toggleReg.textContent = mode === 'login' ? 'Sign up' : 'Log in';
    authError.textContent = '';
  });

  function showTodos() {
    authView.hidden = true;
    todoView.hidden = false;
    render();
  }
  function showAuth() {
    authView.hidden = false;
    todoView.hidden = true;
    pwInput.value = '';
  }

  submitBtn.addEventListener('click', function () {
    var email = emailInput.value.trim();
    var pw = pwInput.value;
    var all = users();
    if (mode === 'register') {
      if (all[email]) {
        authError.textContent = 'Account already exists, log in instead';
        return;
      }
      if (email.indexOf('@') === -1 || pw.length === 0) {
        authError.textContent = 'Email and password are required';
        return;
      }
      all[email] = pw;
      localStorage.setItem('vf-users', JSON.stringify(all));
      localStorage.setItem('vf-session', email);
      showTodos();
    } else {
      if (!all[email] || all[email] !== pw) {
        authError.textContent = 'Invalid credentials';
        return;
      }
      localStorage.setItem('vf-session', email);
      showTodos();
    }
  });

  logoutBtn.addEventListener('click', function () {
    localStorage.removeItem('vf-session');
    showAuth();
  });

  function addTodo(text) {
    var items = todos();
    items.push({ text: text, done: false });
    saveTodos(items);
    render();
  }
  addBtn.addEventListener('click', function () {
    var text = newTodo.value.trim();
    if (text) { addTodo(text); newTodo.value = ''; }
  });
  newTodo.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var text = newTodo.value.trim();
      if (text) { addTodo(text); newTodo.value = ''; }
    }
  });

  function render() {
    var items = todos();
    listEl.innerHTML = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = item.done ? 'completed' : '';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = item.done;
      box.addEventListener('change', function () {
        item.done = box.checked;
        li.className = item.done ? 'completed' : '';
        saveTodos(items);
      });
      var span = document.createElement('span');
      span.textContent = item.text;
      var del = document.createElement('button');
      del.className = 'del';
      del.textContent = 'x';
      del.addEventListener('click', function () {
        var idx = items.indexOf(item);
        if (idx !== -1) { items.splice(idx, 1); }
        saveTodos(items);
        render();
      });
      li.appendChild(box); li.appendChild(span); li.appendChild(del);
      listEl.appendChild(li);
    });
  }

  if (session()) { showTodos(); } else { showAuth(); }
})();
</script>`);
}

/* ------------------------------------------------------------------ */
/* PDF analyzer                                                        */
/* ------------------------------------------------------------------ */

function pdfHtml(): string {
  return page(
    'PDF Analyzer',
    `<main>
  <h1>PDF Analyzer</h1>
  <label for="file">Choose a PDF</label>
  <input id="file" type="file" accept=".pdf,application/pdf">
  <div id="out"><p>No document analyzed yet.</p></div>
</main>
<script>
document.getElementById('file').addEventListener('change', function (e) {
  var f = e.target.files[0];
  if (!f) { return; }
  f.arrayBuffer().then(function (buf) {
    var bytes = new Uint8Array(buf);
    var latin = '';
    for (var i = 0; i < bytes.length; i++) { latin += String.fromCharCode(bytes[i]); }
    var matches = [];
    var re = /\\((.+?)\\) Tj/g;
    var m;
    while ((m = re.exec(latin)) !== null) { matches.push(m[1]); }
    var pageCount = (latin.match(/\\/Type \\/Page[^s]/g) || []).length;
    var escaped = matches.join('\\n').replace(/&/g, '&').replace(/</g, '<');
    document.getElementById('out').innerHTML =
      '<h3>Extraction results</h3>' +
      '<pre>' + escaped + '</pre>' +
      '<p>Pages: ' + pageCount + '</p>' +
      '<p>File: ' + f.name + '</p>' +
      '<p>Size: ' + bytes.length + ' bytes</p>';
  });
});
</script>`);
}

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

function landingHtml({ broken }: { broken?: boolean }): string {
  const viewport = broken ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const pricing = broken
    ? ''
    : `<section>
  <h2>Pricing</h2>
  <div class="plans">
    <div class="plan"><h3>Starter</h3><p>Free</p></div>
    <div class="plan"><h3>Pro</h3><p>$9 / month</p></div>
  </div>
</section>`;
  return page(
    'Ship Faster',
    `<header>
  <h1>Ship apps at speedrun pace</h1>
  <p>Race through prompts, climb the leaderboard.</p>
  <button id="cta">Get started</button>
</header>
<section>
  <h2>Features</h2>
  <ul>
    <li><h3>Verified times</h3></li>
    <li><h3>Global leaderboard</h3></li>
    <li><h3>Replay evidence</h3></li>
  </ul>
</section>
${pricing}
<footer><p>© Coderunner</p></footer>`,
    viewport
  );
}

/* ------------------------------------------------------------------ */
/* Chatbot                                                             */
/* ------------------------------------------------------------------ */

function chatHtml(): string {
  return page(
    'Chatbot',
    `<main>
  <h1>Chatbot</h1>
  <div id="log" role="log"></div>
  <input id="msg" type="text" placeholder="Type a message">
  <button id="send">Send</button>
</main>
<script>
(function () {
  var log = document.getElementById('log');
  var input = document.getElementById('msg');
  var send = document.getElementById('send');
  function post() {
    var text = input.value.trim();
    if (!text) { return; }
    var userLine = document.createElement('div');
    userLine.className = 'user';
    userLine.textContent = text;
    log.appendChild(userLine);
    input.value = '';
    setTimeout(function () {
      var botLine = document.createElement('div');
      botLine.className = 'bot';
      botLine.textContent = 'You said: ' + text + ' - acknowledged, ' + Date.now() + '.';
      log.appendChild(botLine);
    }, 700);
  }
  send.addEventListener('click', post);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { post(); }
  });
})();
</script>`);
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const ROUTES: Record<string, () => string> = {
  '/': () => landingHtml({}),
  '/landing-broken': () => landingHtml({ broken: true }),
  '/calc': () => calculatorHtml({}),
  '/calc-broken': () => calculatorHtml({ broken: true }),
  '/todo': () => todoHtml(),
  '/pdf': () => pdfHtml(),
  '/chat': () => chatHtml()
};

export function startMockApp(): Promise<MockApp> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock.test');
    if (url.pathname === '/json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"challenge":"json"}');
      return;
    }
    const handler = ROUTES[url.pathname] ?? (() => page('Not found', '<h1>404</h1>'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(handler());
  });
  return new Promise<MockApp>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((res2, rej2) => {
            server.close((err) => (err === undefined ? res2() : rej2(err)));
          })
      });
    });
  });
}

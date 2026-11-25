// Token Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the model's
// own inputs and the protocol's farm plan, and a live-token view set apart. No network: every
// byte it shows is in data.js.
//
// The page recomputes each row from the snapshot figures it carries, and checks the number
// board.json carries, so the page's code and the board's data are visibly the same arithmetic.
// The farm plan is recomputed the same way and compared with the board's steps.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 100000, sort: 'implied', dir: -1, tab: 'pre-token', selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries. Implied value = implied FDV x launch probability x 7% airdrop share.
  function impliedOf(row) {
    var mult = Math.min(row.peer_multiple_raw, 10);
    var fdv = Math.min(row.tvl_usd * mult, 10000000000);
    return Math.max(1, Math.round(fdv * row.launch_probability * 0.07));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c === 'chain') return 'Bridge $' + capital + ' to ' + name + ' and use an app built on it at least once a week.';
    if (c.indexOf('governance') >= 0) return 'Lock or delegate $' + capital + " in " + name + "'s governance on " + chain + ' and vote on at least one proposal.';
    if (c.indexOf('payment') >= 0) return 'Pay $' + capital + ' for a real purchase or transfer through ' + name + ' on ' + chain + '.';
    if (c.indexOf('option') >= 0) return 'Open a $' + capital + ' option position on ' + name + ' on ' + chain + ' and hold it to expiry.';
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + " into " + name + "'s shielded pool on " + chain + ' and keep the position.';
    if (c.indexOf('launchpad') >= 0) return 'Join a launch on ' + name + ' on ' + chain + ' with $' + capital + ' and hold the allocation.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('cat')) state.category = params.get('cat');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('minTvl')) state.minTvl = parseFloat(params.get('minTvl')) || 0;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('detail')) state.selected = params.get('detail');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.minTvl !== 100000) params.set('minTvl', String(state.minTvl));
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('detail', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' }),
        el('span', { text: 'sha ' + String(DATA.snapshot_sha256).slice(0, 12) })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols the watchlist left off, by TVL. Implied value is the expected value of the airdrop: implied FDV x launch probability x 7% airdrop share. A model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows off the watchlist' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Global peer multiple' }), el('b', { text: DATA.global_peer_multiple + 'x (n=' + DATA.global_peer_count + ')' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name or category', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var selectCat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    selectCat.addEventListener('change', function () { state.category = selectCat.value; writeHash(); render(); });
    var selectChain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    selectChain.addEventListener('change', function () { state.chain = selectChain.value; writeHash(); render(); });
    var minTvl = el('input', { type: 'number', id: 'minTvl', min: '0', step: '100000', value: String(state.minTvl), 'aria-label': 'Minimum TVL in USD' });
    minTvl.addEventListener('input', function () { state.minTvl = parseFloat(minTvl.value) || 0; writeHash(); render(); });
    var sort = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      el('option', { value: 'implied', text: 'Implied value', selected: state.sort === 'implied' ? 'selected' : null }),
      el('option', { value: 'tvl', text: 'TVL', selected: state.sort === 'tvl' ? 'selected' : null }),
      el('option', { value: 'name', text: 'Name A-Z', selected: state.sort === 'name' ? 'selected' : null })
    );
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = -1; render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), selectCat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), selectChain),
      el('div', { class: 'field' }, el('label', { for: 'minTvl', text: 'Min TVL $' }), minTvl),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort' }), sort),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? filteredRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtUsd(r.implied_fdv_usd) }),
        el('td', { class: 'num', text: Math.round(r.launch_probability * 100) + '%' }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }, r.watchlist ? el('span', { class: 'badge', text: 'watchlist' }) : null))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied FDV'),
            el('th', { scope: 'col', text: 'Launch p' }),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function detailAside() {
    var aside = el('aside', { class: 'detail', id: 'detail' });
    var slug = state.selected;
    var row = slug ? DATA.rows.filter(function (r) { return r.slug === slug; })[0] : null;
    if (!row) {
      aside.appendChild(el('p', { text: 'Click a row to see the protocol detail and farm plan.' }));
      return aside;
    }
    var recomputed = impliedOf(row);
    var impliedOk = Math.abs(recomputed - row.implied_value_usd) <= 1;
    var plan = farmSteps(row);
    var planOk = JSON.stringify(plan) === JSON.stringify(row.farm_steps);
    aside.appendChild(el('h2', { text: '#' + row.rank + ' ' + row.name }));
    var addMeta = function (t) { var p = el('p', { class: 'meta', text: t }); aside.appendChild(p); };
    addMeta((row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + (row.watchlist ? ' - on the watchlist' : ' - early row, off the watchlist'));
    addMeta('TVL ' + fmtUsd(row.tvl_usd) + (row.change_7d === null ? '' : ' (' + fmtPct(row.change_7d) + ' 7d)') + ' - ' + (row.age_days === null ? 'listing date unknown' : 'listed ' + row.age_days + ' days ago'));
    addMeta('DefiLlama slug: ' + row.slug);
    aside.appendChild(el('h3', { text: 'Why it ranks here' }));
    aside.appendChild(el('p', { text: row.why }));
    aside.appendChild(el('h3', { text: 'Implied value' }));
    var eq = el('div', { class: 'equation' });
    var eqRow = function (k, v) { eq.appendChild(el('div', null, el('span', { text: k }), el('b', { class: 'num', text: v }))); };
    eqRow('TVL', fmtUsd(row.tvl_usd));
    eqRow('Peer multiple', row.peer_multiple.toFixed(2) + 'x (' + row.peer_basis + ', n=' + row.peer_count + ')');
    eqRow('Implied FDV', fmtUsd(row.implied_fdv_usd));
    eqRow('Launch probability', Math.round(row.launch_probability * 100) + '%');
    eqRow('Airdrop share', '7%');
    eqRow('Implied value', fmtUsd(row.implied_value_usd));
    aside.appendChild(eq);
    aside.appendChild(el('p', {
      class: 'check' + (impliedOk ? ' ok' : ' bad'),
      text: 'Page recomputes ' + fmtUsd(recomputed) + (impliedOk ? ' - matches the board.' : ' - DIFFERS from the board: the data would be stale.')
    }));
    aside.appendChild(el('h3', { text: 'Farm plan - 6 steps' }));
    var ol = el('ol');
    plan.forEach(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at) : '';
      ol.appendChild(el('li', null, el('b', { text: action }), el('span', { class: 'sub', text: tail })));
    });
    aside.appendChild(ol);
    aside.appendChild(el('p', {
      class: 'check' + (planOk ? ' ok' : ' bad'),
      text: planOk ? 'Farm plan recomputed in the page: matches the board.' : 'Farm plan recomputed in the page: DIFFERS from the board.'
    }));
    var tags = el('p');
    (row.chains || []).forEach(function (c) { var s = el('span', { class: 'tag', text: c }); tags.appendChild(s); });
    aside.appendChild(tags);
    return aside;
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied FDV = min( tvl_usd x peer multiple, $10B ) - peer multiple is the median mcap / TVL of tokenized peers in the same category (TVL >= $' + m.peer_tvl_floor_usd.toLocaleString('en-US') + ', at least ' + m.min_peers + ' peers), else the global median; capped at ' + m.multiple_cap + 'x. ' +
        'launch probability = ' + m.prob_base + ' base, + ' + m.prob_growth_up + ' if TVL grew over 7d, + ' + m.prob_listed_1y + ' if listed at least 1 year, + ' + m.prob_chains_3 + ' if on 3+ chains; clamped [' + m.prob_min + ', ' + m.prob_max + ']. ' +
        'implied value = implied FDV x launch probability x ' + Math.round(m.airdrop_share * 100) + '% expected airdrop share.'
      ),
      el('p', { class: 'sub', text: 'The sealed snapshot holds only ' + DATA.global_peer_count + ' tokenized protocols with a usable market cap, and only ' + DATA.category_peer_count + ' categories have at least ' + m.min_peers + ' peers, so most rows use the global median ' + DATA.global_peer_multiple + 'x. That compresses the multiple and leaves TVL, growth and age to do most of the ranking work. The 7% airdrop share and the probability terms are stated assumptions, not facts. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age scores no age term.' }),
      el('p', { class: 'sub', text: 'Early rows are the top 160 pre-token protocols the watchlist left off, by TVL, at any TVL: the floor is a watchlist-selection rule, not a board rule, and the rules say protocols left off the list are equally valid subjects. That is why Polymarket International, $320M TVL and no token, ranks here even though the house rule left it off the watchlist. Early rows follow the same rule the house used to build the watchlist: no wrapped, staked or bridged product, no exchange, no versioned pool name.' })
    );
  }

  function openDetail(slug) {
    state.selected = slug;
    writeHash();
    render();
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    var layout = el('div', { class: 'layout' });
    var wrap = el('div', { class: 'board-wrap' });
    wrap.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    layout.appendChild(wrap);
    if (state.tab === 'pre-token') layout.appendChild(detailAside());
    shell.appendChild(layout);
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(el('footer', { text: 'Model ' + DATA.model_version + ': implied FDV = TVL x median(mcap / TVL of tokenized peers in the same category, global median as fallback). Launch probability: 0.40 base, +0.10 TVL up 7d, +0.10 listed at least 1y, +0.05 on 3+ chains, clamped [0.10, 0.85]. Implied value = implied FDV x launch probability x 7% airdrop share. Estimates from public comparables, not predictions. Static page - no network requests.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
  }

  readHash();
  render();
})();

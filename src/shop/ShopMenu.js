import { SHOP_NAME } from './catalog.js';

const CSS = `
.bs-menu{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:40;pointer-events:none;
  background:radial-gradient(circle at 50% 45%,rgba(30,10,30,.55),rgba(5,2,12,.88));font-family:Arial,Helvetica,sans-serif;color:#f4eaff}
.bs-menu.on{display:flex}
.bs-box{width:min(760px,94vw);max-height:90vh;overflow:hidden;background:rgba(16,8,30,.94);border:2px solid #ff2d4a;border-radius:10px;box-shadow:0 0 40px rgba(255,45,74,.35);padding:12px 20px}
.bs-head{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid rgba(255,45,74,.5);padding-bottom:4px;margin-bottom:2px}
.bs-title{font:900 30px Impact,'Arial Black',sans-serif;letter-spacing:2px;color:#fff4e0;text-shadow:0 0 14px #ff2d4a}
.bs-title b{color:#ffd24a;font-weight:900}
.bs-cash{font:bold 26px Impact,sans-serif;color:#6bff8a}
.bs-sec{font:bold 13px Arial,sans-serif;letter-spacing:3px;color:#ff6a7a;margin:6px 0 2px}
.bs-row{display:flex;align-items:center;gap:12px;padding:3px 10px;border-radius:6px;border:1px solid transparent;font-size:15px}
.bs-row .n{flex:1}.bs-row small{display:block;color:#a79bc4;font-size:11px;margin-top:0}
.bs-row .p{min-width:110px;text-align:right;font:bold 17px Impact,sans-serif;color:#ffd24a}
.bs-row.sel{background:rgba(255,45,74,.28);border-color:#ff2d4a}
.bs-row.off{opacity:.45}.bs-row.off .p{color:#9a8fb5}
.bs-row.poor .p{color:#ff6a6a}
.bs-foot{display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#a79bc4;border-top:1px solid rgba(255,255,255,.12);padding-top:5px}
.bs-msg{height:16px;margin-top:3px;font-size:14px;color:#6bff8a}.bs-msg.bad{color:#ff6a6a}
`;

// Buy menu overlay (keyboard first: the mouse stays locked to the game). rows: [{ section?, name, sub, price, state, run }]
export class ShopMenu {
  constructor(game) {
    this.game = game;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = this.root = document.createElement('div'); root.className = 'bs-menu';
    root.innerHTML = `<div class="bs-box"><div class="bs-head"><div class="bs-title">BULLSEYE <b>ARMS</b></div><div class="bs-cash"></div></div>
      <div class="bs-list"></div><div class="bs-msg"></div>
      <div class="bs-foot"><span>W / S or Up / Down: select &nbsp; Enter: buy</span><span>F / Esc: leave</span></div></div>`;
    game.ui.appendChild(root);
    this.cashEl = root.querySelector('.bs-cash'); this.listEl = root.querySelector('.bs-list'); this.msgEl = root.querySelector('.bs-msg');
    this.rows = []; this.sel = 0; this.getRows = null; this.msgT = 0;
    void SHOP_NAME;
  }

  get isOpen() { return this.root.classList.contains('on'); }

  open(getRows) { this.getRows = getRows; this.sel = 0; this.root.classList.add('on'); this.render(); this.msg(''); }
  close() { this.root.classList.remove('on'); }

  msg(text, bad = false) { this.msgEl.textContent = text; this.msgEl.className = 'bs-msg' + (bad ? ' bad' : ''); }

  // Rebuild the list from the current game state.
  render() {
    const rows = this.rows = this.getRows();
    this.sel = Math.max(0, Math.min(this.sel, rows.length - 1));
    this.cashEl.textContent = '$' + (this.game.state.money | 0).toLocaleString('en-US');
    let html = '', sec = null;
    rows.forEach((r, i) => {
      if (r.section !== sec) { sec = r.section; html += `<div class="bs-sec">${sec}</div>`; }
      const cls = 'bs-row' + (i === this.sel ? ' sel' : '') + (r.state === 'ok' ? '' : r.state === 'poor' ? ' poor' : ' off');
      html += `<div class="${cls} clickable" data-i="${i}"><div class="n">${r.name}<small>${r.sub}</small></div><div class="p">${r.label}</div></div>`;
    });
    this.listEl.innerHTML = html;
    for (const el of this.listEl.querySelectorAll('.bs-row')) {
      el.addEventListener('mousemove', () => { this.sel = +el.dataset.i; this.render(); });
      el.addEventListener('click', () => { this.sel = +el.dataset.i; this.buy(); });
    }
  }

  move(d) { this.sel = (this.sel + d + this.rows.length) % this.rows.length; this.render(); this.game.audio?.play?.('tick'); }
  buy() { const r = this.rows[this.sel]; if (r) r.run(); }
}

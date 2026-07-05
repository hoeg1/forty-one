"use strict";

// python -m SimpleHTTPServer
// http://localhost:8000/

class Deck {
  constructor(def = (1n << 52n) - 1n) {
    this.deck = BigInt(def);
  }
  copy() {
    return new Deck( this.deck );
  }
  is_empty() {
    return this.deck == 0n;
  }
  *loop(data = this.deck) {
    while (data != 0n) {
      const bit = data & (-data);
      yield this.bit2card(bit);
      data &= ~bit;
    }
  }
  // 山札に存在するカードについてループするが、検証済みのランクはスキップする
  *ranks(data = this.deck) {
    let skip = 0;
    while (data != 0n) {
      const bit = data & (-data);
      data &= ~bit; // del
      //
      const card = this.bit2card(bit);
      const brank = 1 << card.rank;
      // skip?
      if ((brank & skip) != 0) continue;
      skip |= brank; // add
      yield card;
    }
  }
  deal_card() {
    while (this.deck != 0n) {
      const bit = 1n << BigInt( Math.trunc(Math.random() * 52) );
      if ((bit & this.deck) != 0n) {
        this.deck &= ~bit;
        return this.bit2card(bit);
      }
    }
    throw new Error('empty');
  }
  has(bit) {
    return (this.deck & bit) == bit;
  }
  add(bit) {
    this.deck |= bit;
  }
  remove(bit) {
    this.deck &= ~bit;
  }
  bit2card(bit) {
    const pos = this.ntz(bit); // 0...51
    return {
      suit: pos &  3, // p % 4; 0bHCDS HCDS HCDS....
      rank: pos >> 2, // p / 4; 0bQQQQ AAAA 2222...
      bit:  bit
    };
  }
  rank_count(rank) {
    const mask = 0b1111n << BigInt(rank << 2);
    return this.popcount(this.deck & mask);
  }
  get length() { return this.popcount(this.deck); }
  popcount(x) {
    x = x - ((x >> 1n) & 0x5555555555555555n);
    x = (x & 0x3333333333333333n) + ((x >> 2n) & 0x3333333333333333n);
    x = (x + (x >>  4n)) & 0x0f0f0f0f0f0f0f0fn;
    x =  x + (x >>  8n);
    x =  x + (x >> 16n);
    x =  x + (x >> 32n);
    return Number(x & 0x0000007fn);
  }
  ntz(bit) {
    return this.popcount((bit & (-bit)) - 1n);
  }
}

class Rule41 {
  constructor(ba = 0n) {
    this.ba = BigInt(ba);
  }
  dump(data = this.ba, len = 56) {
    return '0b' + (Array(len).join('0') + data.toString(2)).slice(-len);
  }
  /*
  dump_ba(ba = this.ba) {
    let str = 'len ' + String( (ba >> 52n) & 0b1111n ) + ': [ ';
    for (const b of this.read_ba(ba)) {
      str += (b == 11? '-1': b == 12? 'K': b) + ', ';
    }
    return str + ']';
  }
  */
  copy() {
    return new Rule41( this.ba );
  }
  get length() {
    const mask = 0b1111n << 52n;
    const len = (this.ba & mask) >> 52n;
    return Number(len);
  }
  add_ba(rank, ba = this.ba) {
    const mask = 0b1111n << 52n;
    const len = (ba & mask) >> 52n;
    ba |= BigInt(rank) << (len * 4n);
    return (ba & ~mask) | ((len + 1n) << 52n);
  }
  add(rank) {
    this.ba = this.add_ba(rank, this.ba);
  }
  *read_ba(ba) {
    const len = Number( (ba >> 52n) & 0b1111n );
    for (let i = 0; i < len; ++i) {
      const pos = BigInt(i * 4);
      const mask = 0b1111n << pos;
      const cur = Number( (ba & mask) >> pos );
      yield cur;
    }
  }
  get_sum(ba = this.ba) {
    let sum = 0;
    let kcnt = 1;
    let prev = -99;
    for (const rank of this.read_ba(ba)) {
      if (rank == 12) {
        if (prev == -99) {
          kcnt += 1;
        } else {
          sum += prev;
        }
      } else {
        const n = rank == 11? -1: rank;
        sum += n * kcnt;
        kcnt = 1;
        prev = n;
      }
    }
    return sum;
  }
  is_legal(rank, ba = this.ba) {
    const rule = new Rule41(ba);
    rule.add(rank);
    return rule.get_sum() <= 41;
  }
  test_play(rank, ba = this.ba) {
    const rule = new Rule41(ba);
    rule.add(rank);
    return rule.get_sum();
  }
  sum2pt(sum) {
    return sum == 41? 2: (sum == 1 || sum == 11 || sum == 21 || sum == 31)? 1: 0;
  }
}

class Game41 extends Rule41 {
  constructor(view) {
    super();
    this.view = view;
    this.init();
  }
  init() {
    this.deck = new Deck();
    //
    this.round = 0;
    this.score = [0, 0];
    this.info = [new Deck(), new Deck()];
    this.dealer = Math.trunc(Math.random() * 2);
    // first dealer
    this.view.on_init(this.dealer == 1? 0: 1);
  }
  async next_round() {
    this.pass = false;
    this.round += 1;
    this.turn = this.dealer;
    this.dealer = this.dealer == 1? 0: 1;
    this.ba = 0n;
    await this.view.on_round_start(this.round, this.dealer);
    // deal
    this.hand = [new Deck(0), new Deck(0)];
    for (let i = 0; i < 6; ++i) {
      const h0 = this.deck.deal_card();
      this.hand[0].add(   h0.bit);
      this.info[0].remove(h0.bit);
      this.view.on_deal_hand(0, h0, i);
      const h1 = this.deck.deal_card();
      this.hand[1].add(   h1.bit);
      this.info[1].remove(h1.bit);
      this.view.on_deal_hand(1, h1, i);
    }
    // first one
    const first = this.deck.deal_card();
    this.add(first.rank);
    const sum = this.get_sum();
    this.view.on_first(first, sum);
    if (first.rank == 1) {
      this.score[ this.dealer ] += 1;
      await this.view.on_score(this.dealer, 'first', 1, this.copy_score());
    }
    this.info[0].remove(first.bit);
    this.info[1].remove(first.bit);
    this.view.on_info_changed(this.info[0]);
  }
  copy_score() {
    return [this.score[0], this.score[1]];
  }
  async play_loop() {
    while (true) {
      await this.next_round();
      await this.view.on_round_init_end(this.turn);
      while (await this.trick()) ;
      if (this.round == 4) {
        const winner = this.score[0] == this.score[1]? -1:
          this.score[0] > this.score[1]? 0: 1;
        this.view.on_game_over(winner, this.copy_score());
        return;
      } else {
        this.view.on_round_end(this.round);
      }
    }
  }

  async trick() {
    const hand = this.hand[ this.turn ].copy();
    const info = this.info[ this.turn ].copy();
    const ophand_cnt = this.hand[ this.turn == 1? 0: 1 ].length;
    ///////////////////////////////////////////
    // bit を返す
    await this.view.on_think_pre(this.turn);
    const result = await this.view.think(this.round, this.turn,
      hand, info, ophand_cnt, this.ba, this.pass,
      this.copy_score());
    ///////////////////////////////////////////
    if (result == 0) { // pass
      if (this.pass) {
        await this.view.on_pass(this.turn, 1, true);
        // await this.view.on_think_after(this.turn);
        return false; // round end
      } else {
        this.pass = true;
        await this.view.on_pass(this.turn, false);
        const win = this.turn == 1? 0: 1;
        this.score[ win ] += 1;
        await this.view.on_score(win, 'pass', 1, this.copy_score());
        this.turn = this.turn == 1? 0: 1;
      }
    } else {
      if (!this.hand[ this.turn ].has(result)) {
        throw new Error(`illegal bit: ${this.dump(result, 52)}`);
      }
      // legal?
      const card = this.deck.bit2card(result);
      const rank = card.rank;
      if (!this.is_legal(rank)) {
        throw new Error(`illegal card: ${rank}`);
      }
      // change
      this.hand[ this.turn ].remove(result);
      this.add(rank);
      const sum = this.get_sum();
      await this.view.on_play(this.turn, card, this.ba, sum);
      const pt = this.sum2pt(sum);
      if (pt != 0) {
        this.score[this.turn] += pt;
        await this.view.on_score(this.turn, 'play', pt, this.copy_score());
      }
      //
      this.pass = false;
      this.turn = this.turn == 1? 0: 1;
      this.info[ this.turn ].remove(result);
      if (this.turn == 0) this.view.on_info_changed(this.info[ this.turn ]);
    }
    await this.view.on_think_after(this.turn);
    return true;
  }
}



class Game41View {
  constructor(player) {
    this.player = player;
    this.is_game_over = false;
    // show
    const cas = document.querySelector('.com_and_score');
    cas.style.visibility = 'visible';
    const sum = document.getElementById('sum_box');
    sum.style.visibility = 'visible';
    const pac = document.querySelector('.pass_and_cheat');
    pac.style.visibility = 'visible';
    // event
    for (let i = 0; i < 6; ++i) {
      const hand = document.getElementById('hand_' + i);
      hand.onclick = () => {
        this.player[0].on_button(i, this);
      };
    }
    document.getElementById('pass_button').onclick = () => {
      this.player[0].on_button(-1, this);
    };
  }
  on_info_changed(info) {
    for (let i = 0; i < 13; ++i) {
      const tar = document.getElementById('tbl_' + i);
      tar.innerText = info.rank_count(i);
    }
  }
  on_init(_turn) {
    this.set_score([0, 0]);
    this.set_face('def');
  }
  async on_round_start(round, dealer) {
    document.getElementById('round_count').innerText = round;
    this.hand = [];
    this.hide_hand();
    this.hide_board();
    this.set_pass(false);
    this.all_display();
    this.all_off();
    this.mes(`ラウンド ${round}: ${this.player[dealer].name} がディーラーです`);
    await this.sleep(500);
    this.mes('');
  }
  async on_round_init_end(turn) {
    this.set_face('def');
    this.hand.sort((a,b) => {
      const x = a.rank == 11? -1: a.rank;
      const y = b.rank == 11? -1: b.rank;
      return x - y;
    });
    for (let i = 0; i < 6; ++i)
      this.set_hand(i, this.hand[i]);
    this.mes(`${this.player[turn].name} からプレイを始めます`);
    if (turn == 1) {
      await this.sleep(1000);
      this.mes('');
    }
  }
  on_deal_hand(turn, card, idx) {
    if (turn == 0) {
      this.hand.push(card);
    } else {
      this.set_com_card(idx + 1);
    }
  }
  async on_first(card, sum) {
    this.set_ba(0, card);
    this.set_sum(sum);
    await this.sleep(500);
  }
  async on_score(turn, kind, pt, score) {
    switch (kind) {
      case 'first':
        this.mes(`最初の札がＡのため、${this.player[turn].name} に１点`);
        break;
      case 'pass':
        this.mes(`パス！ ${this.player[turn].name} に１点`);
        break;
      case 'play':
        this.mes(`${this.player[turn].name} に ${pt} 点`);
        break;
      default:
        throw new Error('unknown kind: '+kind);
    }
    this.set_score(score);
    await this.sleep(1000);
    this.mes('');
  }
  async on_round_end(round) {
    this.all_off();
    this.mes(`第 ${round} ラウンド終了`);
    await this.sleep(1000);
  }
  on_game_over(winner, score) { // -1 -> 引き分け
    this.all_off();
    const win = winner == -1?
      `${score[0]} 対 ${score[1]} の引き分け`:
      this.player[winner].name + ' の勝ち';
    this.mes('ゲーム終了: ' + win);
    const fc = [
      ['def', 'think', 'yatta'],
      ['oops', 'cry', 'oh no'],
      ['wink', 'be', 'www']
    ];
    this.set_face(fc[ winner + 1 ][ Math.trunc(Math.random() * 3) ]);
    // 新規ゲーム
    this.is_game_over = true;
    const ng = document.getElementById('pass_button');
    ng.innerText = 'New Game';
    ng.removeAttribute('disabled');
  }
  async on_pass(turn, is_finish) {
    if (is_finish) {
      this.mes(`${this.player[turn].name} が FINISH を選択`);
      await this.sleep(1000);
    } else if (turn == 0) {
      //this.set_pass(turn == 1, true);
      this.set_face(['w', 'be', 'yatta'][ Math.trunc(Math.random() * 3) ]);
    }
  }
  async on_play(_turn, card, ba, sum) {
    const len = new Rule41(ba).length - 1;
    this.set_ba(len, card);
    this.set_sum(sum);
    await this.sleep(500);
  }
  hand_on_off(idx, on_off = false) {
    const tar = document.getElementById('hand_' + idx);
    if (tar.style.visibility === 'visible') {
      if (on_off) tar.removeAttribute('disabled');
      else tar.setAttribute('disabled', 'disabled');
    }
  }
  // パスなら０を返す
  // でなければ hand にある合法の bit を返す
  // 手札無しでも呼ばれうる
  async think(round, turn, hand, info, ophand_cnt, ba, pass, score) {
    const result = await (this.player[turn]).think(
      round, hand, info, ophand_cnt, ba, pass, score, this);
    if (result != 0n) {
      if (turn == 0) {
        for (let idx = 0; idx < this.hand.length; ++idx) {
          if (this.hand[idx].bit == result) {
            this.hide_player_hand(idx);
            break;
          }
        }
      } else { // com
        this.set_com_card(hand.length, false);
      }
    }
    return result;
  }
  async on_think_pre(turn) {
    if (turn == 0) {
      this.mes(`${this.player[turn].name} のターン`);
      await this.sleep(100);
    }
  }
  async on_think_after(turn) {
    this.mes('');
    if (turn == 0) await this.sleep(10);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  next_game() {
    const cas = document.querySelector('.com_and_score');
    cas.style.visibility = 'hidden';
    const sum = document.getElementById('sum_box');
    sum.style.visibility = 'hidden';
    const pac = document.querySelector('.pass_and_cheat');
    pac.style.visibility = 'hidden';
    this.hide_hand();
    this.hide_board();
    this.mes('');
    const menu = document.getElementById('start_menu');
    menu.style.display = 'block';
  }
  all_off() {
    for (const h of document.querySelectorAll('.player_card')) {
      h.setAttribute('disabled', 'disabled');
    }
    document.getElementById('pass_button').setAttribute('disabled', 'disabled');
  }
  all_on() {
    for (const h of document.querySelectorAll('.player_card')) {
      h.removeAttribute('disabled');
    }
    document.getElementById('pass_button').removeAttribute('disabled');
  }
  set_card_face(target, card) {
    target.style.visibility = 'visible';
    if (target.lastChild) target.removeChild(target.lastChild);
    const div = document.createElement('div');
    const suit = ['heart', 'club', 'diamond', 'spade'];
    const rank = ['Q','A','2','3','4','5','6','7','8','9','10','J','K'];
    div.setAttribute('class', 'suit_' + suit[card.suit]);
    div.innerText = rank[card.rank];
    target.appendChild(div);
  }
  set_ba(idx, card) {
    const b = document.getElementById('ba_' + idx);
    this.set_card_face(b, card);
  }
  set_com_card(idx, on_off = true) {
    if (idx == 0) throw new Error(`idx = ${idx}`);
    const tar = document.getElementById('com_hand_' + idx);
    tar.style.visibility = on_off? 'visible': 'hidden';
  }
  set_hand(idx, card) {
    const tar = document.getElementById('hand_' + idx);
    tar.setAttribute('disabled', 'disabled');
    this.set_card_face(tar, card);
  }
  hide_player_hand(idx) {
    const tar = document.getElementById('hand_' + idx);
    //tar.style.visibility = 'hidden';
    tar.style.display = 'none';
  }
  all_display() {
    for (const h of document.querySelectorAll('.player_card')) {
      h.style.display = 'block';
    }
  }
  mes(str) {
    const msg = document.getElementById('msg');
    msg.innerText = str;
  }
  set_score(score) {
    const s = document.getElementById('score');
    s.innerText = `${score[0]} vs ${score[1]}`;
  }
  set_sum(sum) {
    const sb = document.getElementById('sum_box');
    sb.innerText = sum;
  }
  set_pass(on_off, is_finish = false) {
    const pb = document.getElementById('pass_button');
    if (on_off) {
      pb.removeAttribute('disabled');
    } else {
      pb.setAttribute('disabled', 'disabled');
    }
    pb.innerText = is_finish? 'FINISH': 'PASS';
  }
  hide_hand() {
    const ph = document.querySelectorAll('.player_card');
    const ch = document.querySelectorAll('.com_card');
    if (ph.length != ch.length) throw new Error(`ph(${ph.length}) != ch(${ch.length})`);
    if (ph.length != 6) throw new Error(`len != 6`);
    for (let i = 0; i < 6; ++i) {
      ph[i].style.visibility = 'hidden';
      ch[i].style.visibility = 'hidden';
    }
  }
  hide_board() {
    for (const b of document.querySelectorAll('.board_card')) {
      b.style.visibility = 'hidden';
    }
  }
  set_face(type = 'def') {
    const face = {
      'def':   '&#x1f642;', // 🙂
      'w':     '&#x1f604;', // 😄
      'ww':    '&#x1f606;', // 😆
      'www':   '&#x1f923;', // 🤣
      'yoso':  '&#x1f644;', // 🙄
      'wink':  '&#x1f609;', // 😉
      'be':    '&#x1f61d;', // 😝
      'yatta': '&#x1f633;', // 😳
      'think': '&#x1f914;', // 🤔
      'kiai':  '&#x1f624;', // 😤
      'red':   '&#x1f621;', // 😡
      'what':  '&#x1f61f;', // 😟
      'mu':    '&#x1f641;', // 🙁
      'oops':  '&#x1f635;', // 😵
      'oh no': '&#x1f62b;', // 😫
      'cry':   '&#x1f62d;', // 😭
    };
    const f = document.getElementById('face');
    if (type in face) {
      f.innerHTML = face[type];
    } else {
      console.log('face not found:', type);
      f.innerHTML = face['def'];
    }
  }
}

class Player {
  constructor(name = 'Player') {
    this.name = name;
    this.select = null;
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async think(_round, hand, _info, _o_cnt, ba, pass, _score, view) {
    // 押せるカードだけ有効にする
    const cur_ba = new Rule41(ba);
    for (const card of hand.loop()) {
      const sum = cur_ba.test_play(card.rank);
      view.hand.forEach((h, idx) => {
        if (h.bit == card.bit) {
          const tar = document.getElementById('hand_' + idx);
          if (sum <= 41) {
            tar.removeAttribute('disabled');
          } else {
            tar.setAttribute('disabled', 'disabled');
          }
        }
      });
    }
    view.set_pass(true, pass);
    this.select = null;
    while (this.select == null) {
      await this.sleep(1);
    }
    view.all_off();
    return this.select;
  }
  on_button(idx, view) {
    if (view.is_game_over && idx == -1) {
      view.next_game();
      return 0n;
    }
    this.select = idx >= 0? view.hand[idx].bit: 0n;
  }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

class Com0 {
  constructor(name, face = 0) {
    this.name = name;
    this.ten = Math.trunc( Math.random() * 3 ) + 1;
    this.face = face;
  }
  think(round, hand, _info, _n_ophand, n_ba, pass, score, view) {
    if (round == 4 && pass && score[0] < score[1]) {
      view.set_face(['wink','be'][this.face]);
      return 0n;
    }
    const lst = [{ pt: pass? 0: -1, bit: 0n, rank: 0 }];
    for (const card of hand.ranks()) {
      const ba = new Rule41(n_ba);
      ba.add(card.rank);
      const sum = ba.get_sum();
      if (sum <= 41) {
        lst.push({
          pt: ba.sum2pt(sum),
          bit: card.bit,
          rank: card.rank,
        });
      }
    }
    const trim = (x) => x == 12? -2: x == 11? -3: x == 10? this.ten: x == 0? -4: x;
    lst.sort((a, b) => a.pt == b.pt? trim(b.rank) - trim(a.rank): b.pt - a.pt);
    switch (lst[0].pt) {
      case -1:
        if (pass) view.set_face('kiai');
        else if (hand.is_empty()) view.set_face('red');
        else this.rnd_face([['red', 'oh no'],['what','oops']], view);
        break;
      case 1:
        if (pass) this.rnd_face([['ww','be'],['yatta','wink']], view);
        else view.set_face('w');
        break;
      case 2:
        if (pass) this.rnd_face([['www','be'],['yatta','ww']], view);
        else view.set_face('ww');
        break;
      default:
        view.set_face(['def', 'think'][this.face]);
        break;
    }
    return lst[0].bit;
  }
  rnd_face(lst, view) {
    view.set_face(
      lst[this.face][ Math.trunc(Math.random()*lst[this.face].length) ]
    );
  }
}

class Com1 {
  constructor(name, face = 0) {
    this.name = name;
    this.ten = Math.trunc( Math.random() * 3 ) + 1;
    this.face = face;
  }
  think(round, hand, info, n_ophand, n_ba, pass, score, view) {
    if (round == 4 && pass && score[0] < score[1]) {
      view.set_face(['wink','be'][this.face]);
      return 0n;
    }
    const lst = [{ pt: pass? 0: -1, bit: 0n, rank: 0, kpt: -1 }];
    for (const card of hand.ranks()) {
      const ba = new Rule41(n_ba);
      ba.add(card.rank);
      const sum = ba.get_sum();
      const kpt = ba.sum2pt(sum);
      let aite = kpt;
      if (n_ophand != 0) {
        const ilen = info.length;
        for (const ohand of info.ranks()) {
          const ns = ba.test_play(ohand.rank);
          const pt = ns > 41? 1: -ba.sum2pt(ns);
          if (pt != 0)
            aite += pt * (info.rank_count(ohand.rank) / ilen);
        }
      } else {
        aite += 1;
      }
      if (sum <= 41) {
        lst.push({
          pt: aite,
          bit: card.bit,
          rank: card.rank,
          kpt: kpt,
        });
      }
    }
    const trim = (x) => x == 12? -2: x == 11? -3: x == 10? this.ten: x == 0? -4: x;
    lst.sort((a, b) => a.pt == b.pt? trim(b.rank) - trim(a.rank): b.pt - a.pt);
    switch (lst[0].kpt) {
      case -1:
        if (pass) view.set_face('kiai');
        else if (hand.is_empty()) view.set_face('red');
        else this.rnd_face([['red', 'oh no'],['what','oops']], view);
        break;
      case 1:
        if (pass) this.rnd_face([['ww','be'],['yatta','wink']], view);
        else view.set_face('w');
        break;
      case 2:
        if (pass) this.rnd_face([['www','be'],['yatta','ww']], view);
        else view.set_face('ww');
        break;
      default:
        view.set_face(['def', 'think'][this.face]);
        break;
    }
    return lst[0].bit;
  }
  rnd_face(lst, view) {
    view.set_face(
      lst[this.face][ Math.trunc(Math.random()*lst[this.face].length) ]
    );
  }
}

// 合法手をスコア優先で乱択
class RndCom {
  constructor(name) {
    this.name = name;
  }
  think(_round, hand, _info, _n_ophand, n_ba, pass, _score, view) {
    const lst = [ {pt: -1, bit: 0n } ];
    for (const card of hand.ranks()) {
      const ba = new Rule41(n_ba);
      ba.add(card.rank);
      const sum = ba.get_sum();
      if (sum <= 41) {
        lst.push({
          pt: ba.sum2pt(sum),
          bit: card.bit
        });
      }
    }
    lst.sort((a, b) => b.pt - a.pt);
    switch (lst[0].pt) {
      case -1:
        if (pass) view.set_face('mu');
        else if (hand.is_empty()) view.set_face('red');
        else view.set_face('oops');
        break;
      case 1:
        if (pass) view.set_face('yoso');
        else view.set_face('yatta');
        break;
      case 2:
        if (pass) view.set_facd('be');
        else view.set_face('wink');
        break;
      default:
        view.set_face(['w','def'][ Math.trunc(Math.random()*2) ]);
        break;
    }
    return lst[0].bit;
  }
}

const com_list = [
  { name: 'アッホ', load: function() { return new RndCom(this.name, 0); } },
  { name: 'ビリー', load: function() { return new Com0(this.name, 0); } },
  { name: 'クリス', load: function() { return new Com0(this.name, 1); } },
  { name: 'デビー', load: function() { return new Com1(this.name, 0); } },
  { name: 'エリス', load: function() { return new Com1(this.name, 1); } },
];


window.onload = () => {
  const sel = document.getElementById('select_box');
  for (let i = 0; i < com_list.length; ++i) {
    const opt = document.createElement('option');
    opt.innerText = com_list[i].name;
    if (i == 0) opt.selected = true;
    sel.appendChild(opt);
  }
  const cheat = document.getElementById('cheat_button');
  cheat.addEventListener('click', () => {
    const tbl = document.querySelector('.counter');
    tbl.style.visibility = tbl.style.visibility === 'visible'?
      'hidden' : 'visible';
  });
  //
  const but = document.getElementById('start_button');
  but.addEventListener('click', () => {
    const menu = document.getElementById('start_menu');
    menu.style.display = 'none';
    const op = com_list[ sel.selectedIndex ].load();
    const pl = new Player();
    const view = new Game41View([pl, op]);
    const game = new Game41(view);
    game.play_loop();
  });
};


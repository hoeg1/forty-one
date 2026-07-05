// ４１（フォーティ・ワン）
// ルール参考:
//      「夢中になる！ トランプの本」草場純
//       主婦の友Books, ISBN978-4-07-258336-4


export const VERSION = '1.0.0';


/**
 * パスを表す定数
 */
export const PASS = 0;

/**
 * @param {number} suit  0~3
 * @param {number} rank  1~13 <- 0 は使わない
 * @return {number} カードを表す数値
 */
export const new_card = (suit, rank) => (suit << 4) | rank;
/**
 * ランクを取り出す
 * @param {number} card
 * @return {number} 1~13のランク
 */
export const to_rank = card => card & 0b1111;
/**
 * スートを取り出す
 * @param {number} card
 * @return {number} 0,1,2,3のスート
 */
export const to_suit = card => card >> 4;
/**
 * スートとランクに分解
 * @param {number} card
 * @return {[number, number]} [suit, rank]
 */
export const to_sr = card => [card >> 4, card & 0b1111];
/**
 * 41のカード価値に変換
 * @param {number} card
 * @return {number} Q => 0, J => -1, K => -2, 他 => 数値通り
 */
export const to_num = card => {
  const rank = to_rank(card);
  switch (rank) {
    case 13: return -2; // K
    case 12: return 0;
    case 11: return -1;
    case 0: throw new Error('zero');
    default: return rank;
  }
};


/**
 * 場の合計を算出
 * @param {Array<number>} ba
 */
export const get_sum = ba => ba.reduce((acc, card) => {
    const num = to_num(card);
    if (num === -2) { // -2 == K
      // prev が 0 や -1, -2=K だと QJK とかぶる
      if (acc.prev !== -999) acc.sum += acc.prev;
      else acc.kcnt += 1;
    } else {
      if (acc.kcnt !== 0) {
        acc.sum += num * acc.kcnt;
        acc.kcnt = 0;
      }
      acc.sum += num;
      acc.prev = num;
    }
    return acc;
  }, {sum:0, prev:-999, kcnt:0}).sum; // prev の -999 は適当なありえないカード値


/*
// test
(function() {
  const same = (a,b) => {
    if (a == b) { return 'Ok'; }
    else { return `NG: ${a} != ${b}`; }
  };
  // K, K, A = 3
  const ba1 = [new_card(0, 13), new_card(1, 13), new_card(2, 1)];
  console.log(`K, K, A: ${same(get_sum(ba1), 3)}`);
  // K, K, A, K = 4
  const ba2 = [new_card(0, 13), new_card(1, 13), new_card(2, 1), new_card(2, 13)];
  console.log(`K, K, A, K: ${same(get_sum(ba2), 4)}`);
  // K, J, 2, Q = 0
  const ba3 = [new_card(0, 13), new_card(1, 11), new_card(2, 2), new_card(2, 12)];
  console.log(`K, J, 2, Q: ${same(get_sum(ba3), 0)}`);
  // acc.prev が 0 とかだとバグる例
  // 6 9 7 8 A Q K 6
  const ba4 = [
    new_card(1, 6), new_card(1, 9), new_card(2, 7), new_card(0, 8),
    new_card(2, 1), new_card(2, 12), new_card(3, 13)];
  console.log(`6 9 7 8 A Q K: ${same(get_sum(ba4), 31)}`);
  console.log(`6 9 7 8 A Q K 6: ${same(get_sum([...ba4, new_card(0, 6)]), 37)}`);
  console.log(`6 9 7 8 A Q K 4: ${same(get_sum([...ba4, new_card(0, 4)]), 35)}`);
})();
// */


///////////////////////////////////////////////////////////////////////////////
export class Rand {
  /**
   * 乱数クラス
   * @constructor
   * @param {number} seed   乱数の種
   */
  constructor(seed=Math.trunc(Math.random() * 123456789)+1) {
    this.seed = seed;
    this.x = 123456789;
    this.y = 362436069;
    this.z = 521288629;
    this.w = seed;
  }
  /**
   * 整数の乱数を返す
   * @returns {number} - 0~INT_MAX
   */
  next() {
    const t = this.x ^ (this.x << 11);
    this.x = this.y;
    this.y = this.z;
    this.z = this.w;
    this.w = (this.w ^ (this.w >>> 19)) ^ (t ^ (t >>> 8));
    return (this.w >>> 0) - 1;
  }
  /**
   * 実数の乱数を返す
   * @returns {number} - 0~1
   */
  random() {
    return this.next() / 0xffffffff;
  }
  /**
   * 整数nまでの乱数を返す
   * @param {number} n - 正の整数
   * @returns {number} - 0~n
   */
  rand(n) {
    return this.next() % n;
  }
  /**
   * 配列を破壊的にシャッフルする
   * @param {Array} ary - ターゲットの配列
   * @returns {Array} - シャッフルした ary
   */
  shuffle(ary) {
    for (let i = ary.length - 1; i > 0; --i) {
      const r = this.rand( i + 1 );
      [ary[i], ary[r]]  =  [ary[r], ary[i]];
    }
    return ary;
  }
  /**
   * 配列をコピーし、コピーしたそれをシャッフルして返す
   * @param {Array} ary - ターゲットの配列
   * @returns {Array} - ary とは別のシャッフルした配列
   */
  to_shuffled(orig_ary) {
    return this.shuffle([...orig_ary]);
  }
}

///////////////////////////////////////////////////////////////////////////////
export class Player {
  static rank_sort = (a, b) => {
    const [ra, rb] = [to_rank(a), to_rank(b)];
    if (ra === rb) {
      const [sa, sb] = [to_suit(a), to_suit(b)];
      return sa - sb;
    } else {
      return ra - rb;
    }
  };
  /**
   * プレイヤーの状態を管理
   * 手札や得点を持たせる
   * 継承して使う
   * @constructor
   * @param {string} name  このプレイヤーの名前
   * @param {boolean} is_human  このプレイヤーは人間か？
   */
  constructor(name, is_human) {
    this.name = name;
    this.is_human = is_human;
    this.score = 0; // ゲーム全体の得点
    this.katen = 0; // あるラウンドの得点
    this.hand = [];
  }
  /**
   * 手札をセットする
   * this.katenが０にリセットされる
   * @param {Array<number>} hand  持たせる手札
   */
  set_hand(hand) {
    this.katen = 0;
    this.hand = hand;
    if (this.is_human) this.hand.sort(Player.rank_sort);
    this.on_deal();
  }
  /**
   * 得点したとき呼び出す
   * 内部でkatenにも点数を記録
   * @param {number} pt  得点
   */
  add_score(pt) {
    this.score += pt;
    this.katen += pt;
  }

  /**
   * １ディールが始まったときに呼び出す
   * 継承先でなにかしてもよい
   */
  on_deal_start() { }

  /**
   * 手札が配られたとき呼び出す
   * 継承先でなにかしてもよい
   */
  on_deal() { }

  /**
   * 相手が手札をプレイしたとき呼び出す
   * 最初の１枚がめくられたときやラウンド終了時にも呼ばれる
   * 継承先でカウンティングに使ってもよい
   * @param {number} card  プレイされたカード
   * @param {boolean} is_first  最初に場にめくられたカードやラウンド終了時か
   */
  on_play(card, is_first=false) { }

  /**
   * プレイする手札を決める
   * 継承先でより強い戦略をつくる
   * @param {FortyOne} fo
   * @return {number} プレイする手札
   */
  think(fo) {
    const legal = fo.get_legal();
    return legal[ fo.rand(legal.length) ];
  }

  /**
   * 実際の対戦時、手番になったら呼び出し元から
   * await pl.on_turn(fo) などとして呼ぶ。
   * @async
   * @param {FortyOne} fo
   * @return {Promise} プレイする手札を resolve(card) するプロミス
   */
  async on_turn(fo) {
    return new Promise(resolve => resolve(this.think(fo)));
  }
}


///////////////////////////////////////////////////////////////////////////////
class Turn {
  /**
   * 手番（番号）を管理
   * @constructor
   * @param {number} start_player   最初の手番
   */
  constructor(start_player) {
    this._start_dealer = start_player == 0? 1: 0;
    this._start_player = start_player;
    this._turn = this._start_player;
  }
  get now() {
    return this._turn;
  }
  get np() {
    return this._np;
  }
  get start_player() {
    return this._start_player;
  }
  next() {
    this._turn = (this._turn + 1) % 2;
    return this._turn;
  }
  /**
   * 前回のラウンドのスタートプレイヤーの次のプレイヤーを
   * スタートプレイヤーにする
   */
  next_round() {
    this._start_player = this._start_player == 0? 1: 0;
    this._turn = this._start_player;
    return this._turn;
  }
  /**
   * 前のディールの最初のディーラーをスタートプレイヤーにする
   * 最初のディーラー情報を交換
   */
  next_deal() {
    this._start_player = this._start_dealer;
    this._turn = this._start_player;
    this._start_dealer = this._start_dealer == 0? 1: 0;
    return this._turn;
  }

}

///////////////////////////////////////////////////////////////////////////////
export class FortyOne {
  /**
   * ゲームの状態を管理
   * @constructor
   * @param {Array<Player>} players  プレイヤーの配列
   * @param {Rand} rnd               乱数生成器
   * @param {number} max_deal        何ディール（各４ラウンド）するか
   * @returns {FortyOne}
   */
  constructor(players, rnd, max_deal=1) {
    this.players = players;
    this.rnd = rnd;
    this.rand = n => this.rnd.rand(n);
    //
    this.turn = new Turn(rnd.rand(2));
    this.max_deal = max_deal;
    this.deal_count = 0;   // ディール数（４ラウンドで１ディール）
    this.round_count = 0;  // ラウンド数。０で手札生成。４ラウンドで１ディール
  }
  /**
   * 各ラウンドのために手札を配る
   * @return {string} 'gameover', 'next deal', 'done' のどれか
   * 'gameover' ... ゲーム終了
   * 'next deal' ... 次のディール（４ラウンド）を始める
   *                 この値が来たらスタートプレイヤーを次に進めて
   *                 もう一度round_dealぶ
   * 'done' ... 単に手札を配った -> has_nobsし、真なら得点するように注意
   */
  round_deal() {
    if (this.round_count === 4) {
      if (this.deal_count == this.max_deal) return 'gameover';
      // 次に呼んだ時山札を作るよう round_count を 0 にする
      this.round_count = 0;
      return 'next deal';
    }
    if (this.round_count === 0) {
      // 山札を作る
      this.deck = [];
      for (let suit = 0; suit < 4; ++suit) {
        for (let rank = 1; rank <= 13; ++rank) {
          this.deck.push(new_card(suit, rank));
        }
      }
      this.rnd.shuffle(this.deck);
      // ディールを数える
      this.deal_count += 1;
      this.players[0].on_deal_start();
      this.players[1].on_deal_start();
    }
    //
    this.round_count += 1;
    //
    const h0 = [];
    const h1 = [];
    for (let i = 0; i < 6; ++i) {
      h0.push( this.deck.pop() );
      h1.push( this.deck.pop() );
    }
    this.players[0].set_hand( h0 );
    this.players[1].set_hand( h1 );
    //
    this.ba = [ this.deck.pop() ]; // A なら得点
    this.players[0].on_play( this.ba[0], true); // 最初の１枚を通知
    this.players[1].on_play( this.ba[0], true); // 最初の１枚を通知
    //
    this.is_pass = false; // パスしているか
    //
    return 'done';
  }
  /**
   * @return {Player} 手番プレイヤーを返す
   */
  get teban() {
    return this.players[ this.turn.now ];
  }
  /**
   * @return {Player} 手番ではないほうのプレイヤーを返す
   */
  get aite() {
    return this.players[ this.turn.now === 0? 1: 0 ];
  }
  /**
   * @return {boolean} 手番プレイヤーがパスしかできないなら真
   */
  pass_only() {
    for (let card of this.teban.hand) {
      const ba = [...this.ba, card];
      if (get_sum(ba) <= 41) return false;
    }
    // どれも42以上 or 手札がない
    return true;
  }
  /**
   * 手札を場にプレイする
   * @param {number} card
   * @return {number} ラウンド続行なら0(得点なし), 1(1点取った), 2(41だ), -1(パスだ); 終了なら-2
   */
  play(card) {
    if (card === PASS) {
      if (!this.pass_only()) {
        throw new Error('出せるカードがあるのにパスはできません');
      }
      if (this.is_pass) {
        // ラウンド終了
        // // 余った手札を通知
        for (let c of this.players[0].hand) this.players[1].on_play(c, true);
        for (let c of this.players[1].hand) this.players[0].on_play(c, true);
        return -2;
      } else {
        this.is_pass = true;
        this.turn.next(); // 手番を進めてから
        this.teban.add_score(1); // パスされたプレイヤーに１点
        this.teban.on_play(PASS); // 相手がパスしたと通知
        return -1;
      }
    } else {
      const idx = this.teban.hand.findIndex(c => c === card);
      if (idx === -1) {
        throw new Error(`指定したカード(${card})が手札にありません`);
      }
      const ba = [...this.ba, card];
      const sum = get_sum(ba);
      if (sum > 41) {
        throw new Error(`プレイすると合計 ${sum} で、41を超えてしまいます`);
      }
      let sc = 0;
      if (sum > 0 && sum % 10 == 1) {
        sc = sum === 41? 2: 1;
        this.teban.add_score(sc);
      }
      // 手札を削除
      this.teban.hand.splice(idx, 1);
      // ルール違反は無いので、カードを場に出す
      this.ba = ba;
      //
      this.turn.next();
      this.is_pass = false;
      this.teban.on_play(card); // 相手が使ったカードを通知
      return sc;
    }
  }
  /**
   * ヒズ・ノブが入るか
   * @return {boolean} 場がA一枚なら真
   */
  has_nobs() {
    return this.ba.length === 1 && to_rank(this.ba[0]) === 1;
  }
  /**
   * 手番が持っている手札について、合法な手札のみ返す
   * @returns {Array<number>}
   */
  get_legal() {
    const ret = this.teban.hand.filter(card => {
      const ba = [...this.ba, card];
      return get_sum(ba) <= 41;
    });
    return ret.length === 0? [ PASS ]: ret;
  }
  /**
   * @return {string} 勝者の名前を返す。引き分けなら''
   */
  get_winner() {
    const p0 = this.players[0].score;
    const p1 = this.players[1].score;
    if (p0 == p1) return '';
    return p0 > p1? this.players[0].name: this.players[1].name;
  }
  /**
   * @return {number} 点差を返す
   */
  get_tensa() {
    return Math.abs(this.players[0].score - this.players[1].score);
  }
}



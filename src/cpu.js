import {
  PASS,
  FortyOne, Player,
  to_rank, get_sum,
  new_card,
} from "./41.js";

const NAMES = [
  'こそアド',
  'サム',
  'なごみん',
  '和子さん',
  'プラッス',
  'オキシドール',
  'たすおくん',
  'ゴウ・ケイテン',
  '41歳公務員',
];


export class CPU_lv0 extends Player {
  constructor(rnd) {
    super(NAMES[ rnd.rand(NAMES.length) ], false);
  }
  think(fo) {
    // 得点できるカードがあるなら出す。ないならランダム
    const pts = [[], [], []];
    for (let c of this.hand) {
      const b = [...fo.ba, c];
      const sum = get_sum(b);
      if (sum > 41) continue;
      if (sum > 0 && sum % 10 === 1) {
        // 得点できるカードがあったので記録
        pts[sum === 41? 2: 1].push(c);
      } else {
        // 得点はできないが合法な手をみつけた
        pts[0].push(c);
      }
    }
    if (pts[2].length !== 0) {
      return pts[2][ fo.rand( pts[2].length ) ];
    }
    if (pts[1].length !== 0) {
      return pts[1][ fo.rand( pts[1].length ) ];
    }
    if (pts[0].length !== 0) {
      return pts[0][ fo.rand( pts[0].length ) ];
    }
    // パスしかできない
    return PASS;
  }
}


export class CPU_lv1 extends Player {
  /**
   * @constructor
   * @param {Rand} rnd
   */
  constructor(rnd) {
    const name = NAMES[ rnd.rand(NAMES.length) ];
    super(name, false);
    const p = [11, 13, 17, 19, 23][ rnd.rand(5) ];
    const q = [2, 3, 5, 7, 11][ rnd.rand(5) ];
    // name で評価表をずらす
    //                     A   2   3   4   5   6   7   8   9   10  J  Q  K
    this.rank_score = [0, 10, 20, 30, 50, 60, 70, 80, 90, 100, 40, 1, 0, 2].map(
      (x, i)=> x + (name.charCodeAt(i % name.length) % p) - q);
  }
  think(fo) {
    // 評価表方式で出すカードを決める
    let cur_pt = -9999; // この値が最大だったカードを返す
    let cur_card = PASS; // 返すカード: PASS = 0
    for (let card of this.hand) {
      const ba = [...fo.ba, card];
      const sum = get_sum(ba);
      if (sum > 41) continue; // どれを出してもだめならパスになる
      const r = to_rank(card);
      // ランク評価：得点できるなら追加点
      const p = this.rank_score[r] +
        (sum > 0 && sum % 10 === 1? (sum === 41? 300: 150): 0);
      if (p > cur_pt) {
        cur_pt = p;
        cur_card = card;
      }
    }
    // どれも42以上 or 手札を持ってないなら cur_card は 0(PASS) のまま
    return cur_card;
  }
}


export class CPU_lv2 extends CPU_lv1 {
  constructor(rnd) {
    super(rnd);
    this.counter = [];
  }
  on_deal_start() {
    this.counter = [0,4, 4,4,4, 4,4,4, 4,4,4, 4,4,4]; // len = 14
  }
  on_deal() {
    for (let c of this.hand) {
      const rank = to_rank(c);
      this.counter[rank] -= 1;
    }
  }
  on_play(card) {
    const rank = to_rank(card);
    this.counter[rank] -= 1;
  }

  /**
   * ある手を打ったあと相手が得る得点の期待値を負の値として返す
   * @param {Array<number>} cur_ba  その手を打った場
   */
  sakiyomi(cur_ba) {
    const pt2 = 150;
    const pt1 =  75;
    const bunbo = this.counter.reduce((a,b)=>a+b,0);
    let result = 0;
    let p_flag = true; // 相手がパスしかできないか
    for (let rank = 1; rank <= 13; ++rank) {
      if (this.counter[rank] === 0) continue;
      // rank を相手が出したと仮定する
      const ba = [...cur_ba, new_card(0, rank)];
      const sum = get_sum(ba);
      // 違法な手ならスキップ
      if (sum > 41) continue;
      // 合法な手だった
      p_flag = true; // パス以外が有り得る
      // 相手が出したと仮定したのは得点する手札か？
      if (sum > 0 && sum % 10 === 1) {
        // 期待値 = { 点数 * 個々の確率 } の合計
        const P = this.counter[rank] / bunbo;
        const pt = sum == 41? -pt2: -pt1;
        const k = pt * P;
        // 個々の確率を合計
        result += k;
      }
    }
    // 相手がパスしかできないなら確実に１点
    return p_flag? pt1: result;
  }
  /**
   * 考えさせる
   * @param {FortyOne} fo
   */
  think(fo) {
    const pt2 = 300;
    const pt1 = 150;
    let cur_pt = -999999;
    let cur_card = PASS; // PASS = 0
    for (let card of this.hand) {
      // 手札を出したと仮定
      const ba = [...fo.ba, card];
      const sum = get_sum(ba);
      if (sum > 41) continue; // 違法なのでこの仮定は成り立たない
      // 評価表をもとにこの仮定の基礎点を出す
      const rank = to_rank(card);
      const p = this.rank_score[rank] +
        (sum > 0 && sum % 10 === 1? (sum === 41? pt2: pt1): 0);
      // 先読みした結果を基礎点に足し合わせる
      const k = this.sakiyomi(ba);
      const n = k + p;
      if (n > cur_pt) {
        cur_pt = n;
        cur_card = card;
      }
    }
    // すべて違法手なら cur_card は PASS のまま
    return cur_card;
  }
}


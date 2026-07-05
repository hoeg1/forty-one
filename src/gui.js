import {
  PASS,
  FortyOne,
  get_sum, to_sr,
  Rand,
  Player,
  CPU_lv1,
} from "./41.js";

let g_speed = 1000;
const sleep = ms => new Promise(res=>setTimeout(res, ms));
const CARD_STYLES = ['r0','r1','r2','r3','r4','r5','r6','r7',
      'r8','r9','r10','r11','r12','r13',
      'sn','s0','s1','s2','s3'];

class CPU_lv0 extends Player {
  constructor(rnd) {
    const NAMES = ['らんだま', 'てけとー', 'てなりん'];
    super(NAMES[ rnd.rand(NAMES.length) ], false);
  }
  think(fo) {
    const pts = [[], [], []];
    for (let c of this.hand) {
      const b = [...fo.ba, c];
      const sum = get_sum(b);
      if (sum > 41) continue;
      if (sum > 0 && sum % 10 === 1) {
        pts[sum === 41? 2: 1].push(c);
      } else {
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
    return PASS;
  }
}


const mes = msg => {
  document.getElementById('msg-area').textContent = msg;
};

const sum_mes = txt => {
  document.getElementById('sum-th').textContent = txt;
};

const redraw_score = pl => {
  document.getElementById('pl_score').textContent = pl.score + 'pt';
  document.getElementById('pl_katen').textContent = '+' + pl.katen;
};

const redraw_deal = fo => {
  document.getElementById('dealcnt-td').textContent = `D.${fo.deal_count}/${fo.max_deal}`;
  document.getElementById('roundcnt-td').textContent = `R.${fo.round_count}/4`;
};

const redraw_ba = fo => {
  for (let i = 0; i < 13; ++i) {
    const tar = document.getElementById(`ba-card-${i}`);
    if (fo === undefined) {
      tar.classList.remove(...CARD_STYLES);
      tar.classList.add('blank');
    } else {
      if (i < fo.ba.length) {
        if (tar.classList.contains('blank')) {
          tar.classList.remove('blank');
          const [suit, rank] = to_sr(fo.ba[i]);
          tar.classList.add(`s${suit}`, `r${rank}`);
        }
      } else {
        break;
      }
    }
  }
  document.getElementById('sum-th').textContent =
    fo === undefined? '- 0 -': `- ${get_sum(fo.ba)} -`;
};

const init_hands = fo => {
  for (let i = 0; i < 6; ++i) {
    const op = document.getElementById(`ophand-${i}`);
    op.classList.remove(...CARD_STYLES, 'blank');
    op.classList.add('sn');
    op.style.display = 'inline-block';
    const p = document.getElementById(`phand-${i}`);
    p.classList.remove(...CARD_STYLES, 'blank');
    p.card = fo.players[0].hand[i];
    const [suit, rank] = to_sr(p.card);
    p.classList.add(`s${suit}`, `r${rank}`);
    p.style.display = 'inline-block';
  }
};

const clean_up = () => {
  const to_blank = tar => {
    tar.classList.remove('r0','r1','r2','r3','r4','r5','r6','r7',
      'r8','r9','r10','r11','r12','r13',
      'sn','s0','s1','s2','s3');
    tar.classList.add('blank');
    tar.style.display = 'inline-block';
  };
  for (let i = 0; i < 13; ++i) {
    if (i < 6) {
      to_blank(document.getElementById(`ophand-${i}`));
      to_blank(document.getElementById(`phand-${i}`));
    }
    to_blank(document.getElementById(`ba-card-${i}`));
  }
  sum_mes('- 0 -');
  mes('- START でゲーム開始 -');
  document.getElementById('pl_score').textContent = '0pt';
  document.getElementById('pl_katen').textContent = '+0';
};


class Human extends Player {
  constructor() {
    super('あなた', true);
    this.evt_cards = [];
    this.evt_pass = null;
  }
  remove_event() {
    const pass = document.getElementById('pass_button');
    pass.textContent = 'PASS';
    pass.removeEventListener('click', this.evt_pass);
    for (let [c, e] of this.evt_cards) {
      c.removeEventListener('click', e);
    }
  }
  /**
   * @async
   * @param {FortyOne} fo
   */
  async on_turn(fo) {
    const pass = document.getElementById('pass_button');
    pass.textContent = fo.is_pass? 'END': 'PASS';
    this.evt_cards = [];
    this.evt_pass = null;
    mes('あなたのターンです');
    return new Promise(solv => {
      for (let i = 0; i < 6; ++i) {
        const c = document.getElementById(`phand-${i}`);
        if (c.style.display === 'none') continue;
        const e = () => {
          const card = c.card;
          const ba = [...fo.ba, card];
          if (get_sum(ba) <= 41) {
            this.remove_event();
            c.style.display = 'none';
            solv(card);
          } else {
            mes('41 を超えてしまいます');
          }
        };
        c.addEventListener('click', e);
        this.evt_cards.push([c, e]);
      }
      this.evt_pass = () => {
        if (fo.pass_only()) {
          this.remove_event();
          solv(PASS);
        } else {
          mes('パスは他に選択肢が無いときだけ可能です');
        }
      };
      pass.addEventListener('click', this.evt_pass);
    });
  }
}

const make_on_turn = self => {
  const show_ophand = (len, card) => {
    const tar = document.getElementById(`ophand-${len}`);
    tar.classList.remove('sn');
    const [suit, rank] = to_sr(card);
    tar.classList.add(`s${suit}`, `r${rank}`);
  };
  const del_ophand = len => {
    const tar = document.getElementById(`ophand-${len}`);
    tar.style.display = 'none';
  };
  /**
   * @async
   * @param {FortyOne} fo
   */
  const ot = async (fo) => {
    mes(`${self.name} のターン`);
    const card = self.think(fo);
    if (card !== PASS) {
      show_ophand(self.hand.length - 1, card);
      await sleep(g_speed);
      del_ophand(self.hand.length - 1);
    } else {
      await sleep(g_speed);
      mes(`${self.name} は ${fo.is_pass?'終了': 'パス'} を宣言しました`);
      await sleep(g_speed);
    }
    return card;
  };
  return ot;
};

const wait_button = txt => {
  const pass = document.getElementById('pass_button');
  pass.textContent = txt;
  return new Promise(solv => {
    pass.addEventListener('click', ()=>{
      solv();
    }, {once: true});
  });
};

const open_ophand = op => {
  for (let i = 0; i < op.hand.length; ++i) {
    const tar = document.getElementById(`ophand-${i}`);
    tar.classList.remove(...CARD_STYLES, 'blank');
    const [suit, rank] = to_sr(op.hand[i]);
    tar.classList.add(`s${suit}`, `r${rank}`);
  }
};

//////////////////////////////////////////////////////////////////////////////

const main_loop = async (fo) => {
  const human = fo.players[0];
  const cpu = fo.players[1];
  deal_loop: while (true) {
    const end = fo.round_deal();
    switch (end) {
      case 'gameover':
        const win = fo.get_winner();
        mes(`ゲーム終了 - ${win==''?'引き分けです': win+' の勝ち'}`);
        sum_mes(`${cpu.name} の得点: ${cpu.score}pt`);
        await wait_button('END');
        break deal_loop;
      case 'next deal':
        mes(`第 ${fo.deal_count} ディール終了 - press NEXT`);
        sum_mes(`${cpu.name} の得点: ${cpu.score}pt`);
        open_ophand(cpu);
        await wait_button('NEXT');
        redraw_ba();
        fo.turn.next_deal();
        break;
      default:
        // round start
        mes(`第 ${fo.round_count} ラウンド開始`);
        init_hands(fo);
        redraw_ba(fo);
        redraw_deal(fo);
        redraw_score(human); // for katen
        await sleep(g_speed);
        if (fo.has_nobs()) {
          fo.aite.add_score(1);
          if (fo.aite.is_human) redraw_score(human);
          mes(`最初がＡ！ ディーラーの ${fo.aite.name} に１点`);
          await sleep(g_speed);
        }
        round_loop: while (true) {
          const teban = fo.teban;
          const card = await teban.on_turn(fo);
          const result = fo.play(card);
          if (card !== PASS) {
            redraw_ba(fo);
          }
          switch (result) {
            case 1: case 2:
              // score
              mes(`${fo.aite.name} に ${result} 点！`);
              if (fo.aite.is_human) redraw_score(human);
              await sleep(g_speed);
              break;
            case -1:
              // score(pass)
              mes(`パスをしたので ${fo.teban.name} に 1 点！`);
              if (fo.teban.is_human) redraw_score(human);
              await sleep(g_speed);
              break;
            case -2:
              // round end
              mes(`第 ${fo.round_count} ラウンド終了`);
              sum_mes(`${cpu.name} の得点: ${cpu.score}pt (+${cpu.katen})`);
              open_ophand(cpu);
              await sleep(g_speed * 2);
              if (fo.round_count != 4) redraw_ba(); // clear
              fo.turn.next_round();
              break round_loop;
            default:
              break;
          }
        }
        break;
    }
  }
};



window.onload = () => {
  const sbut = document.getElementById('start-button');
  sbut.addEventListener('click', async () => {
    const opt_box = document.getElementById('option_box');
    opt_box.hidden = true;
    g_speed = parseInt(document.getElementById('speed_sel').value);
    const cpu_type = parseInt(document.getElementById('cpu_lv_sel').value);
    const max_deal = parseInt(document.getElementById('max_deal_sel').value);

    const rnd = new Rand();
    console.log(`seed: 0x${rnd.seed.toString(16)}`);
    const cpu = cpu_type === 0? new CPU_lv0(rnd): new CPU_lv1(rnd);
    cpu.on_turn = make_on_turn(cpu);
    const pl = [ new Human(), cpu ];

    const fo = new FortyOne(pl, rnd, max_deal);
    await main_loop(fo);

    clean_up();
    opt_box.hidden = false;
  });
};

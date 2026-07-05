import { stdin as input, stdout as output, exit } from "node:process";
import * as readline from "node:readline/promises";
import { parseArgs, styleText } from 'node:util';


import {
  PASS, VERSION,
  to_suit, to_rank, get_sum, to_sr,
  Rand, FortyOne, Player,
} from './src/41.js';

import {
  CPU_lv0,
  CPU_lv1,
  CPU_lv2,
} from './src/cpu.js';


const sleep = ms => new Promise(res=>setTimeout(res, ms));
const press_enter = async () => {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(styleText('dim', '[press Enter]\n'));
  } finally {
    rl.close();
  }
};

const COL = ['red', 'yellow', 'green', 'blue'];
const FACE = ['PASS','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const card2str = card => styleText(COL[to_suit(card)], FACE[to_rank(card)]);

const draw_board = (fo, msg) => {
  const op_info = `${fo.players[1].name} の手札: ${fo.players[1].hand.length} 枚`;
  console.log(`  [ ${msg} ]
  ${op_info}      Deal: ${fo.deal_count}/${fo.max_deal} - Round: ${fo.round_count}/4
  場: ${fo.ba.reduce((str,card)=>`${str} ${card2str(card)}`, '')} = ${get_sum(fo.ba)}
  あなた (${fo.players[0].score}pt) の手札:
    ${fo.players[0].hand.reduce((str,card)=>`${str} ${card2str(card)}`, '')}
`);
};

class Human extends Player {
  constructor() {
    super('あなた', true);
  }
  parse_cmd(cmd) {
    if (/^1[0123]$/.test(cmd) || /^[1-9]$/.test(cmd))
      return parseInt(cmd);
    switch (cmd) {
      case 'A': case 'a': return    1;
      case 'K': case 'k': return   13;
      case 'Q': case 'q': return   12;
      case 'J': case 'j': return   11;
      case 'T': case 't': return   10;
      case 'P': case 'p': case 'E': case 'e': case '0': return PASS;
      case 'C': case 'c':
        console.log('強制終了します');
        exit();
      default:
        throw new Error(`'${cmd}' を解釈できません`);
    }
  }

  async on_turn(fo) {
    let msg = '';
    while (true) {
      const rl = readline.createInterface({ input, output });
      try {
        console.clear();
        if (msg === '') msg = 'あなたのターン';
        //
        draw_board(fo, msg);
        //
        const cmd = (await rl.question(' > ')).trim();
        if (cmd === '') continue;
        const rank = this.parse_cmd(cmd);
        if (rank === 0) {
          if (fo.pass_only()) {
            return PASS;
          } else {
            throw new Error('パスはできません。出せる手札があります');
          }
        } else {
          const card = this.hand.find(card => to_rank(card) === rank);
          if (card === undefined) {
            throw new Error(`'${rank}' が見つかりません`);
          } else {
            const ba = [...fo.ba, card];
            const s = get_sum(ba);
            if (s > 41) {
              console.log('log',to_sr(card));
              throw new Error(`'${rank}' を出すと合計が４１を超えてしまいます: ${to_sr(card)}, ${s}`);
            }
            return card;
          }
        }
      } catch (e) {
        msg = styleText('red', e.message);
      } finally {
        rl.close();
      }
    }
  }
}

const make_cpu_turn = self => {
  return async (fo) => {
    console.clear();
    const card = self.think(fo);
    const str = card === PASS && fo.is_pass? styleText('red', '終了'): card2str(card);
    draw_board(fo, `${self.name} のターン: ${str} をプレイ`);
    await sleep(1000);
    return card;
  };
};


const game_loop = async fo => {
  deal_loop: while (true) { // deal
    const end = fo.round_deal();
    switch (end) {
      case 'gameover':
        console.log('=======================\n全ディールが終了しました');
        for (let pl of fo.players) {
          console.log(`  ${pl.name}: ${pl.score}pt`);
        }
        const win = fo.get_winner();
        console.log((win == ''? '\n-> 引き分けです': '\n-> ' + win + ` の +${fo.get_tensa()} 点勝ち`) +
          styleText('dim', ` (seed: 0x${fo.rnd.seed.toString(16)})`));
        break deal_loop;
      case 'next deal':
        console.log(`=======================\n第 ${fo.deal_count} ディールが終了しました\n次のディールを始めます`);
        //console.log(`D: dealer: ${fo.turn._start_dealer}, start: ${fo.turn._start_player}`);
        await press_enter();
        // 手番を調整
        fo.turn.next_deal();
        break;
      default:
        console.clear();
        draw_board(fo, `第 ${fo.round_count} ラウンド開始`);
        if (fo.has_nobs()) {
          fo.aite.add_score(1);
          console.log(`最初が A なのでディーラーの ${fo.aite.name} に 1 点`);
          await press_enter();
        } else {
          await sleep(800);
        }
        play_loop: while (true) { // play
          const card = await fo.teban.on_turn(fo);
          const ret = fo.play(card);
          console.clear();
          if (ret === -2) {
            draw_board(fo, `第 ${fo.round_count} ラウンド終了`);
            console.log(`=======================`);
            for (let pl of fo.players) {
              console.log(`  ${pl.name}: ${pl.score}pt (+${pl.katen}) 手札: [${
                pl.hand.reduce((s, c)=>`${s} ${card2str(c)}`,'') } ]`);
            }
            //console.log(`D: dealer: ${fo.turn._start_dealer}, start: ${fo.turn._start_player}`);
            await press_enter();
            // 手番を調整
            fo.turn.next_round();
            break play_loop;
          } else if (ret > 0) {
            draw_board(fo, `${fo.aite.name} に ${ret} 点`);
            await sleep(1000);
          } else if (ret === -1) {
            draw_board(fo, `パスのため ${fo.teban.name} に 1 点`);
            await sleep(1000);
          } else {
            // ret = 0, nop
          }
        }
        break;
    }
  }
};

const show_version = () => {
  console.log(`41 ver. ${VERSION}`);
};

const show_help = () => {
  console.log(`41 ver. ${VERSION}
  --version, -v      バージョンを表示
  --help, -h         このヘルプを表示
  --rule, -r         詳しいルールを表示

  --seed, -s N       ゲームのシード値を設定。N は自然数で、16進数表記も可
  --deals, -d N      ディール数を設定。N は 1 以上の自然数で、初期値は 2
  --level, -l N      CPU の強さを指定。N は 0, 1, 2 のどれか。初期値は 1

【操作方法】
　手番になったら > のあとにプレイしたい手札を書き込んでエンターします。大文字・
小文字は区別されません。

・AKQJ は アルファベットでも 1, 11, 12, 13 でもOKです。
・10 は T と書くこともできます。

・パスしたいときは 0 または P または E をタイプします。
　手札が無いときはパスするしかありません。

・C を入力すると強制終了します。

`);
};

const show_rule = () => {
  console.log(`【４１の遊び方】
　４１は日本のトランプゲーム研究家 草場純 氏が発明した２人用の足し算ゲームで、
パスをめぐる熱い駆け引きが楽しめます。
　以下のルールは草場氏の著書「夢中になる！ トランプの本（主婦の友Ｂｏｏｋｓ）」
をもとにしています。


【目的】
　互いに手札を場に出してそのランクを足し算していき、特別な合計値を作るか相手を
パスに追い込むと得点します。ただし、場の合計は４１より大きくなってはいけません。
　１ディール＝４ラウンドをプレイして得点が多いほうの勝ちです。


【使う道具】
　５２枚のトランプ一組。ジョーカーは使いません。


【カードの価値】
　このゲームではスートに意味はありません（よって、このアプリでは色分けのみでス
ートの表示はありません）。
　各カードはランクに応じて次の数値を持ちます。

Ａ……１
２〜１０……書いてあるとおり
Ｊ……マイナス１
Ｑ……ゼロ
Ｋ……直前のカードと同じ数値になります。
　　　場の最初のカードがＫなら最初に出されたＫ以外のカードになります。


【ディール】
　最初のディーラーはじゃんけんして決めます。以降、ディーラーは席順で交代です。
　ディーラーは山札をよく切って６枚の手札を配り、さらに１枚を表向きにします。

　このとき、めくられたカードがＡだった場合、ディーラーは直ちに１点を得ます。

　配り残しの山札は次のディーラーが使うので伏せたままよけておきます。ディーラー
ではないほうから最初のラウンドを始めます。


【ラウンドのプレイ】
　手番プレイヤーは手札を１枚選んで場に出し、現在の場の合計点を宣言します。この
とき、合計が次のどれかであれば、手番プレイヤーに得点が入ります。

・合計が１、１１、２１、３１のとき……１点
　マイナス１は得点になりません。

・ちょうど４１のとき……２点

　ただし、合計が４２以上になるような手札は出せません。どの手札を出しても合計が
４２以上になってしまうか、* 出そうにも手札が無い * プレイヤーは、そのときに限っ
て「パス」ができます。しかしパスをした瞬間、相手に１点が入ります。
　出せるカードがあるのにパスをすることはできません。また、手札が無くても手番は
巡って来ることに注意してください。状況によっては延々とパスして相手に得点させて
しまうことがあり、それがこのゲームの魅力です。


【ラウンドの終わり】
　前のプレイヤーが「パス」をした直後、手番のプレイヤーも「パス」をするしかなか
った場合、手番プレイヤーは「パス」の代わりに「終了」と宣言します。
　終了はパスとは違うので相手に１点が入ることはありません。

　終了宣言があった場合、双方のプレイヤーは手札を見せあい、パス宣言に嘘がないか
を確かめます。※このルールはオリジナルにはありませんが、このほうが公平でしょう。

　交代で別のプレイヤーがディーラーになり、配り残しの山札を使って次のラウンドを
はじめます。
　各ラウンドでは１３枚ずつカードを使うので、山札は４ラウンド目にきれいに無くな
ります。


【ディールの終了】
　４ラウンドをプレイしたあと、得点の多いほうがこのディールに勝ちます。同点なら
引き分けです。


【複数回のディール】
　元のルールでは勝負は１ディールのみですが、このアプリでは複数回のディールを遊
ぶことができます。※初期値で２ディール遊ぶようになっています。
　２ディール以上遊ぶ場合は、一番最初のディーラーを交互に交代してディールを繰り
返し、規定のディールをプレイし終わったとき累計点の多かったほうの勝ちです。同点
なら引き分けです。
`)
};

(async function() {
  const { values } = parseArgs({
    options: {
      version: {
        type: 'boolean',
        short: 'v',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      rule: {
        type: 'boolean',
        short: 'r',
      },
      seed: {
        type: 'string',
        short: 's',
      },
      deals: {
        type: 'string',
        short: 'd',
      },
      level: {
        type: 'string',
        short: 'l',
      },
    },
  });
  if (values.version) { show_version(); exit(); }
  if (values.help) { show_help(); exit(); }
  if (values.rule) { show_rule(); exit(); }

  let seed = Math.trunc(Math.random() * 123456789) + 1;
  if (values.seed !== undefined) {
    const s = parseInt(values.seed, /^0x[a-fA-F0-9]+$/.test(values.seed)? 16: 10);
    if (s === NaN || s <= 0) {
      console.error(`'${values.seed}' は無効なシードです`);
      exit();
    }
    seed = s;
  }
  let max_deal = 2;
  if (values.deals !== undefined) {
    const s = parseInt(values.deals);
    if (s === NaN || s <= 0) {
      console.error(`'${values.deals}' は無効な対戦回数です`);
      exit();
    }
    max_deal = s;
  }
  let cpu_level = 1;
  if (values.level !== undefined) {
    const s = parseInt(values.level);
    if (s === NaN || s < 0 || s >= 3) {
      console.error(`'${values.level}' は無効なレベル指定です`);
      exit();
    }
    cpu_level = s;
  }

  const rnd = new Rand(seed);
  const cpu = cpu_level === 0? new CPU_lv0(rnd):
    cpu_level === 1? new CPU_lv1(rnd):
    new CPU_lv2(rnd);
  cpu.on_turn = make_cpu_turn(cpu);
  const pl = [new Human(), cpu];
  const fo = new FortyOne(pl, rnd, max_deal);

  await game_loop(fo);
})();


const to_sc = name => {
  const s = name.split();
  return [0, 10, 20, 30, 50, 60, 70, 80, 90, 100, 40, 1, 0, 2].map(
      (x, i)=> x + (s[i % s.length].charCodeAt(0) % 13) - 5);
};

const to_sc2 = name => {
  return [0, 10, 20, 30, 50, 60, 70, 80, 90, 100, 40, 1, 0, 2].map(
      (x, i)=> x + (name.charCodeAt(i % name.length) % 13) - 5);
};


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

for (let n of NAMES) {
  console.log(`${n.padStart(16, ' ')}:\t\t[${to_sc2(n).join(',')}]`);
}


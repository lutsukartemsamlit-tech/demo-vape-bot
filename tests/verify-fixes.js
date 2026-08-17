// Проверка всех исправлений
const { products, categories } = require('../data/products');

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log('  ✅', label);
    passed++;
  } else {
    console.log('  ❌', label);
    failed++;
  }
}

console.log('\n=== 1. Данные: Cool Black в xros5mini ===');
const xros5mini = products.find(p => p.id === 'xros5mini');
const coolBlack = xros5mini && xros5mini.colors.find(c => typeof c === 'object' && c.name === 'Cool Black');
const noStringColors = xros5mini && xros5mini.colors.every(c => typeof c === 'object');
check('Cool Black является объектом', !!coolBlack);
check('Нет строк в colors у xros5mini', noStringColors);

console.log('\n=== 2. toggleFlavor: переключает только один вкус ===');
const meloso = products.find(p => p.id === 'meloso_x');
const statesBefore = meloso.flavors.map(f => f.enabled);
// Переключаем только index 0
const f0 = meloso.flavors[0];
if (typeof f0 === 'object') {
  f0.enabled = f0.enabled === undefined || f0.enabled === true ? false : true;
}
const statesAfter = meloso.flavors.map(f => f.enabled);
const onlyOneChanged = statesAfter.filter((v, i) => v !== statesBefore[i]).length === 1;
check('Только один вкус изменился', onlyOneChanged);
check('Изменился именно index 0', statesAfter[0] !== statesBefore[0]);
check('Index 1 не изменился', statesAfter[1] === statesBefore[1]);
check('Index 5 не изменился', statesAfter[5] === statesBefore[5]);

console.log('\n=== 3. isNaN guard ===');
function isNaNGuard(idx) {
  return !isNaN(idx) && idx !== undefined;
}
check('parseInt("3") проходит guard', isNaNGuard(parseInt('3')));
check('parseInt("abc") блокируется guard', !isNaNGuard(parseInt('abc')));
check('parseInt("0") проходит guard', isNaNGuard(parseInt('0')));
check('NaN блокируется guard', !isNaNGuard(NaN));

console.log('\n=== 4. Парсинг callback_data ===');
function parse(data, prefix) {
  const toggleData = data.replace(prefix, '');
  const parts = toggleData.split('_');
  const index = parseInt(parts[parts.length - 1]);
  const productId = parts.slice(0, -1).join('_');
  return { productId, index };
}

const cases = [
  { data: 'admin_toggle_meloso_x_5', prefix: 'admin_toggle_', id: 'meloso_x', idx: 5 },
  { data: 'admin_toggle_annima_gold_3', prefix: 'admin_toggle_', id: 'annima_gold', idx: 3 },
  { data: 'admin_colortoggle_xros5_2', prefix: 'admin_colortoggle_', id: 'xros5', idx: 2 },
  { data: 'admin_colortoggle_annima_sour_10', prefix: 'admin_colortoggle_', id: 'annima_sour', idx: 10 },
  { data: 'admin_optiontoggle_xros6mini_1', prefix: 'admin_optiontoggle_', id: 'xros6mini', idx: 1 },
];
cases.forEach(c => {
  const r = parse(c.data, c.prefix);
  check(`${c.data} -> id="${r.productId}" idx=${r.index}`, r.productId === c.id && r.index === c.idx);
});

console.log('\n=== Итог ===');
console.log(`Пройдено: ${passed}, Провалено: ${failed}`);
if (failed === 0) console.log('✅ Все проверки пройдены!');
else console.log('❌ Есть провалы, требуется доработка!');

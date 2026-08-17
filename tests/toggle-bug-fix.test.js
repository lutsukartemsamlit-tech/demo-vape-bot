// Тест для проверки исправления бага с переключением вкусов/цветов/опций
// Проблема: productId с подчеркиваниями (например meloso_x, annima_gold) 
// неправильно парсились при использовании lastIndexOf('_')

// Симуляция парсинга callback_data

// СТАРЫЙ (багованный) метод
function oldParse(callbackData, prefix) {
  const toggleData = callbackData.replace(prefix, '');
  const lastUnderscore = toggleData.lastIndexOf('_');
  const productId = toggleData.substring(0, lastUnderscore);
  const index = parseInt(toggleData.substring(lastUnderscore + 1));
  return { productId, index };
}

// НОВЫЙ (исправленный) метод
function newParse(callbackData, prefix) {
  const toggleData = callbackData.replace(prefix, '');
  const parts = toggleData.split('_');
  const index = parseInt(parts[parts.length - 1]);
  const productId = parts.slice(0, -1).join('_');
  return { productId, index };
}

// Тестовые случаи
const testCases = [
  {
    name: 'ProductId без подчеркиваний',
    callbackData: 'admin_toggle_xros5_3',
    prefix: 'admin_toggle_',
    expected: { productId: 'xros5', index: 3 }
  },
  {
    name: 'ProductId с одним подчеркиванием (meloso_x)',
    callbackData: 'admin_toggle_meloso_x_5',
    prefix: 'admin_toggle_',
    expected: { productId: 'meloso_x', index: 5 }
  },
  {
    name: 'ProductId с подчеркиванием (annima_gold)',
    callbackData: 'admin_colortoggle_annima_gold_10',
    prefix: 'admin_colortoggle_',
    expected: { productId: 'annima_gold', index: 10 }
  },
  {
    name: 'Flavorpick с подчеркиванием (annima_sour)',
    callbackData: 'flavorpick_annima_sour_15',
    prefix: 'flavorpick_',
    expected: { productId: 'annima_sour', index: 15 }
  },
  {
    name: 'Optiontoggle без подчеркиваний',
    callbackData: 'admin_optiontoggle_xros6_2',
    prefix: 'admin_optiontoggle_',
    expected: { productId: 'xros6', index: 2 }
  },
  {
    name: 'Критический случай: productId с 2+ подчеркиваниями',
    callbackData: 'admin_toggle_some_product_name_here_7',
    prefix: 'admin_toggle_',
    expected: { productId: 'some_product_name_here', index: 7 }
  }
];

console.log('=== Тест исправления бага парсинга callback_data ===\n');

let allPassed = true;
let bugCount = 0;

testCases.forEach(testCase => {
  console.log(`Тест: ${testCase.name}`);
  console.log(`  Callback: ${testCase.callbackData}`);
  
  const oldResult = oldParse(testCase.callbackData, testCase.prefix);
  const newResult = newParse(testCase.callbackData, testCase.prefix);
  
  const oldCorrect = 
    oldResult.productId === testCase.expected.productId && 
    oldResult.index === testCase.expected.index;
    
  const newCorrect = 
    newResult.productId === testCase.expected.productId && 
    newResult.index === testCase.expected.index;
  
  console.log(`  Ожидается: productId="${testCase.expected.productId}", index=${testCase.expected.index}`);
  console.log(`  Старый метод: productId="${oldResult.productId}", index=${oldResult.index} ${oldCorrect ? '✅' : '❌ БАГ!'}`);
  console.log(`  Новый метод:  productId="${newResult.productId}", index=${newResult.index} ${newCorrect ? '✅' : '❌'}`);
  
  if (!oldCorrect) {
    console.log(`  ⚠️  БАГ ОБНАРУЖЕН: Старый метод неверно парсит этот случай!`);
    bugCount++;
  }
  
  console.log();
  
  if (!newCorrect) {
    allPassed = false;
  }
});

console.log(`Найдено багов в старом методе: ${bugCount}`);
console.log();

if (allPassed) {
  console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Исправление работает корректно.');
  if (bugCount > 0) {
    console.log(`✅ Исправление устраняет ${bugCount} случа${bugCount === 1 ? 'й' : 'я/ев'} некорректного парсинга.`);
  }
} else {
  console.log('❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ! Требуется доработка.');
}

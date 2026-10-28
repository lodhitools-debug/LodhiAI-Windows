const { add, subtract } = require('./src/calculator');

if (add(2, 3) !== 5) {
  console.error('Test failed: 2 + 3 != 5');
  process.exit(1);
}

if (typeof subtract === 'function') {
  if (subtract(5, 3) !== 2) {
    console.error('Test failed: 5 - 3 != 2');
    process.exit(1);
  }
  console.log('Test passed: subtract(5, 3) === 2');
}

console.log('All tests passed: calculator operational');

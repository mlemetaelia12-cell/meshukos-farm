import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateClosingStock, isValidQuantity, isNewbornCategory, canEnterNewbornQuantity } from '../src/lib/stock-logic.mjs';

test('closing stock includes additions and excludes losses', () => {
  const line = { opening_quantity: 100, born_quantity: 8, new_stock_quantity: 5, transfer_in_quantity: 2, transfer_out_quantity: 3, lost_quantity: 1, mortality_quantity: 2, sold_quantity: 4, slaughter_quantity: 1 };
  assert.equal(calculateClosingStock(line), 104);
});

test('sick count is intentionally not part of the stock formula', () => {
  const line = { opening_quantity: 20, born_quantity: 0, new_stock_quantity: 0, transfer_in_quantity: 0, transfer_out_quantity: 0, lost_quantity: 0, mortality_quantity: 0, sold_quantity: 0, slaughter_quantity: 0, sick_quantity: 7 };
  assert.equal(calculateClosingStock(line), 20);
});

test('internal transfer balances out at farm total level', () => {
  const source = { opening_quantity: 20, born_quantity: 0, new_stock_quantity: 0, transfer_in_quantity: 0, transfer_out_quantity: 5, lost_quantity: 0, mortality_quantity: 0, sold_quantity: 0, slaughter_quantity: 0 };
  const destination = { opening_quantity: 10, born_quantity: 0, new_stock_quantity: 0, transfer_in_quantity: 5, transfer_out_quantity: 0, lost_quantity: 0, mortality_quantity: 0, sold_quantity: 0, slaughter_quantity: 0 };
  assert.equal(calculateClosingStock(source) + calculateClosingStock(destination), 30);
});

test('animal quantity validation rejects negatives, decimals and blanks', () => {
  assert.equal(isValidQuantity(0), true);
  assert.equal(isValidQuantity('12'), true);
  assert.equal(isValidQuantity(-1), false);
  assert.equal(isValidQuantity('2.5'), false);
  assert.equal(isValidQuantity(''), false);
});

test('closing stock can go negative in preview so validation can block finalization', () => {
  const line = { opening_quantity: 4, born_quantity: 0, new_stock_quantity: 0, transfer_in_quantity: 0, transfer_out_quantity: 0, lost_quantity: 0, mortality_quantity: 0, sold_quantity: 6, slaughter_quantity: 0 };
  assert.equal(calculateClosingStock(line), -2);
});


test('male and female newborn quantities add to the corresponding newborn stock row', () => {
  const maleLine = { opening_quantity: 12, born_quantity: 0, newborn_male_quantity: 3, newborn_female_quantity: 0, new_stock_quantity: 0, transfer_in_quantity: 0, transfer_out_quantity: 0, lost_quantity: 0, mortality_quantity: 0, sold_quantity: 0, slaughter_quantity: 0 };
  const femaleLine = { ...maleLine, opening_quantity: 8, newborn_male_quantity: 0, newborn_female_quantity: 4 };
  assert.equal(calculateClosingStock(maleLine), 15);
  assert.equal(calculateClosingStock(femaleLine), 12);
});

test('newborn inputs are only allowed on the matching sex and NEWBORN category', () => {
  assert.equal(canEnterNewbornQuantity({ sex: 'MALE', category: 'NEWBORN' }, 'MALE'), true);
  assert.equal(canEnterNewbornQuantity({ sex: 'FEMALE', category: 'Newborn' }, 'FEMALE'), true);
  assert.equal(canEnterNewbornQuantity({ sex: 'MALE', category: 'LAMB' }, 'MALE'), false);
  assert.equal(canEnterNewbornQuantity({ sex: 'FEMALE', category: 'NEWBORN' }, 'MALE'), false);
  assert.equal(isNewbornCategory('New Born'), true);
});

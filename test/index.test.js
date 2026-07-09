const { add, greet } = require('../src/index');

describe('add', () => {
  test('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('adds negative numbers', () => {
    expect(add(-1, -1)).toBe(-2);
  });

  test('adds zero', () => {
    expect(add(5, 0)).toBe(5);
  });
});

describe('greet', () => {
  test('greets a named person', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });

  test('greets a stranger when no name given', () => {
    expect(greet()).toBe('Hello, stranger!');
  });
});

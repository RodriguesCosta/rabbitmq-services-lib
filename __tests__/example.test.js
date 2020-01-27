function soma(a, b) {
  return a + b;
}

test('caso somar 4 e 5 deve retornar 9', () => {
  const result = soma(4, 5);
  expect(result).toBe(9);
});

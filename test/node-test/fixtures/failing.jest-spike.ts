test('shows a representative assertion failure', () => {
    expect({answer: 41}.answer).toBe(42);
});

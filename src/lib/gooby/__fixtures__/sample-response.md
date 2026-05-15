```python
def fibonacci(n):
    if n <= 0:
        return []
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]
```

| Language | Syntax Style | Typing | Popular Use Case |
|----------|--------------|--------|------------------|
| Python   | Indentation, dynamic | Optional, type hints | Data science, scripting |
| JS       | Curly braces, dynamic | Optional, TypeScript | Web development |
| Rust     | Explicit blocks, ownership | Strong, static | Systems programming |

$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$

$E=mc^2$
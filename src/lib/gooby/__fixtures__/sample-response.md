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

LaTeX-paren delimiters (gpt-oss style):

\[
x=\frac{-b\;\pm\;\sqrt{\,b^{2}-4ac\,}}{2a}
\]

Einstein wrote \(E = mc^2\) on the board, and \(e^{i\pi}+1=0\) closes the day.

Negative case — the next fenced block must stay literal:

```text
inline \(x^2\) and block \[ y = x + 1 \] should NOT render
```
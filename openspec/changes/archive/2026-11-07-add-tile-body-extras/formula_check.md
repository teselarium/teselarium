# Formula Check

Tasks 6.2 and 3.2: a tile with the measurement's formulas, shown with `<ot-tile-body>` in the built app (`vite preview`), light color scheme, through Playwright 1.64's desktop browsers (Chromium build 1248, Firefox build 1555, WebKit build 2370) on Linux (WSL2). It was run three times: without a math font, after installing `fonts-stix`, and after adding the math font rule of design.md, D5, to the base stylesheet.

The tile's body:

```markdown
Fractions: $\frac{a+b}{c-d}$ and $\frac{1}{1+\frac{1}{x}}$

Roots: $\sqrt{x^2+y^2}$ and $\sqrt[3]{8}$

$$
\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}
$$

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix} \left( \frac{a}{b} \right)
$$

Letters: $x \in \mathbb{R}$, $\mathbb{N} \subset \mathbb{Z}$, and $\mathcal{O}(n \log n)$
```

## Without a math font

The system's fonts are DejaVu and WenQuanYi, with no OpenType `MATH` table.

| Formula                      | Chromium                                                                         | Firefox                                  | WebKit                                       |
| ---------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| Fractions, nested            | Right; the nested fraction is very small                                         | Right                                    | Right; the nested fraction is small          |
| Square and cube roots        | Right; the radical's bar is thin                                                 | Right                                    | Right                                        |
| Sum with limits              | Limits above and below, but `∑` at text size                                     | Right: large `∑`, limits above and below | Limits above and below, but `∑` at text size |
| Integral with limits         | `∫` at text size, limits beside it                                               | Right: large `∫`                         | `∫` at text size, limits beside it           |
| `pmatrix`, `bmatrix`         | Wrong: the brackets do not stretch, they stay one line high between the two rows | Right: brackets as tall as the matrices  | Wrong: same as Chromium                      |
| `\left( \frac{a}{b} \right)` | Wrong: the parentheses do not stretch, and overlap the fraction                  | Right                                    | Wrong: the parentheses do not stretch        |
| `\mathbb`, `\mathcal`        | Right: ℝ, ℕ, ℤ and 𝒪                                                             | Right                                    | Right                                        |

Display math is centered on its own line in the three browsers.

The design's measurement found stretched brackets in Chromium with Temml. The difference is the system's fonts: without an OpenType MATH font, Chromium and WebKit cannot stretch delimiters or enlarge large operators, and Firefox builds them from Unicode parts.

## With `fonts-stix`

`fonts-stix` 1.1.1 installs STIX Math (`STIXMath-Regular.otf`, STIX 1.x), which has a `MATH` table.

- **Before the math font rule**, with only the generic `math` family: WebKit found STIX Math and drew every formula right. Chromium did not change: it resolves the generic `math` family through fontconfig, which has no alias for it, and `fc-match math` answers FreeSerif, a text font. Firefox found STIX Math too (see below).
- **After the math font rule** (`"STIX Two Math", "STIX Math", "Cambria Math", "Latin Modern Math", math`):

| Formula                      | Chromium                                 | Firefox                                                                                                               | WebKit |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| Fractions, nested            | Right                                    | Right, with extra space above and below each line                                                                     | Right  |
| Square and cube roots        | Right                                    | Right                                                                                                                 | Right  |
| Sum with limits              | Right: large `∑`, limits above and below | Right                                                                                                                 | Right  |
| Integral with limits         | Right: large `∫`                         | Right                                                                                                                 | Right  |
| `pmatrix`, `bmatrix`         | Right: brackets as tall as the matrices  | Wrong: the rows are far apart, the matrix about three times as tall as in Chromium and WebKit, with brackets to match | Right  |
| `\left( \frac{a}{b} \right)` | Right                                    | Right                                                                                                                 | Right  |
| `\mathbb`, `\mathcal`        | Right                                    | Right                                                                                                                 | Right  |

The rule fixes Chromium and keeps WebKit right. Firefox's matrices are wrong with STIX Math whether or not the rule is there: with the generic `math` family alone, Firefox picks STIX Math and lays out the same matrix (bracket 51px, matrix 109px), and with DejaVu Serif forced it draws the compact matrix of the first run (matrix 47px). So the wrong matrices come from Firefox with STIX 1.x, not from the rule. Draft issue given to the user: "Matrices too tall in Firefox with STIX Math (fonts-stix)".

Without a math font, the first table still holds: the rule only helps a system that has one of the named fonts.

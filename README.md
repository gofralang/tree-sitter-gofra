# tree-sitter-gofra

[Gofra](https://github.com/gofralang/gofra) grammar for [tree-sitter](https://tree-sitter.github.io).

Gofra is a stack-based (RPN) language that compiles to native code, so an
expression is a flat sequence of operands and operators. Blocks are keyword
delimited (`if ... else ... end`, `while ... do ... end`).

## Layout

- `grammar.js` — the grammar definition
- `src/parser.c` — the generated parser (committed, so that the grammar can be
  consumed without running the tree-sitter CLI)
- `queries/highlights.scm` — syntax highlighting queries
- `test/corpus/` — parser tests

## Usage

```bash
tree-sitter generate   # regenerate src/parser.c after changing grammar.js
tree-sitter test       # run the corpus tests
tree-sitter highlight path/to/file.gof
```

The grammar is used by the [Gofra extension for Zed](https://github.com/gofralang/gofra-zed).

## License

MIT

/**
 * @file Gofra grammar for tree-sitter
 * @author Kirill Zhosul
 * @license MIT
 *
 * Gofra is a stack-based (RPN) language, so an expression is a flat sequence of
 * operands and operators - there are no grouping parentheses in expressions.
 * Blocks are keyword-delimited (`if ... else ... end`, `while ... do ... end`).
 *
 * The `if` keyword is postfix - the condition is taken from the operand stack,
 * so it is written *before* the `if` keyword:
 *
 *     a.offset size > if
 *         ...
 *     end
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  // Intrinsics (`sizeof`, `typecast`, ...) take a type or a name as an argument,
  // so they must win over the plain expression interpretation of that argument.
  intrinsic: 2,
  // `call` takes the callee name as an argument.
  call: 2,
};

const DECIMAL_DIGITS = /[0-9][0-9_]*/;

/**
 * @param {RuleOrLiteral} rule
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

export default grammar({
  name: 'gofra',

  // `var x` (no type) followed by a `func` declaration is ambiguous - the
  // parser has to look ahead to know whether the `func` starts a new
  // declaration. GLR resolves it by trying both branches.
  conflicts: $ => [
    [$.var_declaration],
  ],

  extras: $ => [
    /\s/,
    $.comment,
    $.doc_comment,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._item),

    // ------------------------------------------------------------------
    // Items - a flat sequence of declarations and expression parts.
    // ------------------------------------------------------------------

    _item: $ => choice(
      $._declaration,
      $._expression_item,
      $.if_statement,
      $.while_statement,
      $.for_statement,
      $.return_statement,
      $.compile_error_statement,
      $.inline_asm_statement,
      ';',
    ),

    _declaration: $ => choice(
      $.preprocessor_directive,
      $.function_declaration,
      $.extern_function_declaration,
      $.lambda_declaration,
      $.struct_declaration,
      $.union_declaration,
      $.type_declaration,
      $.const_declaration,
      $.var_declaration,
      $.import_declaration,
    ),

    // ------------------------------------------------------------------
    // Declarations
    // ------------------------------------------------------------------

    // #include "std" / #define NAME value / #ifdef NAME / #endif
    //
    // The compiler consumes a conditional operand as a single token and a macro
    // body as everything up to the end of the line, so the grammar does the
    // same. `#ifdef` may be followed by code on the very same line.
    preprocessor_directive: $ => choice(
      seq(
        field('name', '#define'),
        field('macro_name', $.identifier),
        optional(field('value', $.macro_value)),
      ),
      seq(
        field('name', '#include'),
        field('path', choice($.string, $.identifier)),
      ),
      seq(
        field('name', choice('#ifdef', '#ifndef', '#undef')),
        field('macro_name', $.identifier),
      ),
      field('name', '#endif'),
    ),

    // Everything up to the end of the line.
    macro_value: $ => token.immediate(/[ \t]+[^\n]*/),

    // pub func void main[]
    function_declaration: $ => seq(
      repeat($.attribute),
      'func',
      field('return_type', optional($._type)),
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      optional(field('body', $._block)),
      'end',
    ),

    // extern pub func void puts[*char[]] - no body, no `end`
    extern_function_declaration: $ => seq(
      'extern',
      repeat($.attribute),
      'func',
      field('return_type', optional($._type)),
      field('name', $.identifier),
      field('parameters', $.parameter_list),
    ),

    // lambda no_return func void inner[]
    lambda_declaration: $ => seq(
      'lambda',
      repeat($.attribute),
      'func',
      field('return_type', optional($._type)),
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      optional(field('body', $._block)),
      'end',
    ),

    // struct Arena
    //     size int
    // end
    struct_declaration: $ => seq(
      'struct',
      repeat($.attribute),
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameter_list)),
      field('members', $.member_list),
      'end',
    ),

    // union Value
    //     as_int int
    // end
    union_declaration: $ => seq(
      'union',
      field('name', $.identifier),
      field('members', $.member_list),
      'end',
    ),

    member_list: $ => repeat1($.member),

    member: $ => seq(
      field('name', $.identifier),
      field('type', $._type),
    ),

    // type Array{T, N} T[N]
    type_declaration: $ => seq(
      'type',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameter_list)),
      field('type', $._type),
    ),

    type_parameter_list: $ => seq('{', commaSep1($._type_argument), '}'),

    // const COLS = 40 / const GRID_COLOR Color = { r = 30, g = 30 }
    const_declaration: $ => seq(
      'const',
      field('name', $.identifier),
      optional(field('type', $._value_type)),
      '=',
      field('value', $._literal),
    ),

    // var sx int[1024] / var head int = 0 / var a = 1;
    var_declaration: $ => seq(
      'var',
      field('name', $.identifier),
      optional(field('type', $._value_type)),
      optional(seq('=', field('value', $._literal))),
    ),

    // import "std" as std
    import_declaration: $ => seq(
      'import',
      field('path', choice($.string, $.identifier)),
      optional(seq('as', field('alias', choice($.identifier, $.string)))),
    ),

    attribute: _ => choice(
      'pub',
      'inline',
      'naked',
      'no_return',
      'no_mangle',
      'packed',
      'reorder',
    ),

    // ------------------------------------------------------------------
    // Control flow
    // ------------------------------------------------------------------

    // <condition> if ... [else ...] end
    if_statement: $ => seq(
      'if',
      optional(field('body', $._block)),
      optional(seq('else', optional(field('alternative', $._block)))),
      'end',
    ),

    // while <condition> do ... end
    while_statement: $ => seq(
      'while',
      field('condition', $._expression),
      'do',
      optional(field('body', $._block)),
      'end',
    ),

    // for <iterator> in <iterable> do ... end
    for_statement: $ => seq(
      'for',
      field('iterator', $.identifier),
      'in',
      field('iterable', $._expression),
      'do',
      optional(field('body', $._block)),
      'end',
    ),

    _block: $ => repeat1($._item),

    return_statement: _ => 'return',

    compile_error_statement: $ => seq(
      'compile_error',
      field('message', $.string),
    ),

    inline_asm_statement: $ => seq(
      'inline_raw_asm',
      field('assembly', $.string),
    ),

    // ------------------------------------------------------------------
    // Expressions
    // ------------------------------------------------------------------

    _expression: $ => repeat1($._expression_item),

    _expression_item: $ => choice(
      $.identifier,
      $.number,
      $.string,
      $.character,
      $.boolean,
      $.array_literal,
      $.structure_literal,
      $.operator,
      $.index_expression,
      $.call_expression,
      $.typecast_expression,
      $.sizeof_expression,
      $.align_of_expression,
      $.offset_of_expression,
      $.pointer_of_proc_expression,
      $.stack_operation,
      $.syscall,
    ),

    // arr[index]
    index_expression: $ => prec(1, seq(
      field('object', $._indexable),
      '[',
      field('index', $._expression),
      ']',
    )),

    _indexable: $ => prec(1, choice(
      $.identifier,
      $.index_expression,
    )),

    // <args> call <function>
    call_expression: $ => prec(PREC.call, seq(
      'call',
      field('function', $.identifier),
    )),

    // 0 typecast *NetSocket
    typecast_expression: $ => prec(PREC.intrinsic, seq(
      'typecast',
      field('type', $._type),
    )),

    // sizeof NetSocket
    sizeof_expression: $ => prec(PREC.intrinsic, seq(
      'sizeof',
      field('type', $._type),
    )),

    // align_of int
    align_of_expression: $ => prec(PREC.intrinsic, seq(
      'align_of',
      field('type', $._type),
    )),

    // offset_of Foo c
    offset_of_expression: $ => prec(PREC.intrinsic, seq(
      'offset_of',
      field('type', $._type),
      field('field', $.identifier),
    )),

    // &x pointer_of_proc f
    pointer_of_proc_expression: $ => prec(PREC.intrinsic, seq(
      'pointer_of_proc',
      field('function', $.identifier),
    )),

    stack_operation: _ => choice('drop', 'swap', 'copy', 'breakpoint'),

    syscall: _ => choice(
      'syscall0',
      'syscall1',
      'syscall2',
      'syscall3',
      'syscall4',
      'syscall5',
      'syscall6',
    ),

    operator: _ => choice(
      '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '!<', '?>',
      '+', '-', '*', '/', '%', '<', '>', '|', '^', '&',
      '..', '.',
    ),

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    // The type is reduced eagerly, so that an array suffix always binds to the
    // type in front of it (`var x int[10]` is an array, not an `int` followed by
    // an array literal).
    _type: $ => prec(1, choice(
      $._value_type,
      $.function_type,
    )),

    // A value type is any type except a function type. Variables and constants
    // only use value types - otherwise `var x` followed by a `func` declaration
    // would be ambiguous.
    _value_type: $ => choice(
      $.primitive_type,
      $.pointer_type,
      $.array_type,
      $.named_type,
    ),

    primitive_type: _ => choice(
      'int',
      'i8',
      'i16',
      'i32',
      'i64',
      'float',
      'f64',
      'bool',
      'char',
      'string',
      'void',
    ),

    // *void
    pointer_type: $ => seq('*', field('type', $._type)),

    // int[1024] / char[]
    // The array suffix binds to the type it follows, so `*void[10]` is a pointer
    // to an array of 10 voids (same as the compiler does).
    array_type: $ => prec(1, seq(
      field('element', $._type),
      '[',
      optional(field('size', $._expression)),
      ']',
    )),

    // Array{T, N}
    // Type arguments bind tighter than the type name itself, so that `Foo {` is
    // always a generic instantiation and never a bare name.
    type_argument_list: $ => prec(2, seq('{', commaSep1($._type_argument), '}')),

    // Array{T, N} / Identity{T = int}
    _type_argument: $ => choice(
      $._type,
      prec(1, seq(
        field('name', $.identifier),
        '=',
        field('default', $._type),
      )),
    ),

    // func int _[int x]
    function_type: $ => seq(
      'func',
      field('return_type', $._type),
      '_',
      field('parameters', $.parameter_list),
    ),

    // SomeUserType / Array{T, N}
    named_type: $ => prec.right(seq(
      field('name', $.identifier),
      optional(field('arguments', $.type_argument_list)),
    )),

    // [int x, *string s,]
    parameter_list: $ => seq(
      '[',
      optional(seq(
        $.parameter,
        repeat(seq(',', $.parameter)),
        optional(','),
      )),
      ']',
    ),

    parameter: $ => seq(
      field('type', $._type),
      field('name', $.identifier),
    ),

    // ------------------------------------------------------------------
    // Literals
    // ------------------------------------------------------------------

    _literal: $ => choice(
      $.number,
      $.string,
      $.character,
      $.boolean,
      $.array_literal,
      $.structure_literal,
    ),

    number: _ => token(choice(
      seq(optional(/[+-]/), /0[xX]/, /[0-9a-fA-F][0-9a-fA-F_]*/),
      seq(optional(/[+-]/), /0[bB]/, /[01][01_]*/),
      seq(optional(/[+-]/), /0[oO]/, /[0-7][0-7_]*/),
      seq(optional(/[+-]/), DECIMAL_DIGITS, optional(seq('.', DECIMAL_DIGITS))),
      seq(optional(/[+-]/), DECIMAL_DIGITS, /[eE]/, optional(/[+-]/), DECIMAL_DIGITS),
    )),

    string: $ => seq(
      '"',
      repeat(choice(
        $.escape_sequence,
        $._string_content,
      )),
      '"',
    ),

    _string_content: _ => token(prec(1, /[^"\\\n]+/)),

    escape_sequence: _ => token(seq('\\', /./)),

    character: $ => seq(
      "'",
      choice(
        $.escape_sequence,
        token.immediate(/[^'\\\n]/),
      ),
      "'",
    ),

    boolean: _ => choice('true', 'false'),

    // [1, 2, 3] / [1, 2, 3; 0] / [1, 2, 3,]
    array_literal: $ => seq(
      '[',
      optional(seq(
        $._literal_value,
        repeat(seq(',', $._literal_value)),
        optional(','),
        optional(seq(';', $._literal_value)),
      )),
      ']',
    ),

    // { r = 30, g = 30 } / Color { r = 30 }
    // The optional type name makes `Foo {` a structure literal rather than a
    // plain identifier followed by something else.
    structure_literal: $ => prec(1, seq(
      optional(field('name', $.identifier)),
      '{',
      optional(seq(
        $.field_initializer,
        repeat(seq(',', $.field_initializer)),
        optional(','),
      )),
      '}',
    )),

    field_initializer: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $._literal_value),
    ),

    // A literal, or a macro reference that is expanded before parsing.
    _literal_value: $ => choice(
      $._literal,
      $.identifier,
    ),

    // ------------------------------------------------------------------
    // Lexical
    // ------------------------------------------------------------------

    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    comment: _ => token(seq('//', /[^\n]*/)),

    doc_comment: _ => token(prec(1, seq('///', /[^\n]*/))),
  },
});

; Syntax highlighting for Gofra.
;
; The capture names follow the Zed theme syntax, so that the same queries can be
; used by the Zed extension and by other tree-sitter based editors.

; ----------------------------------------------------------------------------
; Comments
; ----------------------------------------------------------------------------

(comment) @comment
(doc_comment) @comment.doc

; ----------------------------------------------------------------------------
; Literals
; ----------------------------------------------------------------------------

(number) @number
(boolean) @constant.builtin
(string) @string
(escape_sequence) @string.escape
(character) @string

; ----------------------------------------------------------------------------
; Types
; ----------------------------------------------------------------------------

(primitive_type) @type.builtin
(named_type name: (identifier) @type)
(pointer_type "*" @punctuation.bracket)
(array_type "[" @punctuation.bracket)
(array_type "]" @punctuation.bracket)
(type_argument_list "{" @punctuation.bracket)
(type_argument_list "}" @punctuation.bracket)

(typecast_expression type: (named_type name: (identifier) @type))
(sizeof_expression type: (named_type name: (identifier) @type))
(align_of_expression type: (named_type name: (identifier) @type))
(offset_of_expression type: (named_type name: (identifier) @type))
(offset_of_expression field: (identifier) @property)

; ----------------------------------------------------------------------------
; Functions
; ----------------------------------------------------------------------------

(function_declaration name: (identifier) @function)
(extern_function_declaration name: (identifier) @function)
(lambda_declaration name: (identifier) @function)
(call_expression function: (identifier) @function)
(pointer_of_proc_expression function: (identifier) @function)

(parameter name: (identifier) @variable.parameter)

; ----------------------------------------------------------------------------
; Declarations
; ----------------------------------------------------------------------------

(struct_declaration name: (identifier) @type)
(union_declaration name: (identifier) @type)
(type_declaration name: (identifier) @type)
(member name: (identifier) @property)
(field_initializer name: (identifier) @property)
(var_declaration name: (identifier) @variable)
(const_declaration name: (identifier) @constant)

(attribute) @attribute

; ----------------------------------------------------------------------------
; Keywords
; ----------------------------------------------------------------------------

[
  "func"
  "lambda"
  "struct"
  "union"
  "type"
  "var"
  "const"
  "import"
  "as"
] @keyword

[
  "if"
  "else"
  "while"
  "for"
  "in"
  "do"
  "end"
] @keyword

(return_statement) @keyword

[
  "call"
  "typecast"
  "sizeof"
  "align_of"
  "offset_of"
  "pointer_of_proc"
  "compile_error"
  "inline_raw_asm"
] @keyword

(stack_operation) @function.builtin
(syscall) @function.builtin

(operator) @operator

; ----------------------------------------------------------------------------
; Preprocessor
; ----------------------------------------------------------------------------

[
  "#include"
  "#define"
  "#undef"
  "#ifdef"
  "#ifndef"
  "#endif"
] @preproc

(preprocessor_directive macro_name: (identifier) @constant)
(macro_value) @string

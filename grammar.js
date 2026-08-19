/**
 * @file Gofra grammar for tree-sitter
 * @author Kirill Zhosul
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "gofra",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});

module tb;
  reg [8*12-1:0] message;
  reg [31:0] short_text;
  initial begin
    // A comment containing tokens that must be ignored: endmodule " `bad
    message = "Hello, HDL!";
    short_text = "ABCDEF";
    /* A block comment crosses lines.
       $display("this must never print"); */
    $display("text=[%s] short=[%s]", message, short_text);
    $display("quote=\" slash=\\ tab=\tend");
    $write("newline=first\nsecond\n");
    $display("octal=\101\102\103");
    $display("packed=%h char=%c", "AB", 8'd90);
    $display("stringbits=%0d", $bits("abc"));
    $finish;
  end
endmodule

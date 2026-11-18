module tb;
  reg [3:0] a, b;
  reg [4:0] explicit_or, explicit_comma, wildcard;
  reg [3:0] level;
  always @(a or b) explicit_or = a + b;
  always @(a, b) explicit_comma = a + b;
  always @* wildcard = a + b;
  always @(a) level = a;
  initial begin
    #1 a = 3; b = 4;
    #1 $display("first=%0d,%0d,%0d level=%0d", explicit_or, explicit_comma, wildcard, level);
    b = 9;
    #1 $display("b=%0d,%0d,%0d level=%0d", explicit_or, explicit_comma, wildcard, level);
    a = 8;
    #1 $display("a=%0d,%0d,%0d level=%0d", explicit_or, explicit_comma, wildcard, level);
    $finish;
  end
endmodule
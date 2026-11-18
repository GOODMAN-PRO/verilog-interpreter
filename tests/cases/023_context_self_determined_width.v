module tb;
  reg [3:0] a, b;
  reg [7:0] product, concat_product, quotient, shifted;
  reg [15:0] power, concat_power;
  initial begin
    a = 13;
    b = 7;
    product = a * b;
    concat_product = {a * b};
    quotient = (a * b) / b;
    power = a ** 3;
    concat_power = {a ** 3};
    shifted = a << b;
    $display("product contextual=%0d concat=%0d self=%0d", product, concat_product, a*b);
    $display("quotient contextual=%0d self=%0d", quotient, (a*b)/b);
    $display("power contextual=%0d concat=%0d self=%0d", power, concat_power, a**3);
    $display("shift contextual=%h self=%h", shifted, a<<b);
    $display("reduction_self=%b logical_self=%b", |(a*b), (a*b) && 1'b1);
    $finish;
  end
endmodule

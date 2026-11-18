`default_nettype wand
module t;
  reg a = 1, b = 0;
  assign w = a;
  assign w = b;
  initial #1 $display("%b", w);
endmodule

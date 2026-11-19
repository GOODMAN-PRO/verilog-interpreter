module top(q);
  wire q;
  output [3:0] q;
  initial #1 $display("%b", q);
endmodule

`default_nettype wand
module top;
  assign x = 1'b0;
  assign x = 1'b1;
  initial #1 $display("%b", x);
endmodule

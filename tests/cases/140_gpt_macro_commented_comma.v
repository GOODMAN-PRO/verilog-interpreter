`define ID(x) x
module top;
  initial $display("%0d", `ID(3 /* one, two */));
endmodule

module child(.a(x)); input x; initial #1 $display("%b",x); endmodule
module top; child c(1'b1); endmodule

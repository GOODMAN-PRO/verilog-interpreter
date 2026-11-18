module top; wire [W-1:0] x = 3; localparam W = 4; initial #1 $display("%b", x); endmodule

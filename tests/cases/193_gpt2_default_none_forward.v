`default_nettype none
module top;
assign q=1;
wire q;
initial #1 $display("%b",q);
endmodule

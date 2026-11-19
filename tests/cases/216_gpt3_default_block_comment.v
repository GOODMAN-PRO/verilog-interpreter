`default_nettype wand /* structural nets */
module top;
assign x = 1'b1, x = 1'b0;
initial #1 $display("%b",x);
endmodule

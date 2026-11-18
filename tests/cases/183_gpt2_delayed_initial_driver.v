module top;
wire q;
assign #10 q = 1'b0;
assign #2 q = 1'b1;
initial #5 $display("%b", q);
endmodule

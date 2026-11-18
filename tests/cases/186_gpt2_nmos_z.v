module top;
wire q;
nmos(q,1'bz,1'b1);
initial #1 $display("%b",q);
endmodule

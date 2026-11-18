module top;
wire q;
pullup(q);
pulldown(q);
initial #1 $display("%b",q);
endmodule

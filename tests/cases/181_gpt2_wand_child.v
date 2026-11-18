module child(inout wand p);
assign p=1'b0;
assign p=1'b1;
endmodule
module top;
wire q;
child u(q);
initial #1 $display("%b %b",q,u.p);
endmodule

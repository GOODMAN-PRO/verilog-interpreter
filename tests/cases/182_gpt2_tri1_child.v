module child(inout tri1 p);

endmodule
module top;
wire q;
child u(q);
initial #1 $display("%b %b",q,u.p);
endmodule

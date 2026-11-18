module child(inout p);
assign p=1'b1;
endmodule
module top;
wire q[0:1];
child u(q[1]);
initial #1 $display("%b",q[1]);
endmodule

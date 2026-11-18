module child(inout [1:0] p);
assign p[1]=1'b1;
endmodule
module top;
wire a,b;
assign b=1'b0;
child u({a,b});
initial #1 $display("%b%b %b",a,b,u.p);
endmodule

module leaf(inout wand p);

endmodule
module top;
wire [1:0] v;
leaf u(v[0]);
assign v[1]=1'b0, v[1]=1'b1;
initial #1 $display("%b",v[1]);
endmodule

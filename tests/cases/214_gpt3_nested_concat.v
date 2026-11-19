module leaf(inout [2:0] p);
assign p=3'b101;
endmodule
module top;
wire [2:0] v;
leaf u({v[2], {v[1], v[0]}});
initial #1 $display("%b", v);
endmodule

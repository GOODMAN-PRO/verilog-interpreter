module leaf(inout tri0 p);  endmodule
module top; tri1 b; leaf u(b); initial #1 $display("%b %b",b,u.p); endmodule

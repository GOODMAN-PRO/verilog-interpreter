module child(inout [0:1] p);
  assign p[0]=1;
endmodule
module top;
  wire [1:0] q;
  child u(q);
  initial #1 $display("%b",q);
endmodule

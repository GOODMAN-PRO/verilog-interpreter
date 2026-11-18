module child(inout p);
  assign p=1;
endmodule
module top;
  wire [1:0] q;
  child u(q[1]);
  initial #1 $display("%b",q);
endmodule

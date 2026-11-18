module child(inout p);
  assign p=1;
endmodule
module top;
  child u(top.q);
  wire q;
  initial #1 $display("%b",q);
endmodule

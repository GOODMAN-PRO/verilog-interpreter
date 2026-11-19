module leaf(output wor p);
  assign p = 1;
endmodule
module top;
  wire [1:0] q;
  leaf u(q[0]);
  assign q = 0;
  initial #1 $display("%b %b", q, u.p);
endmodule

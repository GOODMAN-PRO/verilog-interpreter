module leaf(output wor p);
  assign p = 1;
endmodule
module top;
  wire q;
  leaf u({q});
  assign q = 0;
  initial #1 $display("%b %b", q, u.p);
endmodule

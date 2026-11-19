module leaf(output supply1 p);
endmodule
module top;
  wand q;
  leaf u(q);
  initial #1 $display("%b %b", q, u.p);
endmodule

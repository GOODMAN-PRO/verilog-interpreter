module top;
  wand q;
  assign q=1'b1;
  pulldown(q);
  initial #1 $display("%b",q);
endmodule

module top;
  wire w; reg d = 1, en = 0;
  pullup(w);
  assign w = en ? d : 1'bz;
  initial #1 $display("%b", w);
endmodule

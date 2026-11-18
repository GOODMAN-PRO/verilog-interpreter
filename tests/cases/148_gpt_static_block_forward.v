module top;
  initial #2 $display("%b",B.x);
  initial begin : B reg x; x=1; end
endmodule

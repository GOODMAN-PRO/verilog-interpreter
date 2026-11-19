module top;
  if (1) begin :g assign w=1'b1; end
  wire w;
  initial #1 $display("%b",w);
endmodule

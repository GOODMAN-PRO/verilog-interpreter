module tb;
  integer n = 0; reg clk = 1;
  always @(posedge clk) begin $display("A fired n=%0d", n); n = n + 1; end
  initial begin $display("init"); #1 $display("n=%0d", n); end
endmodule

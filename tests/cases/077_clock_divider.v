`timescale 1ns/1ps
module divider #(parameter HALF = 3)(input clk, rst, output reg divided, tick);
  integer count;
  always @(posedge clk) begin
    if (rst) begin count <= 0; divided <= 0; tick <= 0; end
    else begin
      tick <= 0;
      if (count == HALF - 1) begin count <= 0; divided <= ~divided; tick <= 1; end
      else count <= count + 1;
    end
  end
endmodule
module tb;
  reg clk, rst;
  wire div2, tick2, div6, tick6;
  integer i;
  divider #(.HALF(1)) fast(clk, rst, div2, tick2);
  divider #(3) slow(clk, rst, div6, tick6);
  always #5 clk = ~clk;
  initial begin
    clk = 0; rst = 1;
    @(negedge clk); rst = 0;
    for (i = 0; i < 14; i = i + 1) begin
      @(posedge clk); #1;
      $display("cycle=%0d div2=%b tick2=%b div6=%b tick6=%b count=%0d", i, div2, tick2, div6, tick6, slow.count);
    end
    @(negedge clk); rst = 1;
    @(posedge clk); #1; $display("reset div2=%b div6=%b ticks=%b%b", div2, div6, tick2, tick6);
    $finish;
  end
endmodule

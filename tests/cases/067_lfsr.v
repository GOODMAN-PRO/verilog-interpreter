`timescale 1ns/1ps
module lfsr(input clk, rst, en, output reg [3:0] q);
  always @(posedge clk)
    if (rst) q <= 4'b0001;
    else if (en) q <= {q[2:0], q[3] ^ q[2]};
endmodule
module tb;
  reg clk, rst, en;
  wire [3:0] q;
  integer i;
  lfsr dut(clk, rst, en, q);
  always #5 clk = ~clk;
  initial begin
    clk = 0; rst = 1; en = 0;
    @(posedge clk); #1; $display("seed=%b", q);
    @(negedge clk); rst = 0; en = 1;
    for (i = 1; i <= 16; i = i + 1) begin
      @(posedge clk); #1; $display("step=%0d q=%b", i, q);
    end
    @(negedge clk); en = 0;
    repeat (2) begin @(posedge clk); #1; $display("hold=%b", q); end
    $finish;
  end
endmodule

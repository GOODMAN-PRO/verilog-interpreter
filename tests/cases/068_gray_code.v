`timescale 1ns/1ps
module gray_counter(input clk, rst, output reg [3:0] binary,
                    output [3:0] gray, decoded);
  assign gray = binary ^ (binary >> 1);
  assign decoded[3] = gray[3];
  assign decoded[2] = ^gray[3:2];
  assign decoded[1] = ^gray[3:1];
  assign decoded[0] = ^gray;
  always @(posedge clk) if (rst) binary <= 0; else binary <= binary + 1'b1;
endmodule
module tb;
  reg clk, rst;
  wire [3:0] binary, gray, decoded;
  reg [3:0] previous;
  integer i;
  gray_counter dut(clk, rst, binary, gray, decoded);
  always #5 clk = ~clk;
  initial begin
    clk = 0; rst = 1; previous = 0;
    @(posedge clk); #1; $display("binary=%h gray=%b decoded=%h", binary, gray, decoded);
    @(negedge clk); rst = 0;
    for (i = 0; i < 17; i = i + 1) begin
      @(posedge clk); #1;
      $display("binary=%h gray=%b changed=%b decoded=%h", binary, gray, gray ^ previous, decoded);
      previous = gray;
    end
    $finish;
  end
endmodule

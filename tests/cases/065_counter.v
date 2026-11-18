`timescale 1ns/1ps
module counter(input clk, rst, en, down, output reg [2:0] q);
  always @(posedge clk or posedge rst)
    if (rst) q <= 0;
    else if (en) q <= down ? q - 1'b1 : q + 1'b1;
endmodule
module tb;
  reg clk, rst, en, down;
  wire [2:0] q;
  integer i;
  counter dut(clk, rst, en, down, q);
  always #5 clk = ~clk;
  task step;
    input e, d;
    begin
      @(negedge clk); en = e; down = d;
      @(posedge clk); #1; $display("en=%b down=%b q=%0d", en, down, q);
    end
  endtask
  initial begin
    clk = 0; rst = 0; en = 0; down = 0;
    #1; rst = 1;
    #1; rst = 0;
    for (i = 0; i < 9; i = i + 1) step(1, 0);
    step(0, 0); step(1, 1); step(1, 1); step(0, 1);
    #2; rst = 1; #1; $display("async reset q=%0d", q);
    $finish;
  end
endmodule

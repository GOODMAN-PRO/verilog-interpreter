`timescale 1ns/1ps
module shifter(input clk, rst, load, en, right, serial,
               input [7:0] data, output reg [7:0] q);
  always @(posedge clk)
    if (rst) q <= 0;
    else if (load) q <= data;
    else if (en) q <= right ? {serial, q[7:1]} : {q[6:0], serial};
endmodule
module tb;
  reg clk, rst, load, en, right, serial;
  reg [7:0] data;
  wire [7:0] q;
  integer i;
  shifter dut(clk, rst, load, en, right, serial, data, q);
  always #5 clk = ~clk;
  task step;
    input l, e, r, s;
    begin
      @(negedge clk); load = l; en = e; right = r; serial = s;
      @(posedge clk); #1; $display("load=%b en=%b right=%b serial=%b q=%b", l, e, r, s, q);
    end
  endtask
  initial begin
    clk = 0; rst = 1; load = 0; en = 0; right = 0; serial = 0; data = 8'ha6;
    @(negedge clk); rst = 0;
    step(1, 1, 0, 1); step(0, 0, 1, 1);
    for (i = 0; i < 4; i = i + 1) step(0, 1, 0, i[0]);
    for (i = 0; i < 4; i = i + 1) step(0, 1, 1, ~i[0]);
    data = 8'h81; step(1, 0, 1, 0); step(0, 1, 1, 0);
    $finish;
  end
endmodule

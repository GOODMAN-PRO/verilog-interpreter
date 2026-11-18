`timescale 1ns/1ps
module ram(input clk, en, we, input [1:0] address,
           input [7:0] din, output reg [7:0] dout);
  reg [7:0] words [0:3];
  always @(posedge clk) if (en) begin
    if (we) words[address] <= din;
    dout <= words[address];
  end
endmodule
module tb;
  reg clk, en, we;
  reg [1:0] address;
  reg [7:0] din;
  wire [7:0] dout;
  integer i;
  ram dut(clk, en, we, address, din, dout);
  always #5 clk = ~clk;
  task step;
    input e, w;
    input [1:0] a;
    input [7:0] d;
    begin
      @(negedge clk); en = e; we = w; address = a; din = d;
      @(posedge clk); #1;
      $display("en=%b we=%b addr=%0d din=%h dout=%h", e, w, a, d, dout);
    end
  endtask
  initial begin
    clk = 0; en = 0; we = 0; address = 0; din = 0;
    for (i = 0; i < 4; i = i + 1) step(1, 1, i, 8'h30 + i);
    for (i = 3; i >= 0; i = i - 1) step(1, 0, i, 0);
    step(1, 1, 2, 8'haa); step(1, 0, 2, 0);
    step(0, 1, 2, 8'hff); step(1, 0, 2, 0);
    step(1, 1, 2'bxx, 8'h55); step(1, 0, 2, 0);
    $finish;
  end
endmodule

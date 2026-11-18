`timescale 1ns/1ps
module arbiter(input clk, rst, accept, input [3:0] request, output reg [3:0] grant);
  reg [1:0] pointer, selected;
  reg found;
  integer k, index;
  always @* begin
    grant = 0; found = 0; selected = pointer; index = 0;
    for (k = 0; k < 4; k = k + 1) begin
      index = (pointer + k) % 4;
      if (!found && request[index]) begin
        grant[index] = 1; selected = index; found = 1;
      end
    end
  end
  always @(posedge clk)
    if (rst) pointer <= 0;
    else if (accept && found) pointer <= selected + 1'b1;
endmodule
module tb;
  reg clk, rst, accept;
  reg [3:0] request;
  wire [3:0] grant;
  integer i;
  arbiter dut(clk, rst, accept, request, grant);
  always #5 clk = ~clk;
  task step;
    input [3:0] r;
    input a;
    begin
      @(negedge clk); request = r; accept = a;
      #1; $display("request=%b accept=%b pointer=%0d grant=%b", r, a, dut.pointer, grant);
      @(posedge clk); #1; $display("after pointer=%0d grant=%b", dut.pointer, grant);
    end
  endtask
  initial begin
    clk = 0; rst = 1; accept = 0; request = 0;
    @(negedge clk); rst = 0;
    step(0, 1);
    for (i = 0; i < 6; i = i + 1) step(4'b1111, 1);
    step(4'b1111, 0); step(4'b1111, 0);
    step(4'b1001, 1); step(4'b1001, 1); step(4'b0100, 1);
    step(0, 1); step(4'b0001, 1);
    $finish;
  end
endmodule

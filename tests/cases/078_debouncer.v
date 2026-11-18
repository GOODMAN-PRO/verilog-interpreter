`timescale 1ns/1ps
module debounce(input clk, rst, noisy, output reg stable);
  reg sync1, sync2;
  reg [1:0] count;
  always @(posedge clk) begin
    if (rst) begin sync1 <= 0; sync2 <= 0; stable <= 0; count <= 0; end
    else begin
      sync1 <= noisy; sync2 <= sync1;
      if (sync2 == stable) count <= 0;
      else if (count == 2) begin stable <= sync2; count <= 0; end
      else count <= count + 1'b1;
    end
  end
endmodule
module tb;
  reg clk, rst, noisy;
  wire stable;
  integer cycle;
  debounce dut(clk, rst, noisy, stable);
  always #5 clk = ~clk;
  task step;
    input level;
    begin
      @(negedge clk); noisy = level;
      @(posedge clk); #1;
      $display("cycle=%0d input=%b sync=%b count=%0d stable=%b", cycle, noisy, dut.sync2, dut.count, stable);
      cycle = cycle + 1;
    end
  endtask
  initial begin
    clk = 0; rst = 1; noisy = 0; cycle = 0;
    @(negedge clk); rst = 0;
    step(1); step(0); step(1); step(0);
    repeat (7) step(1);
    step(0); step(1); step(0); step(1);
    repeat (7) step(0);
    $finish;
  end
endmodule
